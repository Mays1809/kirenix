-- ═══════════════════════════════════════════════════════════════════
--  Платный контент курсов: таблицы, RLS, доступ
--  Контент уроков хранится в БД и отдаётся ТОЛЬКО купившим (или админу).
--  Названия уроков и модули — публичные (это витрина/оглавление).
-- ═══════════════════════════════════════════════════════════════════

-- 1. Модули курса (публичное оглавление)
create table if not exists public.course_modules (
  id          uuid primary key default gen_random_uuid(),
  course_slug text not null,
  num         int  not null,
  icon        text,
  title       text not null,
  created_at  timestamptz default now(),
  unique (course_slug, num)
);

-- 2. Уроки: метаданные публикуются через view, тело (body) — закрыто RLS
create table if not exists public.course_lessons (
  id          uuid primary key default gen_random_uuid(),
  course_slug text not null,
  module_num  int  not null,
  order_index int  not null,                -- сквозной порядок в курсе
  num         text,                         -- '1.1' … или null для итога модуля
  title       text not null,
  tag         text,                         -- 'задание 14' и т.п.
  is_summary  boolean not null default false,
  is_free     boolean not null default false, -- бесплатный пробный урок
  body        text not null,                -- markdown урока (ЗАЩИЩЁН)
  created_at  timestamptz default now(),
  unique (course_slug, module_num, order_index)
);

-- 3. Доступ к курсу. Выдаёт ТОЛЬКО сервер (webhook оплаты / вручную владельцем).
create table if not exists public.course_access (
  user_id     uuid not null references auth.users(id) on delete cascade,
  course_slug text not null,
  source      text not null default 'purchase',  -- purchase | manual
  order_id    uuid,
  granted_at  timestamptz default now(),
  primary key (user_id, course_slug)
);

-- 4. Заказы на курсы (ЮKassa)
create table if not exists public.course_orders (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  course_slug   text not null,
  amount        numeric not null,
  status        text not null default 'pending', -- pending|succeeded|canceled|failed
  yk_payment_id text unique,
  created_at    timestamptz default now(),
  paid_at       timestamptz
);

-- ── Функция проверки доступа (security definer — не зависит от RLS) ──
create or replace function public.has_course_access(p_slug text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select
    exists (
      select 1 from course_access ca
      where ca.user_id = auth.uid() and ca.course_slug = p_slug
    )
    or exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role = 'admin'
    );
$$;

grant execute on function public.has_course_access(text) to anon, authenticated;

-- ── RLS ──
alter table public.course_modules enable row level security;
alter table public.course_lessons enable row level security;
alter table public.course_access  enable row level security;
alter table public.course_orders  enable row level security;

drop policy if exists "modules_public_read" on public.course_modules;
create policy "modules_public_read" on public.course_modules
  for select using (true);

-- Тело урока читают: бесплатные — все, остальные — купившие/админ
drop policy if exists "lessons_paid_read" on public.course_lessons;
create policy "lessons_paid_read" on public.course_lessons
  for select using (is_free or public.has_course_access(course_slug));

-- Свои записи о доступе видеть можно; выдавать (insert) — никому, кроме service_role
drop policy if exists "access_own_read" on public.course_access;
create policy "access_own_read" on public.course_access
  for select using (user_id = auth.uid());

-- Свои заказы видеть можно; создавать заказы клиенту напрямую нельзя
drop policy if exists "orders_own_read" on public.course_orders;
create policy "orders_own_read" on public.course_orders
  for select using (user_id = auth.uid());

-- ── Публичное оглавление уроков (БЕЗ body) ──
-- security_invoker = false: view принадлежит postgres и обходит RLS базовой
-- таблицы, но отдаёт только безопасные колонки.
create or replace view public.course_lessons_index
with (security_invoker = false) as
  select id, course_slug, module_num, order_index, num, title, tag, is_summary, is_free
  from public.course_lessons;

grant select on public.course_lessons_index to anon, authenticated;

-- ── ВАЖНО: закрываем дыру самозаписи на курсы ──
-- Старая тестовая кнопка позволяла клиенту самому делать insert в enrollments.
-- Убираем все insert/update/delete-политики клиентов с enrollments.
do $$
declare pol record;
begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'public' and table_name = 'enrollments') then
    alter table public.enrollments enable row level security;
    for pol in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = 'enrollments'
        and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
    loop
      execute format('drop policy %I on public.enrollments', pol.policyname);
    end loop;
  end if;
end $$;

-- ── Владелец: роль admin + ручной доступ к курсу ──
-- (в do-блоке: если на profiles.role стоит check-ограничение без 'admin',
--  миграция не упадёт — доступ владельцу всё равно даст вставка ниже)
do $$
begin
  update public.profiles set role = 'admin'
  where id in (select id from auth.users where lower(email) = 'maysbad@gmail.com');
exception when others then
  raise notice 'profiles.role=admin не установить: %', sqlerrm;
end $$;

insert into public.course_access (user_id, course_slug, source)
select id, 'informatics', 'manual' from auth.users
where lower(email) = 'maysbad@gmail.com'
on conflict (user_id, course_slug) do nothing;
