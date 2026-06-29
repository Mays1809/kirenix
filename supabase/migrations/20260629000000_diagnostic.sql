-- ═══════════════════════════════════════════════════════════════════
--  Диагностика уровня → индивидуальный путь.
--  Одна строка на (пользователь, курс): mastery = { "<номер модуля>": "known" | "weak" }.
--  Применить в Supabase → SQL Editor.
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.diagnostic_results (
  user_id     uuid        not null references auth.users(id) on delete cascade,
  course_slug text        not null,
  mastery     jsonb       not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  primary key (user_id, course_slug)
);

alter table public.diagnostic_results enable row level security;

-- Каждый видит и меняет только свои результаты
drop policy if exists "diag_select_own" on public.diagnostic_results;
create policy "diag_select_own" on public.diagnostic_results
  for select using (auth.uid() = user_id);

drop policy if exists "diag_insert_own" on public.diagnostic_results;
create policy "diag_insert_own" on public.diagnostic_results
  for insert with check (auth.uid() = user_id);

drop policy if exists "diag_update_own" on public.diagnostic_results;
create policy "diag_update_own" on public.diagnostic_results
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
