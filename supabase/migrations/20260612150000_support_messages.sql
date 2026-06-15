-- ═══════════════════════════════════════════════════════════════════
--  Чат ученика с автором курса (поддержка).
--  Один диалог на ученика: все сообщения с его user_id.
--  sender: 'student' (пишет ученик) | 'owner' (отвечает автор/админ).
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.support_messages (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  sender     text not null check (sender in ('student', 'owner')),
  user_name  text,                       -- имя ученика (для списка диалогов у админа)
  text       text not null,
  is_read    boolean not null default false,
  created_at timestamptz default now()
);

create index if not exists support_messages_user_idx
  on public.support_messages (user_id, created_at);

alter table public.support_messages enable row level security;

-- читать: свои сообщения или админ — все
drop policy if exists "sm_read" on public.support_messages;
create policy "sm_read" on public.support_messages
  for select using (
    user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- писать: ученик — в свой диалог от имени student; админ — в любой от имени owner
drop policy if exists "sm_insert" on public.support_messages;
create policy "sm_insert" on public.support_messages
  for insert with check (
    (user_id = auth.uid() and sender = 'student')
    or (
      sender = 'owner'
      and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    )
  );

-- отмечать прочитанным: участники диалога
drop policy if exists "sm_update" on public.support_messages;
create policy "sm_update" on public.support_messages
  for update using (
    user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );
