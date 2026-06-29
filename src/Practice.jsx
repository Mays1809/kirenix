// ═══════════════════════════════════════════════════════════════════
//  Practice.jsx — движок практики с авто-проверкой.
//  Мгновенно ✓/✗, подсказки по шагам (не ответ), стрик.
//  Режимы: «Слабые места» (по диагностике), «Все темы», «Повтор ошибок».
//  Прогресс заданий — в localStorage (для повтора ошибок и статистики).
// ═══════════════════════════════════════════════════════════════════

import { useMemo, useState } from "react";
import {
  ArrowLeft, ArrowRight, Check, X, Lightbulb, RotateCcw,
  Dumbbell, Flame, Target, Sparkles,
} from "lucide-react";
import { PRACTICE } from "./practice/bank";

const card = (extra = {}) => ({
  background: "var(--color-background-primary)",
  borderRadius: "var(--border-radius-lg)",
  border: "0.5px solid var(--color-border-tertiary)",
  boxShadow: "var(--shadow-sm)", ...extra,
});

const norm = (s) => String(s).trim().toLowerCase().replace(/\s+/g, " ").replace(/ё/g, "е");
const shuffle = (a) => {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
  return r;
};

export default function Practice({ contentId, modules = [], user, mastery = {}, onClose, accent = "#3b82f6" }) {
  const all = useMemo(() => PRACTICE[contentId] || [], [contentId]);
  const lsKey = `kirenix_practice_${contentId}_${user?.id || "guest"}`;
  const readStats = () => { try { return JSON.parse(localStorage.getItem(lsKey)) || {}; } catch { return {}; } };

  const weakModules = Object.keys(mastery).filter((k) => mastery[k] === "weak").map(Number);
  const hasWeak = weakModules.length > 0;
  const mistakesCount = useMemo(() => {
    const st = readStats();
    return all.filter((t) => st[t.id]?.correct === false).length;
  }, [all]); // eslint-disable-line react-hooks/exhaustive-deps

  const [queue, setQueue] = useState([]);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [idx, setIdx] = useState(0);
  const [val, setVal] = useState("");
  const [pick, setPick] = useState(null);
  const [checked, setChecked] = useState(false);
  const [ok, setOk] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [correctN, setCorrectN] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);

  const reset = () => { setVal(""); setPick(null); setChecked(false); setOk(false); setShowHint(false); };

  const buildQueue = (m) => {
    let tasks = all;
    if (m === "weak") tasks = all.filter((t) => weakModules.includes(t.m));
    else if (m === "mistakes") { const st = readStats(); tasks = all.filter((t) => st[t.id]?.correct === false); }
    if (!tasks.length) tasks = all;
    return shuffle(tasks);
  };

  const start = (m) => {
    setQueue(buildQueue(m)); setStarted(true); setFinished(false);
    setIdx(0); reset(); setCorrectN(0); setStreak(0); setBestStreak(0);
  };

  const backBtn = (
    <button onClick={onClose} style={{
      display: "flex", alignItems: "center", gap: 6, background: "none",
      border: "none", cursor: "pointer", fontSize: 13,
      color: "var(--color-text-secondary)", padding: "0 0 14px 0",
    }}>
      <ArrowLeft size={14}/> К оглавлению курса
    </button>
  );

  if (!all.length) {
    return (
      <div>{backBtn}
        <div style={{ ...card(), padding: 24, textAlign: "center", fontSize: 13,
          color: "var(--color-text-secondary)" }}>
          Для этого курса практика пока готовится.
        </div>
      </div>
    );
  }

  /* ─────────── СТАРТ: выбор режима ─────────── */
  if (!started) {
    const Mode = ({ icon, title, desc, onClick, disabled, tone }) => (
      <button onClick={onClick} disabled={disabled} style={{
        ...card(), width: "100%", display: "flex", alignItems: "center", gap: 12,
        padding: "15px 16px", textAlign: "left", marginBottom: 10,
        cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1,
        background: tone ? `linear-gradient(135deg, ${tone}12, transparent)` : "var(--color-background-primary)",
      }}>
        <span style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0,
          background: `${tone || accent}18`, color: tone || accent,
          display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</span>
        <span style={{ flex: 1 }}>
          <span style={{ display: "block", fontSize: 14, fontWeight: 700 }}>{title}</span>
          <span style={{ display: "block", fontSize: 11.5, color: "var(--color-text-secondary)" }}>{desc}</span>
        </span>
        <ArrowRight size={15} style={{ color: "var(--color-text-secondary)" }}/>
      </button>
    );
    return (
      <div>{backBtn}
        <div className="pf-serif" style={{ fontSize: 21, marginBottom: 4 }}>Практика</div>
        <div style={{ fontSize: 12.5, color: "var(--color-text-secondary)", marginBottom: 16 }}>
          Одна теория не работает — закрепляй заданиями с мгновенной проверкой.
        </div>
        <Mode icon={<Target size={18}/>} tone="#f59e0b"
          title="Слабые места" disabled={!hasWeak}
          desc={hasWeak ? `Задания по модулям из диагностики (${weakModules.length})` : "Сначала пройди диагностику уровня"}
          onClick={() => start("weak")}/>
        <Mode icon={<Dumbbell size={18}/>}
          title="Все темы" desc={`Случайные задания по всему курсу (${all.length})`}
          onClick={() => start("all")}/>
        <Mode icon={<RotateCcw size={18}/>} tone="#ef4444"
          title="Повтор ошибок" disabled={!mistakesCount}
          desc={mistakesCount ? `Задания, где ты ошибся раньше (${mistakesCount})` : "Пока ошибок нет — порешай задания"}
          onClick={() => start("mistakes")}/>
      </div>
    );
  }

  /* ─────────── ИТОГ ─────────── */
  if (finished) {
    const total = queue.length;
    const pct = total ? Math.round((correctN / total) * 100) : 0;
    return (
      <div>{backBtn}
        <div style={{ ...card(), padding: "26px 22px", textAlign: "center",
          background: `linear-gradient(135deg, ${accent}12, transparent)` }}>
          <div style={{ width: 52, height: 52, borderRadius: "50%", margin: "0 auto 12px",
            background: `${accent}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Sparkles size={22} style={{ color: accent }}/>
          </div>
          <div className="pf-serif" style={{ fontSize: 22, marginBottom: 4 }}>{correctN} из {total} верно</div>
          <div style={{ fontSize: 12.5, color: "var(--color-text-secondary)" }}>
            Точность {pct}% · лучшая серия подряд: {bestStreak} 🔥
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button onClick={() => start(queue.length ? "mistakes" : "all")} style={{
            flex: 1, padding: "11px 16px", borderRadius: "var(--border-radius-md)", border: "none",
            background: `linear-gradient(135deg, ${accent}, ${accent}cc)`, color: "#fff",
            fontSize: 13, fontWeight: 600, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
          }}>
            <RotateCcw size={14}/> Повторить ошибки
          </button>
          <button onClick={onClose} style={{
            padding: "11px 16px", borderRadius: "var(--border-radius-md)",
            border: "0.5px solid var(--color-border-secondary)",
            background: "var(--color-background-primary)", color: "var(--color-text-secondary)",
            fontSize: 13, cursor: "pointer",
          }}>
            К курсу
          </button>
        </div>
      </div>
    );
  }

  /* ─────────── ЗАДАНИЕ ─────────── */
  const t = queue[idx];
  const total = queue.length;
  const pctBar = Math.round((idx / total) * 100);
  const answered = t.type === "choice" ? pick !== null : val.trim() !== "";

  const check = () => {
    if (checked || !answered) return;
    let correct;
    if (t.type === "choice") correct = pick === t.answer;
    else correct = [t.answer, ...(t.accept || [])].map(norm).includes(norm(val));
    setOk(correct); setChecked(true);
    if (!correct) setShowHint(true);
    try { const st = readStats(); st[t.id] = { correct, ts: Date.now() }; localStorage.setItem(lsKey, JSON.stringify(st)); } catch { /* ignore */ }
    if (correct) { setCorrectN((n) => n + 1); setStreak((s) => { const ns = s + 1; setBestStreak((b) => Math.max(b, ns)); return ns; }); }
    else setStreak(0);
  };
  const next = () => { if (idx < total - 1) { setIdx(idx + 1); reset(); } else setFinished(true); };

  return (
    <div>{backBtn}
      <div style={{ ...card(), padding: "20px 20px 22px" }}>
        {/* верх: прогресс + стрик */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <Dumbbell size={17} style={{ color: accent }}/>
          <div style={{ fontSize: 12.5, fontWeight: 700 }}>Практика</div>
          {streak >= 2 && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11.5,
              fontWeight: 700, color: "#ef4444", background: "#ef444415", padding: "2px 8px", borderRadius: 99 }}>
              <Flame size={12}/> {streak}
            </span>
          )}
          <div style={{ marginLeft: "auto", fontSize: 12, color: "var(--color-text-secondary)" }}>{idx + 1} / {total}</div>
        </div>
        <div style={{ height: 6, background: `${accent}1f`, borderRadius: 99, marginBottom: 18 }}>
          <div style={{ height: "100%", width: `${pctBar}%`, borderRadius: 99,
            background: `linear-gradient(90deg, ${accent}, #10b981)`, transition: "width .25s" }}/>
        </div>

        <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginBottom: 6 }}>
          Модуль {t.m}{modules.find((m) => m.num === t.m) ? `. ${modules.find((m) => m.num === t.m).title}` : ""}
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.45, marginBottom: 16 }}>{t.q}</div>

        {/* ответ */}
        {t.type === "choice" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {t.options.map((opt, oi) => {
              const active = pick === oi;
              const isAns = checked && oi === t.answer;
              const isWrongPick = checked && active && oi !== t.answer;
              const bd = isAns ? "#10b981" : isWrongPick ? "#ef4444" : active ? accent : "var(--color-border-secondary)";
              const bg = isAns ? "#10b98112" : isWrongPick ? "#ef444412" : active ? `${accent}10` : "var(--color-background-primary)";
              return (
                <button key={oi} onClick={() => !checked && setPick(oi)} disabled={checked} style={{
                  display: "flex", alignItems: "center", gap: 10, textAlign: "left",
                  padding: "12px 14px", borderRadius: "var(--border-radius-md)",
                  cursor: checked ? "default" : "pointer",
                  border: `${active || isAns || isWrongPick ? "1.5px" : "0.5px"} solid ${bd}`,
                  background: bg, color: "var(--color-text-primary)", fontSize: 13.5,
                  fontWeight: active || isAns ? 600 : 400,
                }}>
                  <span style={{ flex: 1 }}>{opt}</span>
                  {isAns && <Check size={15} style={{ color: "#10b981" }}/>}
                  {isWrongPick && <X size={15} style={{ color: "#ef4444" }}/>}
                </button>
              );
            })}
          </div>
        ) : (
          <input
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (checked ? next() : check())}
            disabled={checked}
            placeholder="Твой ответ"
            inputMode={t.type === "num" ? "numeric" : "text"}
            style={{ width: "100%", padding: "12px 14px", fontSize: 14, borderRadius: "var(--border-radius-md)",
              border: checked ? `1.5px solid ${ok ? "#10b981" : "#ef4444"}` : "0.5px solid var(--color-border-secondary)",
              background: "var(--color-background-primary)", color: "var(--color-text-primary)", boxSizing: "border-box" }}
          />
        )}

        {/* фидбэк */}
        {checked && (
          <div style={{ marginTop: 12, fontSize: 13, fontWeight: 600,
            color: ok ? "#10b981" : "#ef4444", display: "flex", alignItems: "center", gap: 6 }}>
            {ok ? <><Check size={15}/> Верно!</> : <><X size={15}/> Неверно. Правильный ответ: {t.type === "choice" ? t.options[t.answer] : t.answer}</>}
          </div>
        )}

        {/* подсказка */}
        {t.hint && (showHint
          ? <div style={{ marginTop: 12, padding: "11px 13px", borderRadius: 10, fontSize: 12.5, lineHeight: 1.55,
              background: "#f59e0b12", borderLeft: "3px solid #f59e0b", color: "var(--color-text-primary)" }}>
              <b style={{ color: "#b45309" }}>Подсказка:</b> {t.hint}
            </div>
          : !checked && (
            <button onClick={() => setShowHint(true)} style={{
              marginTop: 12, display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5,
              fontWeight: 600, color: "#b45309", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              <Lightbulb size={14}/> Подсказка по шагам
            </button>
          ))}

        {/* действие */}
        <button onClick={checked ? next : check} disabled={!answered} style={{
          marginTop: 18, width: "100%", padding: "12px 16px",
          borderRadius: "var(--border-radius-md)", border: "none",
          background: !answered ? "var(--color-border-secondary)" : `linear-gradient(135deg, ${accent}, ${accent}cc)`,
          color: "#fff", fontSize: 13.5, fontWeight: 600,
          cursor: !answered ? "default" : "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
        }}>
          {checked
            ? (idx < total - 1 ? <>Дальше <ArrowRight size={14}/></> : <>Показать итог <Sparkles size={14}/></>)
            : "Проверить"}
        </button>
      </div>
    </div>
  );
}
