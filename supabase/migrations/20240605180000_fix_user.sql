-- Устанавливаем путь поиска, чтобы найти crypt и gen_salt
SET search_path TO extensions, public;

-- Удаляем триггер и функцию навсегда (пока)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user CASCADE;

-- Удаляем проблемного пользователя
DELETE FROM auth.users WHERE email = 'test-student@yandex.ru';

-- Создаём нового пользователя с гарантированно правильным паролем
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_user_meta_data
)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'test-student@yandex.ru',
  extensions.crypt('Test123456', extensions.gen_salt('bf')),
  now(),
  '{"role":"student","full_name":"Тестовый Ученик"}'
);
