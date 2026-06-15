// ═══════════════════════════════════════════════════════════════════
//  ai-tutor — AI-репетитор в уроках + проверка сочинения ЕГЭ.
//
//  Клиент: supabase.functions.invoke("ai-tutor", { body })
//   • Чат по уроку:    { lesson_id, mode?: "chat", question, history }
//   • Проверка сочинения (задание 27, русский):
//                       { lesson_id, mode: "essay", essay, source_text? }
//   • Проверка развёрнутого ответа по заданию:
//                       { lesson_id, mode: "answer", answer, task }
//  Возвращает { answer, balls?, remaining } | { error }.
//
//  Правила доступа: вопрос/проверка — по бесплатному уроку или по
//  купленному курсу; чужие платные уроки нельзя. Лимит 25/день (админ — без).
//
//  Провайдер ИИ — секретами (любой ОДИН):
//   • Groq (бесплатно):  supabase secrets set AI_API_KEY="gsk_..."
//   • Anthropic:         supabase secrets set ANTHROPIC_API_KEY="sk-ant-..."
//  Деплой: supabase functions deploy ai-tutor
// ═══════════════════════════════════════════════════════════════════

import { createClient } from "npm:@supabase/supabase-js@2";

const DAILY_LIMIT = 25;
const FREE_ESSAY_LIMIT = 1; // бесплатных проверок сочинения на аккаунт (лид-магнит)
const ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";

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

const wordCount = (s: string) =>
  (s.trim().match(/[^\s]+/g) || []).length;

// ── Критерии оценивания сочинения (задание 27, ЕГЭ 2026) ──
const ESSAY_RUBRIC = `
КРИТЕРИИ ОЦЕНИВАНИЯ СОЧИНЕНИЯ (задание 27, ЕГЭ 2026, максимум 22 балла):
К1 — Позиция автора по проблеме: 1 балл (верно сформулирована) / 0.
   ВАЖНО: если К1 = 0 (позиция не сформулирована или неверна), то К2 и К3 тоже 0.
К2 — Комментарий: до 3 баллов.
   3 = 2 примера-иллюстрации из текста + пояснение к КАЖДОМУ + указана смысловая связь + анализ связи.
   2 = 2 примера + пояснения, но связь не указана/не пояснена.
   1 = 1 пример + пояснение.
   0 = примеры без пояснений / пересказ / большое цитирование.
К3 — Своё отношение к позиции автора + обоснование: до 2 баллов.
   2 = отношение сформулировано И обосновано + есть пример-аргумент.
   1 = обосновано без примера, ИЛИ пример есть, но отношение формальное («согласен»).
   0 = только формально / нет. Нельзя как аргумент: комикс, аниме, манга, фанфик, графический роман, компьютерная игра.
К4 — Фактическая точность речи: 1 балл (нет фактических ошибок) / 0.
К5 — Логичность речи: 2 / 1 (1–2 ошибки) / 0 (≥3 ошибок).
К6 — Соблюдение этических норм: 1 / 0.
К7 — Орфография: 3 (0 ошибок) / 2 (1–2) / 1 (3–4) / 0 (≥5).
К8 — Пунктуация: 3 / 2 / 1 / 0 (те же пороги).
К9 — Грамматические нормы: 3 / 2 / 1 / 0.
К10 — Речевые нормы: 3 / 2 / 1 / 0.
ОБЪЁМ: меньше 150 слов — вся работа 0 баллов.`.trim();

async function callAI(system: string, msgs: { role: string; content: string }[], maxTokens: number) {
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  const openaiKey = Deno.env.get("AI_API_KEY");
  if (anthropicKey) {
    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ model: ANTHROPIC_MODEL, max_tokens: maxTokens, system, messages: msgs }),
    });
    const ai = await aiRes.json();
    if (!aiRes.ok) throw new Error(ai?.error?.message || "Сбой AI, попробуй ещё раз");
    return (ai.content || [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("\n");
  }
  const baseUrl = (Deno.env.get("AI_BASE_URL") ?? "https://api.groq.com/openai/v1").replace(/\/$/, "");
  const model = Deno.env.get("AI_MODEL") ?? "llama-3.3-70b-versatile";
  const aiRes = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
    body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: "system", content: system }, ...msgs] }),
  });
  const ai = await aiRes.json();
  if (!aiRes.ok) throw new Error(ai?.error?.message || "Сбой AI, попробуй ещё раз");
  return ai?.choices?.[0]?.message?.content ?? "";
}

// Проверка сочинения по К1–К10 → { answer, balls, words }
async function gradeEssay(essay: string, source: string) {
  const words = wordCount(essay);
  const system =
    `Ты — строгий, но доброжелательный эксперт ЕГЭ по русскому языку. ` +
    `Оцениваешь сочинение (задание 27) ТОЧНО по официальным критериям ФИПИ 2026. ` +
    `Не завышай и не занижай баллы, опирайся только на критерии.\n\n${ESSAY_RUBRIC}\n\n` +
    `ФОРМАТ ОТВЕТА (строго так, markdown):\n` +
    `Первая строка: «БАЛЛЫ: N/22» (N — сумма).\n` +
    `Затем таблица по критериям:\n` +
    `| Критерий | Балл | Комментарий |\n|---|---|---|\n` +
    `и строки К1…К10 (балл из максимума и КОНКРЕТНО, за что снято, с примерами из текста).\n` +
    `Затем «### ⚠️ Главное исправить» — 2–4 приоритетных пункта с конкретными правками (цитата ошибки → как надо).\n` +
    `Затем «### ✅ Что уже хорошо» — 1–3 пункта.\n` +
    `Если в сочинении меньше 150 слов — поставь 0 по всем критериям и объясни, что работа не засчитывается. ` +
    `Найди конкретные орфографические, пунктуационные, грамматические и речевые ошибки (цитируй фрагмент и давай исправление). ` +
    `Будь конкретным и полезным, без воды.`;
  const userMsg =
    (source ? `ИСХОДНЫЙ ТЕКСТ (по нему написано сочинение):\n${source}\n\n` : `(Исходный текст не приложен — оцени структуру, логику и грамотность; для К2 проверь наличие 2 примеров с пояснениями и связи.)\n\n`) +
    `СОЧИНЕНИЕ УЧЕНИКА (слов примерно ${words}):\n${essay}`;
  const answer = await callAI(system, [{ role: "user", content: userMsg }], 1800);
  const m = answer.match(/БАЛЛЫ:\s*(\d+)\s*\/\s*22/i);
  const balls = m ? Math.min(22, parseInt(m[1], 10)) : null;
  return { answer, balls, words };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const body = await req.json();
    const { lesson_id, mode = "chat" } = body;
    if (!lesson_id && !(mode === "essay" && body.free === true)) return json({ error: "Не указан урок" }, 400);

    // ── Валидация ввода по режиму ──
    if (mode === "chat" && !body.question?.trim()) return json({ error: "Пустой вопрос" }, 400);
    if (mode === "essay" && !body.essay?.trim()) return json({ error: "Вставь текст сочинения" }, 400);
    if (mode === "answer" && !body.answer?.trim()) return json({ error: "Вставь свой ответ" }, 400);

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    const openaiKey = Deno.env.get("AI_API_KEY");
    if (!anthropicKey && !openaiKey) {
      return json({ error: "AI ещё не подключён (нет AI_API_KEY)" }, 503);
    }

    /* ── Пользователь ── */
    const supaUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      (Deno.env.get("PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY"))!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
    );
    const { data: { user } } = await supaUser.auth.getUser();
    if (!user) return json({ error: "Войдите в аккаунт" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      (Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))!,
    );

    /* ════ БЕСПЛАТНАЯ ПРОВЕРКА СОЧИНЕНИЯ (лид-магнит, без покупки курса) ════ */
    if (mode === "essay" && body.free === true) {
      const { data: prof } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
      if (prof?.role !== "admin") {
        const { count } = await admin.from("essay_reviews")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id).is("lesson_id", null);
        if ((count ?? 0) >= FREE_ESSAY_LIMIT) {
          return json({ error: "Бесплатная проверка уже использована. Открой полный доступ к курсу — там безлимит проверок и личная проверка автором.", free_used: true }, 403);
        }
      }
      const essay = String(body.essay).slice(0, 8000);
      const source = String(body.source_text || "").slice(0, 9000);
      const { answer, balls, words } = await gradeEssay(essay, source);
      try {
        await admin.from("essay_reviews").insert({
          user_id: user.id, course_slug: "free", lesson_id: null,
          source_text: source || null, essay, word_count: words,
          ai_feedback: answer, ai_balls: balls, status: "ai",
        });
      } catch { /* не мешаем ответу */ }
      return json({ answer, balls, words, free: true });
    }

    /* ── Урок и право доступа ── */
    const { data: lesson } = await admin
      .from("course_lessons")
      .select("course_slug, title, num, is_free, body")
      .eq("id", lesson_id)
      .maybeSingle();
    if (!lesson) return json({ error: "Урок не найден" }, 404);

    const { data: profileRow } = await admin
      .from("profiles").select("role").eq("id", user.id).maybeSingle();
    const isAdmin = profileRow?.role === "admin";

    if (!lesson.is_free && !isAdmin) {
      const { data: access } = await admin
        .from("course_access")
        .select("course_slug")
        .eq("user_id", user.id)
        .eq("course_slug", lesson.course_slug)
        .maybeSingle();
      if (!access) return json({ error: "Доступно после покупки курса" }, 403);
    }

    /* ── Дневной лимит ── */
    let remaining = DAILY_LIMIT;
    if (!isAdmin) {
      const today = new Date().toISOString().slice(0, 10);
      const { data: usage } = await admin
        .from("ai_tutor_usage").select("used")
        .eq("user_id", user.id).eq("day", today).maybeSingle();
      const used = usage?.used ?? 0;
      if (used >= DAILY_LIMIT) {
        return json({ error: `Лимит ${DAILY_LIMIT} обращений в день исчерпан — продолжим завтра!` }, 429);
      }
      await admin.from("ai_tutor_usage").upsert(
        { user_id: user.id, day: today, used: used + 1 },
        { onConflict: "user_id,day" },
      );
      remaining = DAILY_LIMIT - used - 1;
    }

    /* ════════ РЕЖИМ: ПРОВЕРКА СОЧИНЕНИЯ (К1–К10) ════════ */
    if (mode === "essay") {
      const essay = String(body.essay).slice(0, 8000);
      const source = String(body.source_text || "").slice(0, 9000);
      const { answer, balls, words } = await gradeEssay(essay, source);

      // Сохраняем проверку для «автора в петле» (не критично для ответа)
      let review_id: string | null = null;
      try {
        const { data: review } = await admin.from("essay_reviews").insert({
          user_id: user.id, course_slug: lesson.course_slug, lesson_id,
          source_text: source || null, essay, word_count: words,
          ai_feedback: answer, ai_balls: balls, status: "ai",
        }).select("id").single();
        review_id = review?.id ?? null;
      } catch { /* таблицы может ещё не быть — не мешаем ученику */ }

      return json({ answer, balls, words, remaining, review_id });
    }

    /* ════════ РЕЖИМ: ПРОВЕРКА РАЗВЁРНУТОГО ОТВЕТА ════════ */
    if (mode === "answer") {
      const ans = String(body.answer).slice(0, 4000);
      const task = String(body.task || lesson.title || "").slice(0, 2000);
      const lessonContext = (lesson.body || "").slice(0, 8000);
      const system =
        `Ты — эксперт ЕГЭ по русскому языку. Проверь ответ ученика по заданию ниже, ` +
        `опираясь на материал урока и нормы ФИПИ 2026. Скажи: что верно, где ошибки (конкретно), ` +
        `как правильно и на что обратить внимание. По-русски, по делу, до ~350 слов.\n\n` +
        `ЗАДАНИЕ: ${task}\n\n=== МАТЕРИАЛ УРОКА ===\n${lessonContext}`;
      const answer = await callAI(system, [{ role: "user", content: `ОТВЕТ УЧЕНИКА:\n${ans}` }], 1100);
      return json({ answer, remaining });
    }

    /* ════════ РЕЖИМ: ЧАТ ПО УРОКУ (по умолчанию) ════════ */
    const question = body.question;
    const history = Array.isArray(body.history) ? body.history : [];
    const courseTitle = lesson.course_slug === "russian"
      ? "Русский язык ЕГЭ 2026" : "Информатика ЕГЭ 2026";
    const lessonContext = (lesson.body || "").slice(0, 14000);
    const system =
      `Ты — дружелюбный AI-репетитор курса «${courseTitle}» (автор Кирилл Шевелев). ` +
      `Ученик задаёт вопрос по уроку ${lesson.num ? `«${lesson.num}. ` : "«"}${lesson.title}». ` +
      `Объясняй по-русски, простыми словами, шаг за шагом, опирайся на материал урока ниже. ` +
      `Если вопрос не по теме — мягко верни к учёбе. ` +
      `Не выдавай готовых ответов на практику, а объясняй ход решения. Отвечай кратко (до ~300 слов).\n\n` +
      `=== МАТЕРИАЛ УРОКА ===\n${lessonContext}`;
    const msgs = [
      ...history.slice(-6).map((m: { role: string; content: string }) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: String(m.content).slice(0, 2000),
      })),
      { role: "user", content: String(question).slice(0, 2000) },
    ];
    const answer = await callAI(system, msgs, 1024);
    return json({ answer, remaining });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
