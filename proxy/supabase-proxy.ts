// ═══════════════════════════════════════════════════════════════════
//  Прокси Supabase для Deno Deploy (обход блокировки Cloudflare в РФ).
//  Деплоится на Deno Deploy (бесплатно, без карты). Пересылает все
//  запросы браузера в Supabase: auth, REST, функции и realtime (websocket).
//  В приложении адрес Supabase меняется на URL этого прокси (*.deno.dev).
// ═══════════════════════════════════════════════════════════════════

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

  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  const target = `https://${UPSTREAM_HOST}${url.pathname}${url.search}`;

  // ── Realtime: проксируем websocket ──
  if (req.headers.get("upgrade")?.toLowerCase() === "websocket") {
    const { socket: client, response } = Deno.upgradeWebSocket(req);
    const up = new WebSocket(target.replace(/^http/, "ws"));
    const queue: unknown[] = [];
    up.onopen = () => { while (queue.length) up.send(queue.shift() as string); };
    client.onmessage = (e) =>
      up.readyState === WebSocket.OPEN ? up.send(e.data) : queue.push(e.data);
    up.onmessage = (e) => { try { client.send(e.data); } catch (_) { /* ignore */ } };
    const close = () => {
      try { up.close(); } catch (_) { /* ignore */ }
      try { client.close(); } catch (_) { /* ignore */ }
    };
    client.onclose = close; up.onclose = close;
    client.onerror = close; up.onerror = close;
    return response;
  }

  // ── Обычный HTTP: auth / REST / functions ──
  const headers = new Headers(req.headers);
  headers.set("host", UPSTREAM_HOST);
  const hasBody = !["GET", "HEAD"].includes(req.method);
  try {
    const resp = await fetch(target, {
      method: req.method,
      headers,
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
