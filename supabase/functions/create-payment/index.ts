// ═══════════════════════════════════════════════════════════════════
//  create-payment — создание платежа ЮKassa для покупки курса.
//
//  Вызывается клиентом (с JWT авторизованного пользователя):
//    supabase.functions.invoke("create-payment", { body: { course_slug } })
//  Возвращает { url } — страница оплаты ЮKassa для redirect.
//
//  Секреты (supabase secrets set ...):
//    YOOKASSA_SHOP_ID     — shopId магазина ЮKassa
//    YOOKASSA_SECRET_KEY  — секретный ключ ЮKassa
//    SITE_URL             — адрес сайта для возврата после оплаты
//
//  Для самозанятых ЮKassa сама передаёт данные о доходе в «Мой налог» —
//  отдельный объект receipt не требуется.
// ═══════════════════════════════════════════════════════════════════

import { createClient } from "npm:@supabase/supabase-js@2";

// Цены берутся из БД (catalog_courses) — менять можно без передеплоя.
// Фолбэк на случай, если таблица каталога ещё не создана.
const FALLBACK_COURSES: Record<string, { title: string; amount: string }> = {
  informatics: {
    title: "Доступ к онлайн-курсу «Информатика ЕГЭ 2026: все 27 заданий»",
    amount: "5200.00",
  },
  russian: {
    title: "Доступ к онлайн-курсу «Русский язык ЕГЭ 2026: все 27 заданий и сочинение»",
    amount: "4000.00",
  },
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const { course_slug } = await req.json();
    if (!course_slug) return json({ error: "Неизвестный курс" }, 400);

    // Пользователь из JWT
    const authHeader = req.headers.get("Authorization") ?? "";
    const supaUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      // Новый publishable-ключ из секретов; фолбэк — авто-подставляемый legacy anon
      (Deno.env.get("PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY"))!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await supaUser.auth.getUser();
    if (!user) return json({ error: "Войдите в аккаунт" }, 401);

    // Серверный ключ: приоритет — новый sb_secret из секретов (SERVICE_ROLE_KEY),
    // фолбэк — авто-подставляемый legacy service_role (пока он не отключён).
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      (Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))!,
    );

    // Цена и название — из каталога в БД (или из фолбэка)
    let course = FALLBACK_COURSES[course_slug] ?? null;
    const { data: row } = await admin
      .from("catalog_courses")
      .select("title, price")
      .eq("slug", course_slug)
      .eq("is_published", true)
      .maybeSingle();
    if (row) {
      course = {
        title: `Доступ к онлайн-курсу «${row.title}»`,
        amount: Number(row.price).toFixed(2),
      };
    }
    if (!course) return json({ error: "Неизвестный курс" }, 400);

    // Уже куплен?
    const { data: existing } = await admin
      .from("course_access")
      .select("course_slug")
      .eq("user_id", user.id)
      .eq("course_slug", course_slug)
      .maybeSingle();
    if (existing) return json({ already: true });

    // Заказ
    const { data: order, error: orderErr } = await admin
      .from("course_orders")
      .insert({ user_id: user.id, course_slug, amount: course.amount })
      .select()
      .single();
    if (orderErr) return json({ error: orderErr.message }, 500);

    // Платёж в ЮKassa
    const shopId = Deno.env.get("YOOKASSA_SHOP_ID");
    const secret = Deno.env.get("YOOKASSA_SECRET_KEY");
    if (!shopId || !secret) return json({ error: "Оплата ещё не настроена (нет ключей ЮKassa)" }, 503);
    const siteUrl = Deno.env.get("SITE_URL") ?? "http://localhost:5173";

    const ykRes = await fetch("https://api.yookassa.ru/v3/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotence-Key": order.id,
        Authorization: "Basic " + btoa(`${shopId}:${secret}`),
      },
      body: JSON.stringify({
        amount: { value: course.amount, currency: "RUB" },
        capture: true,
        confirmation: { type: "redirect", return_url: `${siteUrl}/?payment=pending` },
        description: course.title,
        metadata: { order_id: order.id, user_id: user.id, course_slug },
      }),
    });
    const payment = await ykRes.json();

    if (!ykRes.ok || !payment?.confirmation?.confirmation_url) {
      await admin.from("course_orders").update({ status: "failed" }).eq("id", order.id);
      return json({ error: payment?.description || "Не удалось создать платёж" }, 502);
    }

    await admin.from("course_orders").update({ yk_payment_id: payment.id }).eq("id", order.id);
    return json({ url: payment.confirmation.confirmation_url });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
