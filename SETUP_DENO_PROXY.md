# Прокси Supabase на Deno Deploy (бесплатно, без карты, из РФ)

Зачем: Supabase стоит за Cloudflare, который РКН в РФ душит → вход «то работает, то нет».
Прокси на Deno Deploy даёт чистый адрес: браузер ученика стучится на `*.deno.dev`, а тот
переправляет всё в Supabase мимо фильтра. Deno Deploy — бесплатный, регистрация через
GitHub, **карта не нужна**.

---

## Шаг 1. Аккаунт Deno Deploy
1. Открой **https://deno.com/deploy** → **Sign in / Get started** → войти через **GitHub**
   (если нет GitHub — у тебя он есть, репозиторий kirenix там же).
2. Карту не просят.

## Шаг 2. Создать проект и вставить прокси
1. **New Project** → выбери **Playground** (пустой проект с редактором кода).
2. Удали пример, вставь **этот код целиком**:

```ts
const UPSTREAM_HOST = "bgidvsfjnpitiosiwjar.supabase.co";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-api-version, accept-profile, content-profile, prefer, range, x-requested-with",
  "Access-Control-Expose-Headers": "content-range, content-encoding",
  "Access-Control-Max-Age": "86400",
};

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  const target = `https://${UPSTREAM_HOST}${url.pathname}${url.search}`;

  if (req.headers.get("upgrade")?.toLowerCase() === "websocket") {
    const { socket: client, response } = Deno.upgradeWebSocket(req);
    const up = new WebSocket(target.replace(/^http/, "ws"));
    const queue: unknown[] = [];
    up.onopen = () => { while (queue.length) up.send(queue.shift() as string); };
    client.onmessage = (e) => up.readyState === WebSocket.OPEN ? up.send(e.data) : queue.push(e.data);
    up.onmessage = (e) => { try { client.send(e.data); } catch (_) {} };
    const close = () => { try { up.close(); } catch (_) {} try { client.close(); } catch (_) {} };
    client.onclose = close; up.onclose = close; client.onerror = close; up.onerror = close;
    return response;
  }

  const headers = new Headers(req.headers);
  headers.set("host", UPSTREAM_HOST);
  const hasBody = !["GET", "HEAD"].includes(req.method);
  try {
    const resp = await fetch(target, {
      method: req.method, headers,
      body: hasBody ? await req.arrayBuffer() : undefined,
      redirect: "manual",
    });
    const h = new Headers(resp.headers);
    for (const k in CORS) h.set(k, CORS[k]);
    return new Response(resp.body, { status: resp.status, headers: h });
  } catch (e) {
    return new Response(JSON.stringify({ error: "proxy_failed", detail: String(e) }), {
      status: 502, headers: { ...CORS, "content-type": "application/json" },
    });
  }
});
```

3. Нажми **Save & Deploy**.

## Шаг 3. Забрать адрес и проверить
1. Deno даст адрес вида **`https://что-то.deno.dev`** — скопируй его.
2. Проверь в браузере (без VPN): открой `https://что-то.deno.dev/auth/v1/health`
   — должен показать текст про **GoTrue** (значит прокси работает и ходит в Supabase).

## Шаг 4. Переключить приложение на прокси
Пришли мне этот `*.deno.dev` адрес — я поменяю один адрес Supabase в коде
(`src/supabase.js`), ты сделаешь `git push`, и вход пойдёт через прокси у всех учеников.
Ключ Supabase и вебхук ЮKassa не меняются.

---

### Заметки
- Если позже захочешь красивый адрес — можно привязать к проекту Deno свой
  `api.kirenix.ru` (Settings → Domains), но и `*.deno.dev` работает.
- Бесплатного лимита Deno Deploy с запасом хватает для старта.
- Если вдруг `*.deno.dev` в РФ не открывается — напиши, тогда вернёмся к дешёвому
  российскому VPS.
