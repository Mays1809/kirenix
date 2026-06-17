-- ═══════════════════════════════════════════════════════════════════
--  Админ-панель v2:
--   • забирать ЛЮБОЙ доступ (в т.ч. купленный — для ручных возвратов)
--   • скрывать/показывать курс на витрине
--   • сводка (ученики, продажи, выручка, отзывы, рефералы)
--   • список всех курсов (вкл. скрытые) для панели
-- ═══════════════════════════════════════════════════════════════════

-- Забрать доступ — теперь любой источник (purchase/manual/free).
-- Деньги это НЕ возвращает (возврат делается в ЮKassa отдельно) — только
-- снимает доступ к курсу.
create or replace function public.admin_revoke_access(p_email text, p_slug text)
returns text language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select id into uid from auth.users where lower(email) = lower(trim(p_email));
  if uid is null then return 'no_user'; end if;
  delete from public.course_access where user_id = uid and course_slug = p_slug;
  return 'revoked';
end $$;
grant execute on function public.admin_revoke_access(text, text) to authenticated;

-- Скрыть / показать курс на витрине
create or replace function public.admin_set_published(p_slug text, p_published boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  update public.catalog_courses set is_published = p_published where slug = p_slug;
end $$;
grant execute on function public.admin_set_published(text, boolean) to authenticated;

-- Все курсы (включая скрытые) — для панели управления
create or replace function public.admin_list_courses()
returns table(slug text, title text, price numeric, original_price numeric, is_published boolean)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select c.slug, c.title, c.price, c.original_price, coalesce(c.is_published, true)
      from public.catalog_courses c
     order by c.sort_order nulls last, c.title;
end $$;
grant execute on function public.admin_list_courses() to authenticated;

-- Сводка по проекту
create or replace function public.admin_summary()
returns json language plpgsql security definer set search_path = public as $$
declare r json;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select json_build_object(
    'students',        (select count(distinct user_id) from public.course_access),
    'sales',           (select count(*) from public.course_orders where status = 'succeeded'),
    'revenue',         (select coalesce(sum(amount), 0) from public.course_orders where status = 'succeeded'),
    'pending_reviews', (select count(*) from public.reviews where status = 'pending'),
    'referral_due',    (select coalesce(sum(amount), 0) from public.referral_commissions where status = 'pending')
  ) into r;
  return r;
end $$;
grant execute on function public.admin_summary() to authenticated;
