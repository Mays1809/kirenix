# api.kirenix.ru — прокси для Supabase (обход блокировки Cloudflare в РФ)

## Зачем
API Supabase (`bgidvsfjnpitiosiwjar.supabase.co`) стоит за **Cloudflare**, а его в России
душит РКН (`ERR_CONNECTION_RESET`, запросы по 20+ сек, вход не проходит). Сайт грузится
(он на GitHub Pages, не за Cloudflare), а вот вход/данные — нет.

Решение: поднять свой поддомен **`api.kirenix.ru`** на VPS с «чистым» (не-Cloudflare) IP.
Браузер ученика стучится на этот адрес, а сервер незаметно переправляет всё в Supabase.
В приложении меняем один адрес — и всё.

```
Браузер ученика ──HTTPS──▶ api.kirenix.ru (твой VPS) ──HTTPS──▶ ...supabase.co
   (чистый IP, РКН не режет)                              (это уже сервер→сервер)
```

---

## Что нужно
1. VPS на Ubuntu 22.04/24.04 (самый дешёвый тариф, ~200–400 ₽/мес).
2. Доступ к DNS домена `kirenix.ru` (reg.ru — уже есть).
3. ~30–40 минут.

**Где брать VPS — БЕСПЛАТНО (рекомендую для старта):**
- **Oracle Cloud — Always Free.** Даёт VPS бесплатно НАВСЕГДА (не триал). При регистрации
  просят карту только для проверки — деньги не списывают, выбирай «Always Free» ресурсы.
  Бери образ **Ubuntu 22.04**, shape из категории *Always Free* (ARM Ampere или AMD micro).
  Сервер зарубежный с «чистым» IP — это как раз то, что нужно: до Supabase (Cloudflare) он
  ходит без российского фильтра, а ученики достучатся до самого сервера.

**Платно, если хочется попроще (~150–300 ₽/мес):** Timeweb Cloud, Selectel, Aeza, RuVDS —
российский Ubuntu-VPS, минимальный тариф.

В любом случае: запиши **IP-адрес** сервера и доступ (пароль root или SSH-ключ). Дальше
инструкция одинаковая.

---

## Шаг 1. DNS: направить api.kirenix.ru на VPS
В reg.ru → зона `kirenix.ru` → добавь запись:
- Тип `A`, имя `api`, значение `IP-адрес твоего VPS`.

(Апекс `@` и `www` не трогай — они на GitHub Pages.)

## Шаг 2. Зайти на сервер и поставить nginx
Подключись по SSH (с Mac — приложение «Терминал»):
```
ssh root@IP_АДРЕС_VPS
```
Дальше на сервере:
```
apt update && apt -y upgrade
apt -y install nginx certbot python3-certbot-nginx
```

## Шаг 3. Конфиг nginx (прокси в Supabase)
Создай файл конфигурации:
```
nano /etc/nginx/sites-available/kirenix-api
```
Вставь это целиком:
```nginx
map $http_upgrade $connection_upgrade { default upgrade; '' close; }

server {
    listen 80;
    server_name api.kirenix.ru;

    # чтобы большие сочинения/ответы проходили
    client_max_body_size 25m;

    location / {
        proxy_pass https://bgidvsfjnpitiosiwjar.supabase.co;
        proxy_http_version 1.1;

        # Supabase маршрутизирует по этому имени — обязательно
        proxy_set_header Host bgidvsfjnpitiosiwjar.supabase.co;
        proxy_ssl_server_name on;
        proxy_ssl_name bgidvsfjnpitiosiwjar.supabase.co;

        # вебсокеты (realtime: чат/уведомления)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;

        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_connect_timeout 30s;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
}
```
Сохрани (Ctrl+O, Enter, Ctrl+X). Включи конфиг и проверь:
```
ln -s /etc/nginx/sites-available/kirenix-api /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

## Шаг 4. SSL-сертификат (бесплатный, Let's Encrypt)
> Сначала убедись, что DNS из Шага 1 уже разошёлся (на сервере: `ping api.kirenix.ru`
> должен показывать IP твоего VPS). Потом:
```
certbot --nginx -d api.kirenix.ru
```
Ответь на пару вопросов (email; согласие; выбери редирект на HTTPS). Certbot сам впишет
SSL в конфиг.

## Шаг 5. Проверка
Открой в браузере:
```
https://api.kirenix.ru/auth/v1/health
```
Должен показать текст (вроде `{"date":...,"description":"GoTrue is a..."}`) — значит прокси
работает и Supabase отвечает через твой домен.

## Шаг 6. Переключить приложение на прокси
Это сделаю я в коде: поменяю адрес Supabase на `https://api.kirenix.ru`. Тебе после этого —
`git push`, и всё. (Ключ Supabase не меняется. Вебхук ЮKassa остаётся на родном
`...supabase.co` — он сервер-серверный, его РКН не касается.)

---

## Если после Шага 5 health тоже висит/медленный
Значит твой РОССИЙСКИЙ VPS тоже плохо ходит до Cloudflare. Тогда берём VPS **за пределами
РФ** с чистым IP (например, в Казахстане/Финляндии/Нидерландах у провайдеров с хорошим
пирингом на Россию) — у него связь с Supabase будет чистой, а ученики достучатся до самого
VPS. Конфиг тот же. Напиши мне — подскажу провайдеров и проверим.
