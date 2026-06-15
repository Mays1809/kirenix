// ═══════════════════════════════════════════════════════════════════
//  yookassa-webhook — приём уведомлений от ЮKassa.
//
//  Деплой БЕЗ проверки JWT (вебхук приходит от ЮKassa, не от юзера):
//    supabase functions deploy yookassa-webhook --no-verify-jwt
//
//  URL для ЛК ЮKassa (HTTP-уведомления). Включи события:
//    payment.succeeded, payment.canceled, refund.succeeded
//    https://<project-ref>.supabase.co/functions/v1/yookassa-webhook
//
//  Безопасность: телу запроса не доверяем — статус всегда перепроверяется
//  прямым запросом к API ЮKassa с ключами магазина.
//   • payment.succeeded → выдаём доступ к курсу
//   • refund.succeeded  → СНИМАЕМ доступ (возврат)
//   • payment.canceled  → помечаем заказ отменённым
// ═══════════════════════════════════════════════════════════════════

import { createClient } from "npm:@supabase/supabase-js@2";

const admin = () => createClient(
  Deno.env.get("SUPABASE_URL")!,
  (Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))!,
);

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");

  let body: { event?: string; object?: { id?: string; status?: string; payment_id?: string } };
  try {
    body = await req.json();
  } catch {
    return new Response("bad json", { status: 400 });
  }
  const event = body?.event ?? "";
  const obj = body?.object ?? {};

  const shopId = Deno.env.get("YOOKASSA_SHOP_ID");
  const secret = Deno.env.get("YOOKASSA_SECRET_KEY");
  if (!shopId || !secret) return new Response("not configured", { status: 503 });
  const auth = "Basic " + btoa(`${shopId}:${secret}`);

  // ───────── ВОЗВРАТ: снимаем доступ ─────────
  if (event.startsWith("refund.")) {
    const refundId = obj?.id;
    if (!refundId) return new Response("no refund id");
    const r = await fetch(`https://api.yookassa.ru/v3/refunds/${refundId}`, { headers: { Authorization: auth } });
    if (!r.ok) return new Response("verify failed", { status: 502 });
    const refund = await r.json();
    if (refund.status !== "succeeded") return new Response("ok");

    const db = admin();
    const { data: order } = await db
      .from("course_orders").select("*")
      .eq("yk_payment_id", refund.payment_id).maybeSingle();
    if (!order) return new Response("order not found");

    // удаляем только купленный доступ (ручной/админский не трогаем)
    await db.from("course_access").delete()
      .eq("user_id", order.user_id)
      .eq("course_slug", order.course_slug)
      .eq("source", "purchase");
    await db.from("course_orders").update({ status: "refunded" }).eq("id", order.id);
    return new Response("ok");
  }

  // ───────── ПЛАТЁЖ: payment.succeeded / canceled ─────────
  const paymentId = obj?.id;
  if (!paymentId) return new Response("no payment id", { status: 400 });

  const ykRes = await fetch(`https://api.yookassa.ru/v3/payments/${paymentId}`, { headers: { Authorization: auth } });
  if (!ykRes.ok) return new Response("verify failed", { status: 502 });
  const payment = await ykRes.json();

  const db = admin();
  const { data: order } = await db
    .from("course_orders").select("*")
    .eq("yk_payment_id", payment.id).maybeSingle();
  // 200, чтобы ЮKassa не ретраила чужие/старые платежи
  if (!order) return new Response("order not found");

  if (payment.status === "succeeded" && order.status !== "succeeded") {
    await db.from("course_orders")
      .update({ status: "succeeded", paid_at: new Date().toISOString() })
      .eq("id", order.id);
    await db.from("course_access").upsert(
      { user_id: order.user_id, course_slug: order.course_slug, source: "purchase", order_id: order.id },
      { onConflict: "user_id,course_slug" },
    );
  } else if (payment.status === "canceled" && order.status === "pending") {
    await db.from("course_orders").update({ status: "canceled" }).eq("id", order.id);
  }

  return new Response("ok");
});
