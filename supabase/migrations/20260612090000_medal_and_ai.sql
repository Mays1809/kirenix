-- ═══════════════════════════════════════════════════════════════════
--  Медальный трекер + AI-репетитор
-- ═══════════════════════════════════════════════════════════════════

-- Оценки и цели для медального трекера (один jsonb со всем):
-- { grades10: {Предмет: 3|4|5}, grades11: {...},
--   ege: { rus: 0-100, mathType: 'profile'|'base', math: 0-100, mathBase: 3|4|5 } }
alter table if exists public.student_profiles
  add column if not exists medal_data jsonb;

-- Счётчик вопросов к AI-репетитору (пишет только сервер)
create table if not exists public.ai_tutor_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day     date not null default current_date,
  used    int  not null default 0,
  primary key (user_id, day)
);
alter table public.ai_tutor_usage enable row level security;
-- Свои лимиты видеть можно, менять — только service_role
drop policy if exists "ai_usage_own_read" on public.ai_tutor_usage;
create policy "ai_usage_own_read" on public.ai_tutor_usage
  for select using (user_id = auth.uid());
