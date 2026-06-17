// ═══════════════════════════════════════════════════════════════════
//  CourseStudy.jsx — прохождение курса.
//  Оглавление и названия уроков — публичные (из БД).
//  Тело урока запрашивается у сервера: бесплатные уроки видят все,
//  платные сервер отдаёт только купившим / админу (RLS).
//  Прогресс — в localStorage, отдельно для каждого пользователя.
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, ArrowRight, BookOpen, Check, CheckCircle,
  ChevronDown, ChevronRight, FileText, Loader2, Lock, Map, ShoppingCart,
} from "lucide-react";
import CourseMarkdown from "./CourseMarkdown";
import { supabase } from "./supabase";   // прогресс уроков пишется в БД
import AiTutor from "./AiTutor";
import EssayChecker from "./EssayChecker";
import { Bot } from "lucide-react";
import { INFORMATICS_COURSE } from "./courses/informatics";
import { RUSSIAN_COURSE } from "./courses/russian";
import {
  fetchCourseIndex, fetchLessonBody, checkCourseAccess,
  startPurchase, clearLessonCache,
} from "./courses/courseApi";

/* ── Метаданные встроенных курсов ── */
const COURSE_META = {
  informatics: INFORMATICS_COURSE,
  russian: RUSSIAN_COURSE,
};

/** Есть ли для курса встроенный контент (мок-каталог или запись из БД) */
export function getContentId(course) {
  if (!course) return null;
  if (course.content_id && COURSE_META[course.content_id]) return course.content_id;
  const title = `${course.title || ""} ${course.subject || ""}`.toLowerCase();
  if (title.includes("информатик")) return "informatics";
  if (title.includes("русск")) return "russian";
  return null;
}

const card = (extra = {}) => ({
  background: "var(--color-background-primary)",
  borderRadius: "var(--border-radius-lg)",
  border: "0.5px solid var(--color-border-tertiary)",
  boxShadow: "var(--shadow-sm)",
  ...extra,
});

const Spinner = ({ label = "Загружаем…" }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
    gap: 8, padding: 40, color: "var(--color-text-secondary)", fontSize: 13 }}>
    <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }}/> {label}
  </div>
);

export default function CourseStudy({ contentId, user, price, onBack }) {
  // Фолбэк-метаданные: getContentId может вернуть slug (по названию курса),
  // которого нет в COURSE_META (например, если бандл собран частично) —
  // тогда без фолбэка падал бы весь экран (meta.color у undefined).
  const meta = COURSE_META[contentId] || {
    icon: "📘", color: "#3b82f6", title: "Курс", program: "",
  };
  const accent = meta.color || "#3b82f6";

  /* ── Оглавление и доступ ── */
  const [index, setIndex] = useState(null);
  const [access, setAccess] = useState(null);
  const [loadErr, setLoadErr] = useState(null);

  useEffect(() => {
    let on = true;
    Promise.all([fetchCourseIndex(contentId), checkCourseAccess(contentId)])
      .then(([idx, acc]) => { if (on) { setIndex(idx); setAccess(acc); } })
      .catch((e) => { if (on) setLoadErr(e.message || String(e)); });
    return () => { on = false; };
  }, [contentId]);

  /* ── Прогресс: в БД (синхронизация между устройствами), гость — в браузере ── */
  const storageKey = `progressly_progress_${contentId}_${user?.id || "guest"}`;
  const readLocal = () => {
    try { return JSON.parse(localStorage.getItem(storageKey)) || {}; }
    catch { return {}; }
  };
  const [done, setDone] = useState(readLocal);

  useEffect(() => {
    if (!user) return;
    let on = true;
    supabase
      .from("course_progress")
      .select("lesson_id")
      .then(({ data, error }) => {
        if (!on || error) return;
        const d = {};
        (data || []).forEach((r) => { d[r.lesson_id] = true; });
        // одноразовый перенос старых отметок из браузера в БД
        const local = readLocal();
        const missing = Object.keys(local).filter((id) => local[id] && !d[id]);
        if (missing.length) {
          supabase.from("course_progress").upsert(
            missing.map((id) => ({ user_id: user.id, lesson_id: id })),
            { onConflict: "user_id,lesson_id" }
          ).then(() => {});
          missing.forEach((id) => { d[id] = true; });
        }
        setDone(d);
      });
    return () => { on = false; };
  }, [user?.id, contentId]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleDone = (id) => {
    const marking = !done[id];
    setDone((prev) => {
      const next = { ...prev, [id]: marking };
      if (!marking) delete next[id];
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
    if (user) {
      if (marking) {
        supabase.from("course_progress")
          .upsert({ user_id: user.id, lesson_id: id }, { onConflict: "user_id,lesson_id" })
          .then(() => {});
      } else {
        supabase.from("course_progress")
          .delete().eq("user_id", user.id).eq("lesson_id", id)
          .then(() => {});
      }
    }
  };

  /* ── Навигация и тело урока ── */
  const flat = useMemo(
    () => (index ? index.modules.flatMap((m) => m.lessons) : []),
    [index]
  );
  const [view, setView] = useState(null);      // null | "program" | lessonId
  const [body, setBody] = useState(undefined); // undefined=грузим, null=нет доступа
  const [openModules, setOpenModules] = useState({ 1: true });
  const [buying, setBuying] = useState(false);
  const [tutorOpen, setTutorOpen] = useState(false);
  const [essayOpen, setEssayOpen] = useState(false);

  useEffect(() => { setTutorOpen(false); setEssayOpen(false); }, [view]);

  const lesson = flat.find((l) => l.id === view) || null;
  const lessonIdx = lesson ? flat.indexOf(lesson) : -1;
  const module_ = lesson && index
    ? index.modules.find((m) => m.num === lesson.moduleNum)
    : null;

  useEffect(() => {
    if (!lesson) return;
    let on = true;
    setBody(undefined);
    fetchLessonBody(lesson.id)
      .then((b) => { if (on) setBody(b); })
      .catch(() => { if (on) setBody(null); });
    return () => { on = false; };
  }, [view]); // eslint-disable-line react-hooks/exhaustive-deps

  const openLesson = (id) => { setView(id); window.scrollTo({ top: 0 }); };

  /* ── Покупка ── */
  const handleBuy = async () => {
    if (!user) { alert("Войдите в аккаунт, чтобы купить курс."); return; }
    setBuying(true);
    try {
      const res = await startPurchase(contentId);
      if (res?.url) { window.location.href = res.url; return; }
      if (res?.already || res?.free) {
        clearLessonCache();
        setAccess(true);
        if (res?.free) alert("Курс открыт бесплатно — приятной учёбы 🎉");
        if (lesson) { setBody(undefined); fetchLessonBody(lesson.id).then(setBody); }
      }
    } catch (e) {
      alert("Ошибка оплаты: " + e.message);
    }
    setBuying(false);
  };

  const BuyBtn = ({ full = false }) => (
    <button onClick={handleBuy} disabled={buying} style={{
      display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
      padding: "11px 20px", borderRadius: "var(--border-radius-md)", border: "none",
      background: buying ? "var(--color-border-secondary)"
        : "linear-gradient(135deg,#f59e0b,#f97316)",
      boxShadow: buying ? "none" : "0 4px 14px rgba(249,115,22,.35)",
      color: "#fff", fontSize: 13, fontWeight: 600,
      cursor: buying ? "wait" : "pointer", width: full ? "100%" : undefined,
    }}>
      {buying
        ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }}/>
        : <ShoppingCart size={15}/>}
      {Number(price) === 0 ? "Получить бесплатно" : `Купить курс за ${(price ?? 5200).toLocaleString()} ₽`}
    </button>
  );

  if (loadErr) {
    return (
      <div style={{ ...card(), padding: 24, textAlign: "center" }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Не удалось загрузить курс</div>
        <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 14 }}>{loadErr}</div>
        <button onClick={onBack} style={{ fontSize: 13, color: accent, background: "none",
          border: "none", cursor: "pointer" }}>← Назад</button>
      </div>
    );
  }
  if (!index) return <Spinner label="Загружаем курс…"/>;

  const allCount = flat.length;
  const doneCount = flat.filter((l) => done[l.id]).length;
  const pct = allCount ? Math.round((doneCount / allCount) * 100) : 0;

  /* ════════════ РЕЖИМ УРОКА / ПРОГРАММЫ ════════════ */
  if (lesson || view === "program") {
    const isProgram = view === "program";
    const prev = lessonIdx > 0 ? flat[lessonIdx - 1] : null;
    const next = lessonIdx >= 0 && lessonIdx < flat.length - 1 ? flat[lessonIdx + 1] : null;
    const locked = !isProgram && body === null;

    return (
      <div>
        <button onClick={() => setView(null)} style={{
          display: "flex", alignItems: "center", gap: 6, background: "none",
          border: "none", cursor: "pointer", fontSize: 13,
          color: "var(--color-text-secondary)", padding: "0 0 14px 0",
        }}>
          <ArrowLeft size={14}/> К оглавлению курса
        </button>

        <div className="rounded-2xl px-5 py-[18px] mb-3.5 backdrop-blur-xl bg-white/65 dark:bg-zinc-900/55 ring-1 ring-black/[0.04] dark:ring-white/10 shadow-[0_14px_40px_-14px_rgba(20,20,45,0.22)]">
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mb-1.5">
            {isProgram
              ? `${meta.icon} ${meta.title}`
              : `${module_.icon} Модуль ${module_.num}. ${module_.title}`}
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
            <div className="pf-serif" style={{ fontSize: 19, lineHeight: 1.3, flex: 1, minWidth: 200 }}>
              {isProgram
                ? "Программа курса"
                : lesson.isSummary
                  ? `✅ ${lesson.title}`
                  : `Урок ${lesson.num}. ${lesson.title}`}
            </div>
            {!isProgram && lesson.tag && (
              <span style={{
                fontSize: 11, fontWeight: 600, color: accent,
                background: `${accent}15`, padding: "3px 10px",
                borderRadius: 99, whiteSpace: "nowrap",
              }}>{lesson.tag}</span>
            )}
          </div>
        </div>

        {/* Контент: программа — локальная; урок — из БД */}
        {isProgram ? (
          <div style={{ ...card(), padding: "6px 20px 16px" }}>
            <CourseMarkdown text={meta.program} accent={accent}/>
          </div>
        ) : body === undefined ? (
          <div style={card()}><Spinner label="Загружаем урок…"/></div>
        ) : locked ? (
          /* ── ПЕЙВОЛЛ ── */
          <div style={{ ...card(), padding: "32px 24px", textAlign: "center" }}>
            <div style={{
              width: 52, height: 52, borderRadius: "50%", margin: "0 auto 14px",
              background: `${accent}15`, display: "flex",
              alignItems: "center", justifyContent: "center",
            }}>
              <Lock size={22} style={{ color: accent }}/>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
              Этот урок доступен после покупки
            </div>
            <div style={{ fontSize: 12.5, color: "var(--color-text-secondary)",
              marginBottom: 18, lineHeight: 1.6 }}>
              Полный курс: {index.lessonCount} уроков по всем 27 заданиям ЕГЭ,
              практика с ответами, шпаргалки и рабочий Python-код.
              Урок 1.1 — бесплатный, попробуй.
            </div>
            <div style={{ maxWidth: 320, margin: "0 auto" }}>
              <BuyBtn full/>
            </div>
          </div>
        ) : (
          <div style={{ ...card(), padding: "6px 20px 16px" }}>
            <CourseMarkdown text={body} accent={accent}/>
          </div>
        )}

        {!isProgram && (
          <div style={{ display: "flex", gap: 8, marginTop: 14, alignItems: "center" }}>
            <button
              disabled={!prev}
              onClick={() => prev && openLesson(prev.id)}
              style={{
                display: "flex", alignItems: "center", gap: 5, fontSize: 12,
                padding: "9px 14px", borderRadius: "var(--border-radius-md)",
                border: "0.5px solid var(--color-border-secondary)",
                background: "var(--color-background-primary)",
                cursor: prev ? "pointer" : "not-allowed",
                color: prev ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                opacity: prev ? 1 : 0.5,
              }}>
              <ArrowLeft size={13}/> Назад
            </button>

            {!locked && body !== undefined && (
              <button onClick={() => toggleDone(lesson.id)} style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                gap: 6, fontSize: 12.5, fontWeight: 600, padding: "9px 14px",
                borderRadius: "var(--border-radius-md)", cursor: "pointer",
                border: done[lesson.id] ? "1px solid #10b981" : `1px solid ${accent}`,
                background: done[lesson.id] ? "#10b98115" : `${accent}12`,
                color: done[lesson.id] ? "#10b981" : accent,
              }}>
                <CheckCircle size={14}/>
                {done[lesson.id] ? "Пройдено ✓" : "Отметить пройденным"}
              </button>
            )}
            {locked && <div style={{ flex: 1 }}/>}

            <button
              disabled={!next}
              onClick={() => next && openLesson(next.id)}
              style={{
                display: "flex", alignItems: "center", gap: 5, fontSize: 12,
                padding: "9px 14px", borderRadius: "var(--border-radius-md)",
                border: "none",
                background: next
                  ? `linear-gradient(135deg, ${accent}, ${accent}cc)`
                  : "var(--color-border-secondary)",
                color: "#fff", fontWeight: 600,
                cursor: next ? "pointer" : "not-allowed",
              }}>
              Дальше <ArrowRight size={13}/>
            </button>
          </div>
        )}

        {/* ── Проверка сочинения по К1–К10 (флагман курса русского) ── */}
        {contentId === "russian" && !isProgram && lesson?.moduleNum === 7 && typeof body === "string" && (
          <div style={{ ...card(), marginTop: 14, padding: "14px 16px",
            background: `linear-gradient(135deg, ${accent}12, transparent)`,
            borderLeft: `4px solid ${accent}` }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 4 }}>
              ✍️ Проверь своё сочинение по критериям ФИПИ
            </div>
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 10, lineHeight: 1.6 }}>
              Вставь текст — получишь разбор по К1–К10, прогноз баллов и конкретные правки. Этого нет в обычных тестах.
            </div>
            <button onClick={() => setEssayOpen(true)} style={{
              display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 16px",
              borderRadius: 10, border: "none", cursor: "pointer", color: "#fff", fontSize: 13, fontWeight: 600,
              background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
            }}>
              <CheckCircle size={15}/> Проверить сочинение по К1–К10
            </button>
          </div>
        )}
        {essayOpen && (
          <EssayChecker lessonId={lesson.id} accent={accent} onClose={() => setEssayOpen(false)} />
        )}

        {/* ── AI-репетитор: доступен в открытых уроках ── */}
        {!isProgram && typeof body === "string" && (
          tutorOpen ? (
            <AiTutor
              lessonId={lesson.id}
              lessonTitle={lesson.isSummary ? lesson.title : `Урок ${lesson.num}. ${lesson.title}`}
              accent={accent}
              onClose={() => setTutorOpen(false)}
            />
          ) : (
            <button onClick={() => setTutorOpen(true)} style={{
              position: "fixed", bottom: 16, right: 16, zIndex: 299,
              display: "flex", alignItems: "center", gap: 8, padding: "12px 16px",
              borderRadius: 99, border: "none", cursor: "pointer",
              background: `linear-gradient(135deg, ${accent}, #6366f1)`, color: "#fff",
              fontSize: 13, fontWeight: 600,
              boxShadow: "0 6px 20px rgba(59,130,246,.4)",
            }}>
              <Bot size={16}/> Спросить ИИ
            </button>
          )
        )}
      </div>
    );
  }

  /* ════════════ ОГЛАВЛЕНИЕ ════════════ */
  return (
    <div>
      <button onClick={onBack} style={{
        display: "flex", alignItems: "center", gap: 6, background: "none",
        border: "none", cursor: "pointer", fontSize: 13,
        color: "var(--color-text-secondary)", padding: "0 0 14px 0",
      }}>
        <ArrowLeft size={14}/> Назад
      </button>

      {/* Шапка курса */}
      <div className="rounded-2xl p-5 mb-3.5 backdrop-blur-xl ring-1 ring-black/[0.04] dark:ring-white/10 shadow-[0_16px_44px_-14px_rgba(20,20,45,0.24)]"
        style={{ background: `linear-gradient(135deg, ${accent}18, transparent)`, borderLeft: `4px solid ${accent}` }}>
        <div className="pf-serif text-[22px] mb-1 text-zinc-900 dark:text-zinc-100">
          {meta.icon} {meta.title}
        </div>
        <div style={{ fontSize: 12.5, color: "var(--color-text-secondary)", marginBottom: 14 }}>
          {index.modules.length} модулей · {index.lessonCount} уроков · все 27 заданий ЕГЭ
        </div>
        {access ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, height: 7, background: `${accent}22`, borderRadius: 99 }}>
              <div style={{
                height: "100%", width: `${pct}%`, borderRadius: 99,
                background: `linear-gradient(90deg, ${accent}, #10b981)`,
                transition: "width .3s",
              }}/>
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: accent }}>
              {doneCount}/{allCount}
            </span>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <BuyBtn/>
            <span style={{ fontSize: 11.5, color: "var(--color-text-secondary)" }}>
              Урок 1.1 — бесплатно, без регистрации карты
            </span>
          </div>
        )}
      </div>

      {/* Программа курса */}
      <button onClick={() => { setView("program"); window.scrollTo({ top: 0 }); }} style={{
        ...card(), width: "100%", display: "flex", alignItems: "center", gap: 10,
        padding: "13px 16px", cursor: "pointer", marginBottom: 10, textAlign: "left",
      }}>
        <span style={{
          width: 34, height: 34, borderRadius: 9, flexShrink: 0,
          background: `${accent}15`, display: "flex",
          alignItems: "center", justifyContent: "center",
        }}><Map size={16} style={{ color: accent }}/></span>
        <span style={{ flex: 1 }}>
          <span style={{ display: "block", fontSize: 13.5, fontWeight: 600 }}>
            Программа курса
          </span>
          <span style={{ display: "block", fontSize: 11.5, color: "var(--color-text-secondary)" }}>
            Карта всех 27 заданий · изменения ЕГЭ 2026 · методика
          </span>
        </span>
        <ChevronRight size={15} style={{ color: "var(--color-text-secondary)" }}/>
      </button>

      {/* Модули */}
      {index.modules.map((m) => {
        const open = !!openModules[m.num];
        const mDone = m.lessons.filter((l) => done[l.id]).length;
        return (
          <div key={m.num} style={{ ...card(), marginBottom: 10, overflow: "hidden" }}>
            <button
              onClick={() => setOpenModules((p) => ({ ...p, [m.num]: !p[m.num] }))}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10,
                padding: "13px 16px", background: "none", border: "none",
                cursor: "pointer", textAlign: "left",
              }}>
              <span style={{
                width: 34, height: 34, borderRadius: 9, flexShrink: 0, fontSize: 16,
                background: access && mDone === m.lessons.length ? "#10b98118" : `${accent}15`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>{access && mDone === m.lessons.length ? "✅" : m.icon}</span>
              <span style={{ flex: 1 }}>
                <span style={{ display: "block", fontSize: 13.5, fontWeight: 600 }}>
                  Модуль {m.num}. {m.title}
                </span>
                <span style={{ display: "block", fontSize: 11.5, color: "var(--color-text-secondary)" }}>
                  {m.lessons.filter((l) => !l.isSummary).length} уроков
                  {access ? ` · пройдено ${mDone}/${m.lessons.length}` : ""}
                </span>
              </span>
              {open
                ? <ChevronDown size={15} style={{ color: "var(--color-text-secondary)" }}/>
                : <ChevronRight size={15} style={{ color: "var(--color-text-secondary)" }}/>}
            </button>

            {open && m.lessons.map((l) => (
              <button key={l.id} onClick={() => openLesson(l.id)} style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10,
                padding: "10px 16px 10px 22px", background: "none",
                borderWidth: "0.5px 0 0 0", borderStyle: "solid",
                borderColor: "var(--color-border-tertiary)",
                cursor: "pointer", textAlign: "left",
              }}>
                <span style={{
                  width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
                  background: done[l.id] && access ? "#10b98120" : "var(--color-background-secondary)",
                  color: done[l.id] && access ? "#10b981" : "var(--color-text-secondary)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {access && done[l.id]
                    ? <Check size={13}/>
                    : !access && !l.isFree
                      ? <Lock size={11}/>
                      : l.isSummary ? <FileText size={12}/> : <BookOpen size={12}/>}
                </span>
                <span style={{ flex: 1, fontSize: 12.5, lineHeight: 1.4 }}>
                  {l.isSummary ? l.title : `${l.num}. ${l.title}`}
                </span>
                {!access && l.isFree && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, color: "#10b981",
                    background: "#10b98115", padding: "2px 8px",
                    borderRadius: 99, whiteSpace: "nowrap", flexShrink: 0,
                  }}>Бесплатно</span>
                )}
                {l.tag && (
                  <span style={{
                    fontSize: 10, fontWeight: 600, color: accent,
                    background: `${accent}12`, padding: "2px 8px",
                    borderRadius: 99, whiteSpace: "nowrap", flexShrink: 0,
                  }}>{l.tag.replace("задание", "зад.").replace("задания", "зад.")}</span>
                )}
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
}
