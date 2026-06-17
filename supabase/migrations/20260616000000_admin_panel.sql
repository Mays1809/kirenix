-- ═══════════════════════════════════════════════════════════════════
--  Админ-панель владельца: менять цены + выдавать/забирать доступ к курсам
--  (по email). Всё через RPC с проверкой is_admin() — без прямого SQL.
-- ═══════════════════════════════════════════════════════════════════

-- Единый признак «владелец/админ»: роль admin/owner ИЛИ почта владельца.
-- (Совпадает с логикой фронта OWNER_EMAILS.)
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','owner'))
      or coalesce((auth.jwt() ->> 'email'), '') = 'maysbad@gmail.com';
$$;
grant execute on function public.is_admin() to authenticated;

-- ── Сменить цену курса (и «старую» цену для зачёркивания; null — убрать) ──
create or replace function public.admin_set_price(p_slug text, p_price numeric, p_original numeric)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  update public.catalog_courses
     set price = p_price,
         original_price = p_original
   where slug = p_slug;
end $$;
grant execute on function public.admin_set_price(text, numeric, numeric) to authenticated;

-- ── Выдать доступ к курсу по email (source='manual') ──
create or replace function public.admin_grant_access(p_email text, p_slug text)
returns text language plpgsql security definer set search_path = public as $$
declare uid uuid; existed boolean;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select id into uid from auth.users where lower(email) = lower(trim(p_email));
  if uid is null then return 'no_user'; end if;
  select exists(select 1 from public.course_access where user_id = uid and course_slug = p_slug)
    into existed;
  insert into public.course_access (user_id, course_slug, source)
    values (uid, p_slug, 'manual')
    on conflict (user_id, course_slug) do nothing;
  return case when existed then 'already' else 'granted' end;
end $$;
grant execute on function public.admin_grant_access(text, text) to authenticated;

-- ── Забрать ВЫДАННЫЙ вручную доступ (купленный не трогаем) ──
create or replace function public.admin_revoke_access(p_email text, p_slug text)
returns text language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select id into uid from auth.users where lower(email) = lower(trim(p_email));
  if uid is null then return 'no_user'; end if;
  delete from public.course_access
   where user_id = uid and course_slug = p_slug and source = 'manual';
  return 'revoked';
end $$;
grant execute on function public.admin_revoke_access(text, text) to authenticated;

-- ── Список доступов (кто к какому курсу, и как получил) ──
create or replace function public.admin_list_access()
returns table(email text, course_slug text, source text, granted_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select u.email::text, ca.course_slug, ca.source, ca.granted_at
      from public.course_access ca
      join auth.users u on u.id = ca.user_id
     order by ca.granted_at desc nulls last;
end $$;
grant execute on function public.admin_list_access() to authenticated;
