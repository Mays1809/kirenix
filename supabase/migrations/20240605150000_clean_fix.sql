-- Отключаем проблемный триггер
ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;

-- Обновляем пароль и подтверждаем email (на случай, если данные повреждены)
UPDATE auth.users
SET
  encrypted_password = extensions.crypt('Test123456', extensions.gen_salt('bf')),
  email_confirmed_at = now()
WHERE email = 'test-student@yandex.ru';
