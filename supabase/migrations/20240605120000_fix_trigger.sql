-- Временно отключаем проблемный триггер
ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;

-- Обновляем пароль тестовому ученику (если он существует)
UPDATE auth.users
SET
  encrypted_password = extensions.crypt('Test123456', extensions.gen_salt('bf')),
  email_confirmed_at = now()
WHERE email = 'test-student@yandex.ru';

-- Если пользователя нет, создаём его (вдруг он был удалён)
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data)
SELECT
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'test-student@yandex.ru',
  extensions.crypt('Test123456', extensions.gen_salt('bf')),
  now(),
  '{"role":"student","full_name":"Тестовый Ученик"}'
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'test-student@yandex.ru');

-- Включаем триггер обратно
ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;
