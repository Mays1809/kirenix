// ═══════════════════════════════════════════════════════════════════
//  Загрузка курса «Информатика ЕГЭ 2026» в Supabase (модули + уроки).
//
//  ЗАПУСК (из корня проекта):
//    SUPABASE_SERVICE_ROLE_KEY="eyJ..." node scripts/seed_informatics.mjs
//
//  Сервисный ключ: Supabase Dashboard → Settings → API → service_role.
//  Никогда не коммить его и не вставлять в клиентский код.
//  Скрипт идемпотентный — можно запускать повторно (контент обновится).
// ═══════════════════════════════════════════════════════════════════

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { createClient } from "@supabase/supabase-js";
import { parseModule } from "../src/courses/parseCourse.js";

const SLUG = "informatics";
const FREE_LESSONS = ["1.1"]; // бесплатные пробные уроки

const SUPABASE_URL = process.env.SUPABASE_URL || "https://bgidvsfjnpitiosiwjar.supabase.co";
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_KEY) {
  console.error("❌ Нужен сервисный ключ:\n   SUPABASE_SERVICE_ROLE_KEY=\"eyJ...\" node scripts/seed_informatics.mjs");
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const here = dirname(fileURLToPath(import.meta.url));
const dir  = join(here, "..", "src", "courses", "informatics");

const MODULES = [
  { num: 1,  icon: "🔢", title: "Кодирование и системы счисления", file: "m01_kodirovanie.md" },
  { num: 2,  icon: "🧠", title: "Логика",                          file: "m02_logika.md" },
  { num: 3,  icon: "🐍", title: "Python: основы",                  file: "m03_python_osnovy.md" },
  { num: 4,  icon: "⚙️", title: "Программирование: базовые задачи", file: "m04_programmirovanie.md" },
  { num: 5,  icon: "📊", title: "Работа с данными",                file: "m05_dannye.md" },
  { num: 6,  icon: "🌐", title: "Алгоритмы и сети",                file: "m06_algoritmy_seti.md" },
  { num: 7,  icon: "🎮", title: "Теория игр",                      file: "m07_teoriya_igr.md" },
  { num: 8,  icon: "🧮", title: "Динамическое программирование",   file: "m08_dinamicheskoe.md" },
  { num: 9,  icon: "💻", title: "Сложное программирование",        file: "m09_slozhnoe_prog.md" },
  { num: 10, icon: "🤖", title: "Процессы и автоматы",             file: "m10_processy.md" },
  { num: 11, icon: "🏁", title: "Финальная подготовка",            file: "m11_finalnaya.md" },
];

let totalLessons = 0;

for (const m of MODULES) {
  const raw = readFileSync(join(dir, m.file), "utf8");
  const parsed = parseModule(raw);

  // модуль
  const { error: me } = await db.from("course_modules").upsert(
    { course_slug: SLUG, num: m.num, icon: m.icon, title: m.title },
    { onConflict: "course_slug,num" }
  );
  if (me) { console.error(`❌ Модуль ${m.num}:`, me.message); process.exit(1); }

  // уроки (+ итог модуля)
  const items = parsed.lessons.map((l, i) => ({
    course_slug: SLUG,
    module_num: m.num,
    order_index: i,
    num: l.num,
    title: l.title,
    tag: l.tag,
    is_summary: false,
    is_free: FREE_LESSONS.includes(l.num),
    body: l.body,
  }));
  if (parsed.summary) {
    items.push({
      course_slug: SLUG,
      module_num: m.num,
      order_index: items.length,
      num: null,
      title: parsed.summary.title.replace(/^[✅🎓]\s*/u, ""),
      tag: null,
      is_summary: true,
      is_free: false,
      body: parsed.summary.body,
    });
  }

  const { error: le } = await db.from("course_lessons").upsert(items, {
    onConflict: "course_slug,module_num,order_index",
  });
  if (le) { console.error(`❌ Уроки модуля ${m.num}:`, le.message); process.exit(1); }

  totalLessons += items.length;
  console.log(`✓ Модуль ${m.num}. ${m.title} — ${items.length} записей`);
}

// контрольная сверка
const { count } = await db
  .from("course_lessons")
  .select("*", { count: "exact", head: true })
  .eq("course_slug", SLUG);

console.log(`\n✅ Готово: загружено ${totalLessons} записей, в БД сейчас ${count}.`);
console.log(`   Бесплатные уроки: ${FREE_LESSONS.join(", ")}`);
