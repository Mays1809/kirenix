-- ═══════════════════════════════════════════════════════════════════
--  RLS для public.student_profiles
--  Чинит ошибку при сохранении медального трекера:
--    "new row violates row-level security policy for table student_profiles"
--  Причина: на таблице включён RLS, но НЕТ INSERT-политики, а трекер
--  сохраняет через upsert (INSERT ... ON CONFLICT). Добавляем политики
--  «только своя строка» (id = auth.uid()) на select/insert/update.
--  Идемпотентно: drop policy if exists перед create.
-- ═══════════════════════════════════════════════════════════════════

alter table public.student_profiles enable row level security;

drop policy if exists "sp_select_own" on public.student_profiles;
create policy "sp_select_own" on public.student_profiles
  for select using (id = auth.uid());

drop policy if exists "sp_insert_own" on public.student_profiles;
create policy "sp_insert_own" on public.student_profiles
  for insert with check (id = auth.uid());

drop policy if exists "sp_update_own" on public.student_profiles;
create policy "sp_update_own" on public.student_profiles
  for update using (id = auth.uid()) with check (id = auth.uid());
