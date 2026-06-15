// ═══════════════════════════════════════════════════════════════════
//  courseApi.js — работа с контентом курсов в Supabase
//  Оглавление (модули + названия уроков) — публичное.
//  Тело урока отдаёт сервер: бесплатные — всем, платные — купившим/админу.
// ═══════════════════════════════════════════════════════════════════

import { supabase } from "../supabase";

/** Оглавление курса: модули с уроками (без тел уроков). Кэшируется. */
const _indexCache = {};
export async function fetchCourseIndex(slug, force = false) {
  if (_indexCache[slug] && !force) return _indexCache[slug];

  const [mRes, lRes] = await Promise.all([
    supabase.from("course_modules")
      .select("num, icon, title")
      .eq("course_slug", slug)
      .order("num"),
    supabase.from("course_lessons_index")
      .select("id, module_num, order_index, num, title, tag, is_summary, is_free")
      .eq("course_slug", slug)
      .order("module_num")
      .order("order_index"),
  ]);
  if (mRes.error) throw mRes.error;
  if (lRes.error) throw lRes.error;

  const modules = (mRes.data || []).map((m) => ({
    ...m,
    lessons: (lRes.data || [])
      .filter((l) => l.module_num === m.num)
      .map((l) => ({
        id: l.id,
        num: l.num,
        title: l.title,
        tag: l.tag,
        isSummary: l.is_summary,
        isFree: l.is_free,
        moduleNum: l.module_num,
      })),
  }));

  const result = {
    modules,
    lessonCount: modules.reduce(
      (s, m) => s + m.lessons.filter((l) => !l.isSummary).length, 0),
  };
  _indexCache[slug] = result;
  return result;
}

/** Тело урока. null → нет доступа (или урок не найден). Кэшируется. */
const _bodyCache = new Map();
export async function fetchLessonBody(lessonId) {
  if (_bodyCache.has(lessonId)) return _bodyCache.get(lessonId);
  const { data, error } = await supabase
    .from("course_lessons")
    .select("body")
    .eq("id", lessonId)
    .maybeSingle();
  if (error) throw error;
  const body = data?.body ?? null;     // null = RLS не пропустил (нет доступа)
  if (body !== null) _bodyCache.set(lessonId, body);
  return body;
}

/** Есть ли у текущего пользователя доступ к курсу (покупка или админ) */
export async function checkCourseAccess(slug) {
  const { data, error } = await supabase.rpc("has_course_access", { p_slug: slug });
  if (error) return false;
  return !!data;
}

/** Старт покупки: создаёт платёж ЮKassa, возвращает { url } для redirect */
export async function startPurchase(slug) {
  const { data, error } = await supabase.functions.invoke("create-payment", {
    body: { course_slug: slug },
  });
  if (error) {
    // у supabase-js текст ошибки функции лежит в context
    let msg = error.message;
    try {
      const ctx = await error.context?.json?.();
      if (ctx?.error) msg = ctx.error;
    } catch { /* ignore */ }
    throw new Error(msg || "Не удалось создать платёж");
  }
  return data; // { url } | { already: true }
}

/** Сброс кэша тел уроков (после покупки, чтобы перечитать с доступом) */
export function clearLessonCache() {
  _bodyCache.clear();
}

/* ════════════ КАТАЛОГ ИЗ БД ════════════ */

/** Каталог курсов из catalog_courses → формат, который ждёт интерфейс */
export async function fetchCatalog() {
  const { data, error } = await supabase
    .from("catalog_courses")
    .select("*")
    .eq("is_published", true)
    .order("sort_order");
  if (error) throw error;
  return (data || []).map((r) => ({
    id: r.slug,
    content_id: r.content_id,
    title: r.title,
    subject: r.subject,
    subject_icon: r.icon,
    subject_color: r.color,
    cover_color: r.color,
    price: Number(r.price),
    original_price: r.original_price ? Number(r.original_price) : null,
    duration: r.duration,
    lessons: r.lessons_count,
    level: r.level,
    format: r.format,
    tags: Array.isArray(r.tags) ? r.tags : [],
    short_desc: r.short_desc,
    teacher: r.teacher_name,
    teacher_avatar: r.teacher_avatar,
    school: r.school_name,
  }));
}

/** Настройка приложения (например, marketplace_mode). Кэшируется. */
const _settings = {};
export async function getAppSetting(key, fallback = null) {
  if (key in _settings) return _settings[key];
  try {
    const { data } = await supabase
      .from("app_settings").select("value").eq("key", key).maybeSingle();
    _settings[key] = data ? data.value : fallback;
  } catch {
    _settings[key] = fallback;
  }
  return _settings[key];
}
