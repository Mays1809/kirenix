-- ═══════════════════════════════════════════════════════════════════
--  Фикс внешнего ключа student_profiles → auth.users
--  Ошибка: insert or update on table "student_profiles" violates
--  foreign key constraint "student_profiles_id_fkey".
--  Причина: student_profiles.id ссылался на таблицу, где нет строки для
--  текущего пользователя (например profiles/students — админ туда не
--  добавлен). medal_data — это данные НА ПОЛЬЗОВАТЕЛЯ, поэтому FK должен
--  указывать на auth.users(id): тогда upsert работает для любого
--  залогиненного пользователя (и ученика, и владельца-админа).
-- ═══════════════════════════════════════════════════════════════════

-- Убираем «осиротевшие» строки (id без реального пользователя), иначе
-- новый внешний ключ не создастся.
delete from public.student_profiles sp
where not exists (select 1 from auth.users u where u.id = sp.id);

alter table public.student_profiles
  drop constraint if exists student_profiles_id_fkey;

alter table public.student_profiles
  add constraint student_profiles_id_fkey
  foreign key (id) references auth.users(id) on delete cascade;
