// ═══════════════════════════════════════════════════════════════════
//  send-sms — Supabase «Send SMS Hook».
//  Supabase вызывает эту функцию, когда нужно отправить код входа по SMS.
//  Мы доставляем код через РОССИЙСКИЙ сервис SMS.RU (149-ФЗ: средства
//  авторизации российских пользователей — российские).
//
//  Секреты (supabase secrets set ...):
//    SMS_RU_API_ID          — api_id из личного кабинета sms.ru
//    SEND_SMS_HOOK_SECRET   — секрет хука из Supabase (v1,whsec_...), для проверки подписи
//    SMS_SENDER (необяз.)   — одобренное имя отправителя в sms.ru
//
//  Подключение: Supabase Dashboard → Authentication → Hooks → Send SMS Hook
//  → выбрать эту функцию. Деплой: supabase functions deploy send-sms --no-verify-jwt
// ═══════════════════════════════════════════════════════════════════

const b64ToBytes = (b64: string) =>
  Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const bytesToB64 = (buf: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buf)));

// Проверка подписи Standard Webhooks (как у Supabase Auth Hooks)
async function verifySignature(secret: string, headers: Headers, body: string): Promise<boolean> {
  try {
    const id = headers.get("webhook-id") ?? "";
    const ts = headers.get("webhook-timestamp") ?? "";
    const sigHeader = headers.get("webhook-signature") ?? "";
    const whsec = secret.replace(/^v1,?/, "").replace(/^whsec_/, "");
    const key = await crypto.subtle.importKey(
      "raw", b64ToBytes(whsec), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
    );
    const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${ts}.${body}`));
    const expected = bytesToB64(mac);
    return sigHeader.split(" ").some((p) => p.split(",")[1] === expected);
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

  const apiId = Deno.env.get("SMS_RU_API_ID");
  if (!apiId) {
    return new Response(JSON.stringify({ error: { http_code: 500, message: "SMS_RU_API_ID не задан" } }),
      { status: 500, headers: { "Content-Type": "application/json" } });
  }

  const body = await req.text();

  // Проверка подписи (если задан секрет хука)
  const hookSecret = Deno.env.get("SEND_SMS_HOOK_SECRET");
  if (hookSecret) {
    const ok = await verifySignature(hookSecret, req.headers, body);
    if (!ok) return new Response(JSON.stringify({ error: { http_code: 401, message: "bad signature" } }),
      { status: 401, headers: { "Content-Type": "application/json" } });
  }

  let phone = "", otp = "";
  try {
    const payload = JSON.parse(body);
    phone = (payload.user?.phone ?? "").replace(/\D/g, "");
    otp = payload.sms?.otp ?? "";
  } catch {
    return new Response(JSON.stringify({ error: { http_code: 400, message: "bad payload" } }),
      { status: 400, headers: { "Content-Type": "application/json" } });
  }
  if (!phone || !otp) {
    return new Response(JSON.stringify({ error: { http_code: 400, message: "no phone/otp" } }),
      { status: 400, headers: { "Content-Type": "application/json" } });
  }

  // Отправка через SMS.RU
  const text = `Код для входа в Kirenix: ${otp}. Никому не сообщайте этот код.`;
  const url = new URL("https://sms.ru/sms/send");
  url.searchParams.set("api_id", apiId);
  url.searchParams.set("to", phone);
  url.searchParams.set("msg", text);
  url.searchParams.set("json", "1");
  const sender = Deno.env.get("SMS_SENDER");
  if (sender) url.searchParams.set("from", sender);

  try {
    const res = await fetch(url.toString());
    const data = await res.json();
    if (data?.status !== "OK") {
      const msg = data?.status_text || JSON.stringify(data);
      return new Response(JSON.stringify({ error: { http_code: 502, message: `SMS.RU: ${msg}` } }),
        { status: 502, headers: { "Content-Type": "application/json" } });
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: { http_code: 502, message: String(e) } }),
      { status: 502, headers: { "Content-Type": "application/json" } });
  }

  return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
});
