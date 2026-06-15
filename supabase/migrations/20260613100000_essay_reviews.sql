-- ═══════════════════════════════════════════════════════════════════
--  Проверки сочинений: «автор в петле» (ИИ + живой автор).
--  Ученик проверяет сочинение ИИ (К1–К10) → запись сохраняется →
--  может отправить автору → автор выставляет финальный балл и комментарий.
-- ═══════════════════════════════════════════════════════════════════

-- В БД уже могла остаться таблица essay_reviews другой структуры
-- (от прежней попытки) — пересоздаём корректно. Данных в ней нет.
drop table if exists public.essay_reviews cascade;

create table if not exists public.essay_reviews (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  course_slug    text not null default 'russian',
  lesson_id      uuid references public.course_lessons(id) on delete set null,
  source_text    text,
  essay          text not null,
  word_count     int,
  ai_feedback    text,                       -- разбор ИИ (markdown)
  ai_balls       int,                        -- балл ИИ (из 22)
  status         text not null default 'ai', -- ai | pending | reviewed
  author_balls   int,                        -- финальный балл автора
  author_comment text,                       -- комментарий автора
  reviewer_id    uuid references auth.users(id) on delete set null,
  created_at     timestamptz default now(),
  reviewed_at    timestamptz
);

create index if not exists essay_reviews_user_idx   on public.essay_reviews (user_id, created_at desc);
create index if not exists essay_reviews_status_idx on public.essay_reviews (status, created_at);

alter table public.essay_reviews enable row level security;

-- Чтение: ученик — свои; админ (автор) — все
drop policy if exists "essay_reviews_read" on public.essay_reviews;
create policy "essay_reviews_read" on public.essay_reviews
  for select using (
    user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- Прямые insert/update/delete клиентам запрещены: только через service_role
-- (Edge Function сохраняет проверку) и через RPC ниже.

-- ── RPC: ученик просит автора проверить свою работу ──
create or replace function public.request_essay_review(p_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.essay_reviews
     set status = 'pending'
   where id = p_id and user_id = auth.uid() and status = 'ai';
$$;
grant execute on function public.request_essay_review(uuid) to authenticated;

-- ── RPC: автор (admin) выставляет вердикт ──
create or replace function public.review_essay(p_id uuid, p_balls int, p_comment text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    raise exception 'Только автор курса может проверять сочинения';
  end if;
  update public.essay_reviews
     set author_balls   = greatest(0, least(22, coalesce(p_balls, 0))),
         author_comment = p_comment,
         status         = 'reviewed',
         reviewer_id    = auth.uid(),
         reviewed_at    = now()
   where id = p_id;
end; $$;
grant execute on function public.review_essay(uuid, int, text) to authenticated;
