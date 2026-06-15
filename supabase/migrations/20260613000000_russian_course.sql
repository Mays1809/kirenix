-- ═══════════════════════════════════════════════════════════════════
--  Курс «Русский язык ЕГЭ 2026» — каталог и доступ владельца.
--  Контент уроков (модули/уроки) грузится отдельно сид-скриптом:
--    SUPABASE_SERVICE_ROLE_KEY="eyJ..." node scripts/seed_russian.mjs
--  Таблицы catalog_courses / course_access / course_lessons уже созданы
--  предыдущими миграциями (paywall + catalog).
-- ═══════════════════════════════════════════════════════════════════

-- 1. Карточка курса в каталоге (цена 4000 ₽, «старая» цена 5900 ₽ — скидка)
insert into public.catalog_courses
  (slug, content_id, title, subject, icon, color, price, original_price,
   duration, lessons_count, level, format, tags, short_desc,
   teacher_name, teacher_avatar, school_name, is_published, sort_order)
values (
  'russian', 'russian',
  'Русский язык ЕГЭ 2026: все 27 заданий и сочинение',
  'Русский язык', '📝', '#e11d48',
  4000, 5900, '60 ч', 35,
  'intermediate', 'text',
  '["8 модулей","Все 27 заданий","Сочинение на 22 балла","По ФИПИ 2026"]'::jsonb,
  'Полный текстовый курс: теория, разобранные примеры, практика с ответами, шпаргалки. Орфоэпия, паронимы, орфография, пунктуация и сочинение по критериям К1–К10 ФИПИ 2026.',
  'Кирилл Шевелев', 'КШ', 'Авторский курс',
  true, 2
)
on conflict (slug) do update set
  content_id     = excluded.content_id,
  title          = excluded.title,
  subject        = excluded.subject,
  icon           = excluded.icon,
  color          = excluded.color,
  price          = excluded.price,
  original_price = excluded.original_price,
  duration       = excluded.duration,
  lessons_count  = excluded.lessons_count,
  level          = excluded.level,
  format         = excluded.format,
  tags           = excluded.tags,
  short_desc     = excluded.short_desc,
  teacher_name   = excluded.teacher_name,
  teacher_avatar = excluded.teacher_avatar,
  school_name    = excluded.school_name,
  is_published   = excluded.is_published,
  sort_order     = excluded.sort_order,
  updated_at     = now();

-- 2. Владельцу — ручной доступ к курсу (как у информатики)
insert into public.course_access (user_id, course_slug, source)
select id, 'russian', 'manual' from auth.users
where lower(email) = 'maysbad@gmail.com'
on conflict (user_id, course_slug) do nothing;
