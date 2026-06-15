-- ═══════════════════════════════════════════════════════════════════
--  База на будущее: каталог в БД, флаг маркетплейса, прогресс уроков,
--  комиссии в заказах. Витрина остаётся «личной школой», пока
--  marketplace_mode = false.
-- ═══════════════════════════════════════════════════════════════════

-- 1. Каталог курсов: цены и описания меняются без правки кода
create table if not exists public.catalog_courses (
  slug           text primary key,            -- 'informatics', 'russian', ...
  content_id     text,                        -- slug контента в course_lessons
  title          text not null,
  subject        text,
  icon           text,
  color          text default '#3b82f6',
  price          numeric not null,
  original_price numeric,
  duration       text,
  lessons_count  int,
  level          text default 'intermediate', -- beginner | intermediate | advanced
  format         text default 'text',
  tags           jsonb default '[]'::jsonb,
  short_desc     text,
  teacher_name   text,
  teacher_avatar text,
  school_name    text,
  -- поля маркетплейса (пока не используются, заполнятся после ИП)
  author_id      uuid references auth.users(id) on delete set null,
  commission_pct numeric not null default 0,
  is_published   boolean not null default false,
  sort_order     int not null default 100,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

alter table public.catalog_courses enable row level security;

drop policy if exists "catalog_public_read" on public.catalog_courses;
create policy "catalog_public_read" on public.catalog_courses
  for select using (is_published);

drop policy if exists "catalog_admin_all" on public.catalog_courses;
create policy "catalog_admin_all" on public.catalog_courses
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- Сид: текущий курс информатики
insert into public.catalog_courses
  (slug, content_id, title, subject, icon, color, price, duration, lessons_count,
   level, format, tags, short_desc, teacher_name, teacher_avatar, school_name,
   is_published, sort_order)
values (
  'informatics', 'informatics',
  'Информатика ЕГЭ 2026: все 27 заданий',
  'Информатика', '💻', '#3b82f6',
  5200, '70 ч', 38,
  'intermediate', 'text',
  '["11 модулей","Разбор всех 27 заданий","Практика с ответами","Python"]'::jsonb,
  'Полный текстовый курс: теория, разобранные примеры, практика с ответами, шпаргалки. Машина Тьюринга, задание 22 «на максимум» — по ФИПИ 2026.',
  'Кирилл Шевелев', 'КШ', 'Авторский курс',
  true, 1
)
on conflict (slug) do nothing;

-- 2. Настройки приложения (флаг маркетплейса и будущие переключатели)
create table if not exists public.app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz default now()
);
alter table public.app_settings enable row level security;

drop policy if exists "settings_public_read" on public.app_settings;
create policy "settings_public_read" on public.app_settings
  for select using (true);

drop policy if exists "settings_admin_write" on public.app_settings;
create policy "settings_admin_write" on public.app_settings
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

insert into public.app_settings (key, value)
values ('marketplace_mode', 'false'::jsonb)
on conflict (key) do nothing;

-- 3. Прогресс уроков (наличие строки = урок пройден)
create table if not exists public.course_progress (
  user_id    uuid not null references auth.users(id) on delete cascade,
  lesson_id  uuid not null references public.course_lessons(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, lesson_id)
);
alter table public.course_progress enable row level security;

drop policy if exists "progress_own_all" on public.course_progress;
create policy "progress_own_all" on public.course_progress
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 4. Комиссии маркетплейса в заказах (история продаж готова к ИП)
alter table if exists public.course_orders
  add column if not exists author_id uuid references auth.users(id) on delete set null,
  add column if not exists commission_pct numeric not null default 0,
  add column if not exists commission_amount numeric not null default 0;
