-- ═══════════════════════════════════════════════════════════════════
--  score_log — журнал баллов ученика (пробники и т.п.), кросс-девайс.
--  Ученик сам ведёт свои записи (insert/select/update/delete своих).
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.score_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  course_slug text default 'russian',
  kind        text not null default 'mock',  -- mock (пробник) | other
  value       numeric not null,
  max_value   numeric not null default 50,
  note        text,
  taken_at    date not null default current_date,
  created_at  timestamptz default now()
);

create index if not exists score_log_user_idx on public.score_log (user_id, taken_at);

alter table public.score_log enable row level security;

drop policy if exists "score_log_own" on public.score_log;
create policy "score_log_own" on public.score_log
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
