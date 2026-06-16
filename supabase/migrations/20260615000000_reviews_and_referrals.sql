-- ═══════════════════════════════════════════════════════════════════
--  Отзывы (ученики оставляют сами, автор модерирует)
--  + Реферальная программа (10% с первой покупки приглашённого)
-- ═══════════════════════════════════════════════════════════════════

-- ───────────────────────── ОТЗЫВЫ ─────────────────────────
-- если раньше уже была таблица reviews с другой схемой — пересоздаём (данных нет)
drop table if exists public.reviews cascade;
create table if not exists public.reviews (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  author_name text not null,
  rating      int  not null check (rating between 1 and 5),
  body        text not null check (char_length(body) between 3 and 2000),
  status      text not null default 'pending' check (status in ('pending','approved','hidden')),
  created_at  timestamptz not null default now()
);
alter table public.reviews enable row level security;

-- одобренные отзывы видны всем (в т.ч. гостям)
drop policy if exists "reviews_read_approved" on public.reviews;
create policy "reviews_read_approved" on public.reviews
  for select using (status = 'approved');

-- свой отзыв автор видит при любом статусе
drop policy if exists "reviews_read_own" on public.reviews;
create policy "reviews_read_own" on public.reviews
  for select using (user_id = auth.uid());

-- ученик добавляет свой отзыв (только в статусе pending)
drop policy if exists "reviews_insert_own" on public.reviews;
create policy "reviews_insert_own" on public.reviews
  for insert with check (user_id = auth.uid() and status = 'pending');

-- автор курса (admin) видит все и модерирует
drop policy if exists "reviews_admin_all" on public.reviews;
create policy "reviews_admin_all" on public.reviews
  for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- ──────────────────────── РЕФЕРАЛКА ────────────────────────
-- код-приглашение и «кто пригласил» — в профиле
alter table public.profiles add column if not exists ref_code    text unique;
alter table public.profiles add column if not exists referred_by uuid references auth.users(id);

-- начисления партнёру (создаёт ТОЛЬКО сервер из вебхука; ученик/админ — читают)
drop table if exists public.referral_commissions cascade;
create table if not exists public.referral_commissions (
  id               uuid primary key default gen_random_uuid(),
  referrer_id      uuid not null references auth.users(id) on delete cascade,
  referred_user_id uuid not null references auth.users(id) on delete cascade,
  order_id         uuid,
  amount           numeric not null,
  status           text not null default 'pending' check (status in ('pending','paid')),
  created_at       timestamptz not null default now()
);
alter table public.referral_commissions enable row level security;

-- пригласивший видит свои начисления
drop policy if exists "rc_read_own" on public.referral_commissions;
create policy "rc_read_own" on public.referral_commissions
  for select using (referrer_id = auth.uid());

-- админ видит и меняет все (помечает выплаченным)
drop policy if exists "rc_admin_all" on public.referral_commissions;
create policy "rc_admin_all" on public.referral_commissions
  for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- генератор короткого кода
create or replace function public.gen_ref_code() returns text
language sql as $$
  select upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
$$;

-- получить (создать при первом обращении) свой реф-код
create or replace function public.my_ref_code() returns text
language plpgsql security definer set search_path = public as $$
declare c text;
begin
  select ref_code into c from profiles where id = auth.uid();
  if c is null then
    loop
      c := gen_ref_code();
      begin
        update profiles set ref_code = c where id = auth.uid();
        exit;
      exception when unique_violation then
        -- крайне редкая коллизия — пробуем ещё раз
      end;
    end loop;
  end if;
  return c;
end $$;
grant execute on function public.my_ref_code() to authenticated;

-- привязать пригласившего (однократно, нельзя на себя)
create or replace function public.claim_referral(p_code text) returns boolean
language plpgsql security definer set search_path = public as $$
declare ref uuid;
begin
  if (select referred_by from profiles where id = auth.uid()) is not null then
    return false;                       -- уже привязан
  end if;
  select id into ref from profiles where ref_code = upper(p_code);
  if ref is null or ref = auth.uid() then
    return false;                       -- код не найден или свой
  end if;
  update profiles set referred_by = ref where id = auth.uid() and referred_by is null;
  return true;
end $$;
grant execute on function public.claim_referral(text) to authenticated;

-- админ: пометить начисление выплаченным
create or replace function public.referral_mark_paid(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from profiles where id = auth.uid() and role = 'admin') then
    raise exception 'forbidden';
  end if;
  update referral_commissions set status = 'paid' where id = p_id;
end $$;
grant execute on function public.referral_mark_paid(uuid) to authenticated;

-- админ: список начислений с email партнёров (кому и сколько платить)
create or replace function public.referral_admin_list() returns table(
  id uuid, amount numeric, status text, created_at timestamptz,
  referrer_email text, referred_email text
) language plpgsql security definer set search_path = public, auth as $$
begin
  if not exists (select 1 from profiles where id = auth.uid() and role = 'admin') then
    raise exception 'forbidden';
  end if;
  return query
    select rc.id, rc.amount, rc.status, rc.created_at,
           ur.email::text, ud.email::text
    from referral_commissions rc
    left join auth.users ur on ur.id = rc.referrer_id
    left join auth.users ud on ud.id = rc.referred_user_id
    order by (rc.status = 'paid'), rc.created_at desc;
end $$;
grant execute on function public.referral_admin_list() to authenticated;
