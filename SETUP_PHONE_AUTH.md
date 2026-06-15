# Вход по номеру телефона (SMS-код) — настройка

Российский способ авторизации вместо иностранного OAuth (149-ФЗ). Код приходит по SMS через российский сервис **SMS.RU**. Supabase отвечает за сам OTP, доставку SMS делает наша Edge Function `send-sms` (Send SMS Hook).

## Что уже в коде
- Фронт: `src/AuthScreen.jsx` — переключатель «По телефону / По email», ввод номера → код → вход.
- Хелперы: `src/supabase.js` — `sendPhoneCode`, `verifyPhoneCode`, `normalizePhone`.
- Доставка SMS: `supabase/functions/send-sms/index.ts` (через SMS.RU, с проверкой подписи хука).

## Шаг 1. Аккаунт SMS.RU
1. Зарегистрируйся на https://sms.ru, пополни баланс.
2. Личный кабинет → возьми **api_id**.
3. (Необязательно) согласуй имя отправителя, иначе придёт с общего номера.

## Шаг 2. Включить вход по телефону в Supabase
Dashboard → **Authentication → Sign In / Providers → Phone**:
- включи **Phone**;
- включи **Enable phone signups** (чтобы новые номера регистрировались);
- встроенного SMS-провайдера (Twilio и т.п.) выбирать НЕ нужно — доставку берёт наш хук.

## Шаг 3. Подключить Send SMS Hook
Dashboard → **Authentication → Hooks → Send SMS hook**:
- включи хук, тип **HTTPS**, укажи URL функции:
  `https://<project-ref>.supabase.co/functions/v1/send-sms`
- скопируй **секрет хука** (вид `v1,whsec_...`) — понадобится ниже.

## Шаг 4. Секреты и деплой функции
В терминале (каждая команда отдельной строкой, без `#`-комментариев):
```bash
cd ~/progressly
supabase secrets set SMS_RU_API_ID="ВАШ_API_ID"
supabase secrets set SEND_SMS_HOOK_SECRET="v1,whsec_ВАШ_СЕКРЕТ"
supabase functions deploy send-sms --no-verify-jwt
```
`--no-verify-jwt` обязателен: хук вызывает функцию без пользовательского токена.

## Шаг 5. Выкатить фронт
```bash
cd ~/progressly
rm -f .git/index.lock
git add src/AuthScreen.jsx src/supabase.js supabase/functions/send-sms/index.ts SETUP_PHONE_AUTH.md
git commit -m "Вход по номеру телефона (SMS-код через SMS.RU)"
git push
```

## Шаг 6. Проверка
Открой сайт → «По телефону» → введи свой номер → получи SMS → введи код → войдёшь.

## Возможный нюанс с профилем
Если у тебя есть триггер, создающий строку в `profiles` из `auth.users` по email, — для телефонных аккаунтов email пустой. Проверь, что триггер не падает на NULL email (имя для телефонных пользователей берётся из метаданных `full_name`, переданных при регистрации; можно дать пользователю задать имя в кабинете позже).

## Безопасность
Функция проверяет подпись хука (`SEND_SMS_HOOK_SECRET`) — без верного секрета чужой запрос на отправку SMS не пройдёт. Не коммить api_id и секреты, держи их только в Supabase secrets.
