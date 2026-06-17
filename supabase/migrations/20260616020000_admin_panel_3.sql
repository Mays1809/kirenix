-- ═══════════════════════════════════════════════════════════════════
--  Управление v3: заказы, промокоды, объявление, бесплатные уроки,
--  экспорт email, тексты курсов. Всё через admin-RPC (is_admin()).
-- ═══════════════════════════════════════════════════════════════════

-- ───────── 1. Список заказов/платежей ─────────
create or replace function public.admin_list_orders()
returns table(email text, course_slug text, amount numeric, status text,
              created_at timestamptz, paid_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select u.email::text, o.course_slug, o.amount, o.status, o.created_at, o.paid_at
      from public.course_orders o join auth.users u on u.id = o.user_id
     order by o.created_at desc limit 200;
end $$;
grant execute on function public.admin_list_orders() to authenticated;

-- ───────── 2. Промокоды ─────────
create table if not exists public.promo_codes (
  id         uuid primary key default gen_random_uuid(),
  code       text unique not null,
  percent    int  not null check (percent between 1 and 100),
  active     boolean not null default true,
  max_uses   int,                      -- null = без лимита
  used       int  not null default 0,
  expires_at timestamptz,              -- null = бессрочно
  created_at timestamptz not null default now()
);
alter table public.promo_codes enable row level security;
-- управление — только админ; проверка при оплате идёт через service_role в create-payment
drop policy if exists "promo_admin_all" on public.promo_codes;
create policy "promo_admin_all" on public.promo_codes
  for all using (public.is_admin()) with check (public.is_admin());

create or replace function public.admin_create_promo(p_code text, p_percent int, p_max int, p_expires timestamptz)
returns text language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  insert into public.promo_codes (code, percent, max_uses, expires_at)
    values (upper(trim(p_code)), p_percent, p_max, p_expires)
    on conflict (code) do update
      set percent = excluded.percent, max_uses = excluded.max_uses,
          expires_at = excluded.expires_at, active = true;
  return 'ok';
end $$;
grant execute on function public.admin_create_promo(text, int, int, timestamptz) to authenticated;

create or replace function public.admin_list_promos()
returns setof public.promo_codes language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query select * from public.promo_codes order by created_at desc;
end $$;
grant execute on function public.admin_list_promos() to authenticated;

create or replace function public.admin_set_promo_active(p_id uuid, p_active boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  update public.promo_codes set active = p_active where id = p_id;
end $$;
grant execute on function public.admin_set_promo_active(uuid, boolean) to authenticated;

-- ───────── 3. Объявление-баннер (app_settings ключ 'announcement') ─────────
create or replace function public.admin_set_announcement(p_text text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  insert into public.app_settings (key, value, updated_at)
    values ('announcement', to_jsonb(coalesce(p_text, '')), now())
    on conflict (key) do update set value = excluded.value, updated_at = now();
end $$;
grant execute on function public.admin_set_announcement(text) to authenticated;

-- ───────── 4. Бесплатные уроки ─────────
create or replace function public.admin_list_lessons(p_slug text)
returns table(id uuid, module_num int, order_index int, num text, title text, is_free boolean)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select l.id, l.module_num, l.order_index, l.num, l.title, l.is_free
      from public.course_lessons l
     where l.course_slug = p_slug
     order by l.module_num, l.order_index;
end $$;
grant execute on function public.admin_list_lessons(text) to authenticated;

create or replace function public.admin_set_lesson_free(p_id uuid, p_free boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  update public.course_lessons set is_free = p_free where id = p_id;
end $$;
grant execute on function public.admin_set_lesson_free(uuid, boolean) to authenticated;

-- ───────── 5. Экспорт email учеников ─────────
create or replace function public.admin_student_emails()
returns table(email text) language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select distinct u.email::text from auth.users u
     where u.email is not null order by u.email;
end $$;
grant execute on function public.admin_student_emails() to authenticated;

-- ───────── 6. Название/описание курса ─────────
create or replace function public.admin_set_course_meta(p_slug text, p_title text, p_desc text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  update public.catalog_courses
     set title = coalesce(nullif(trim(p_title), ''), title),
         short_desc = p_desc
   where slug = p_slug;
end $$;
grant execute on function public.admin_set_course_meta(text, text, text) to authenticated;

-- обновляем список курсов: добавляем short_desc (для редактирования описания в панели)
drop function if exists public.admin_list_courses();
create or replace function public.admin_list_courses()
returns table(slug text, title text, short_desc text, price numeric, original_price numeric, is_published boolean)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select c.slug, c.title, c.short_desc, c.price, c.original_price, coalesce(c.is_published, true)
      from public.catalog_courses c
     order by c.sort_order nulls last, c.title;
end $$;
grant execute on function public.admin_list_courses() to authenticated;
