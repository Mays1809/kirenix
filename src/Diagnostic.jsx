// ═══════════════════════════════════════════════════════════════════
//  Diagnostic.jsx — диагностика уровня → индивидуальный путь.
//  Короткий тест (1 вопрос на модуль). По результату строим карту
//  «знаешь / подтянуть» и сохраняем в БД (гость — в localStorage).
//  Тот, кто уже знает тему, не начинает с нуля.
// ═══════════════════════════════════════════════════════════════════

import { useMemo, useState } from "react";
import { Compass, Check, X, ArrowRight, ArrowLeft, RotateCcw, Sparkles } from "lucide-react";
import { DIAGNOSTIC } from "./diagnostic/bank";
import { supabase } from "./supabase";

const card = (extra = {}) => ({
  background: "var(--color-background-primary)",
  borderRadius: "var(--border-radius-lg)",
  border: "0.5px solid var(--color-border-tertiary)",
  boxShadow: "var(--shadow-sm)", ...extra,
});

export default function Diagnostic({ contentId, modules = [], user, onDone, onClose, accent = "#3b82f6" }) {
  const moduleNums = useMemo(() => new Set(modules.map((m) => m.num)), [modules]);
  const titleOf = (num) => modules.find((m) => m.num === num)?.title || `Модуль ${num}`;
  const questions = useMemo(
    () => (DIAGNOSTIC[contentId] || []).filter((q) => moduleNums.size === 0 || moduleNums.has(q.m)),
    [contentId, moduleNums]
  );

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [finished, setFinished] = useState(false);
  const [mastery, setMastery] = useState({});

  const total = questions.length;

  const backBtn = (
    <button onClick={onClose} style={{
      display: "flex", alignItems: "center", gap: 6, background: "none",
      border: "none", cursor: "pointer", fontSize: 13,
      color: "var(--color-text-secondary)", padding: "0 0 14px 0",
    }}>
      <ArrowLeft size={14}/> К оглавлению курса
    </button>
  );

  if (!total) {
    return (
      <div>{backBtn}
        <div style={{ ...card(), padding: 24, textAlign: "center", fontSize: 13,
          color: "var(--color-text-secondary)" }}>
          Для этого курса диагностика пока не готова.
        </div>
      </div>
    );
  }

  const choose = (oi) => setAnswers((p) => ({ ...p, [step]: oi }));

  const finish = async () => {
    const m = {};
    questions.forEach((q, i) => {
      const correct = answers[i] === q.a;
      if (m[q.m] === undefined) m[q.m] = correct ? "known" : "weak";
      else if (!correct) m[q.m] = "weak";
    });
    setMastery(m);
    setFinished(true);
    try {
      if (user) {
        await supabase.from("diagnostic_results").upsert(
          { user_id: user.id, course_slug: contentId, mastery: m, updated_at: new Date().toISOString() },
          { onConflict: "user_id,course_slug" }
        );
      } else {
        localStorage.setItem(`kirenix_diag_${contentId}`, JSON.stringify(m));
      }
    } catch { /* ignore */ }
    onDone?.(m);
  };

  const next = () => { if (step < total - 1) setStep(step + 1); else finish(); };
  const restart = () => { setAnswers({}); setStep(0); setFinished(false); setMastery({}); };

  /* ─────────── РЕЗУЛЬТАТ ─────────── */
  if (finished) {
    const known = Object.keys(mastery).filter((k) => mastery[k] === "known").map(Number).sort((a, b) => a - b);
    const weak = Object.keys(mastery).filter((k) => mastery[k] === "weak").map(Number).sort((a, b) => a - b);
    const start = weak[0] || known[0] || 1;
    return (
      <div>{backBtn}
        <div style={{ ...card(), padding: "26px 22px", textAlign: "center",
          background: `linear-gradient(135deg, ${accent}12, transparent)` }}>
          <div style={{ width: 52, height: 52, borderRadius: "50%", margin: "0 auto 12px",
            background: `${accent}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Sparkles size={22} style={{ color: accent }}/>
          </div>
          <div className="pf-serif" style={{ fontSize: 20, marginBottom: 4 }}>Твой план готов</div>
          <div style={{ fontSize: 12.5, color: "var(--color-text-secondary)", marginBottom: 4 }}>
            Рекомендуем начать с модуля {start}. {titleOf(start)}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
          <div style={{ ...card(), padding: "14px 16px" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#10b981", marginBottom: 8,
              display: "flex", alignItems: "center", gap: 6 }}>
              <Check size={14}/> Уже знаешь ({known.length})
            </div>
            {known.length ? known.map((n) => (
              <div key={n} style={{ fontSize: 12, color: "var(--color-text-secondary)", padding: "3px 0" }}>
                Модуль {n}. {titleOf(n)}
              </div>
            )) : <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Пока ничего — начнём с азов 👍</div>}
          </div>
          <div style={{ ...card(), padding: "14px 16px" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#f59e0b", marginBottom: 8,
              display: "flex", alignItems: "center", gap: 6 }}>
              <ArrowRight size={14}/> Подтянуть ({weak.length})
            </div>
            {weak.length ? weak.map((n) => (
              <div key={n} style={{ fontSize: 12, color: "var(--color-text-secondary)", padding: "3px 0" }}>
                Модуль {n}. {titleOf(n)}
              </div>
            )) : <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Отлично — слабых мест нет!</div>}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: "11px 16px", borderRadius: "var(--border-radius-md)", border: "none",
            background: `linear-gradient(135deg, ${accent}, ${accent}cc)`, color: "#fff",
            fontSize: 13, fontWeight: 600, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
          }}>
            Перейти к курсу <ArrowRight size={14}/>
          </button>
          <button onClick={restart} aria-label="Пройти заново" style={{
            padding: "11px 14px", borderRadius: "var(--border-radius-md)",
            border: "0.5px solid var(--color-border-secondary)",
            background: "var(--color-background-primary)", color: "var(--color-text-secondary)",
            fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
          }}>
            <RotateCcw size={14}/> Заново
          </button>
        </div>
        <div style={{ fontSize: 11, color: "var(--color-text-secondary)", textAlign: "center", marginTop: 10 }}>
          В оглавлении модули отметятся: «Знаешь» — можно пропустить, «Подтянуть» — начни здесь.
        </div>
      </div>
    );
  }

  /* ─────────── ВОПРОС ─────────── */
  const q = questions[step];
  const chosen = answers[step];
  const pct = Math.round((step / total) * 100);

  return (
    <div>{backBtn}
      <div style={{ ...card(), padding: "20px 20px 22px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <Compass size={18} style={{ color: accent }}/>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Диагностика уровня</div>
          <div style={{ marginLeft: "auto", fontSize: 12, color: "var(--color-text-secondary)" }}>
            {step + 1} / {total}
          </div>
        </div>
        <div style={{ height: 6, background: `${accent}1f`, borderRadius: 99, marginBottom: 18 }}>
          <div style={{ height: "100%", width: `${pct}%`, borderRadius: 99,
            background: `linear-gradient(90deg, ${accent}, #10b981)`, transition: "width .25s" }}/>
        </div>

        <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.45, marginBottom: 16 }}>{q.q}</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {q.options.map((opt, oi) => {
            const active = chosen === oi;
            return (
              <button key={oi} onClick={() => choose(oi)} style={{
                display: "flex", alignItems: "center", gap: 10, textAlign: "left",
                padding: "12px 14px", borderRadius: "var(--border-radius-md)", cursor: "pointer",
                border: active ? `1.5px solid ${accent}` : "0.5px solid var(--color-border-secondary)",
                background: active ? `${accent}10` : "var(--color-background-primary)",
                color: "var(--color-text-primary)", fontSize: 13.5, fontWeight: active ? 600 : 400,
              }}>
                <span style={{
                  width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                  border: active ? "none" : "1.5px solid var(--color-border-secondary)",
                  background: active ? accent : "transparent", color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>{active && <Check size={13}/>}</span>
                {opt}
              </button>
            );
          })}
        </div>

        <button onClick={next} disabled={chosen === undefined} style={{
          marginTop: 18, width: "100%", padding: "12px 16px",
          borderRadius: "var(--border-radius-md)", border: "none",
          background: chosen === undefined ? "var(--color-border-secondary)"
            : `linear-gradient(135deg, ${accent}, ${accent}cc)`,
          color: "#fff", fontSize: 13.5, fontWeight: 600,
          cursor: chosen === undefined ? "default" : "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
        }}>
          {step < total - 1 ? <>Дальше <ArrowRight size={14}/></> : <>Показать план <Sparkles size={14}/></>}
        </button>
      </div>
      <div style={{ fontSize: 11, color: "var(--color-text-secondary)", textAlign: "center", marginTop: 10 }}>
        Это займёт пару минут. Отвечай как есть — план подстроится под тебя.
      </div>
    </div>
  );
}
