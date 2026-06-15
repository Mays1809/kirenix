// ═══════════════════════════════════════════════════════════════════
//  ScoreTracker.jsx — трекер баллов «до/после» (кросс-девайс).
//   • Сочинения: прогресс из essay_reviews (первое → последнее, из 22).
//   • Пробники: журнал баллов в БД (score_log) — синхронизация между устройствами.
//  Цель — показать ученику РОСТ: главный мотиватор и наш фокус на результат.
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Plus, Trash2, TrendingUp, Loader2 } from "lucide-react";
import { supabase } from "./supabase";

const card = (extra = {}) => ({
  background: "var(--color-background-primary)",
  borderRadius: "var(--border-radius-lg)",
  border: "0.5px solid var(--color-border-tertiary)",
  boxShadow: "var(--shadow-sm)",
  ...extra,
});

const todayISO = () => new Date().toISOString().slice(0, 10);
const fmtDate = (d) => { try { return new Date(d).toLocaleDateString("ru-RU", { day: "2-digit", month: "short" }); } catch { return d; } };

/** Карточка «до → после» по серии точек [{value,max,date}] (по возрастанию даты) */
function DeltaHead({ title, series, accent, unit }) {
  if (!series.length) {
    return (
      <div style={{ ...card(), padding: "14px 16px", flex: 1, minWidth: 200 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Пока нет данных.</div>
      </div>
    );
  }
  const first = series[0], last = series[series.length - 1];
  const delta = last.value - first.value;
  const dColor = delta > 0 ? "#10b981" : delta < 0 ? "#ef4444" : "var(--color-text-secondary)";
  return (
    <div style={{ ...card(), padding: "14px 16px", flex: 1, minWidth: 200,
      background: `linear-gradient(135deg, ${accent}10, transparent)` }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>{title}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>было {first.value}{unit}</span>
        <span style={{ fontSize: 16, color: "var(--color-text-secondary)" }}>→</span>
        <span style={{ fontSize: 24, fontWeight: 800, color: accent }}>{last.value}{unit}</span>
        {series.length > 1 && (
          <span style={{ fontSize: 13, fontWeight: 700, color: dColor }}>
            {delta > 0 ? "+" : ""}{delta}
          </span>
        )}
      </div>
      <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 4 }}>
        {series.length} {series.length === 1 ? "запись" : "записей"} · {fmtDate(first.date)} — {fmtDate(last.date)}
      </div>
    </div>
  );
}

/** Список-бары по серии */
function Bars({ series, accent, onDelete }) {
  if (!series.length) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 10 }}>
      {series.slice().reverse().map((p, i) => {
        const pct = Math.max(4, Math.min(100, Math.round((p.value / p.max) * 100)));
        return (
          <div key={p.id || i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 11, color: "var(--color-text-secondary)", width: 52, flexShrink: 0 }}>
              {fmtDate(p.date)}
            </span>
            <div style={{ flex: 1, height: 18, background: "var(--color-background-secondary)", borderRadius: 6, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, borderRadius: 6,
                background: `linear-gradient(90deg, ${accent}, #10b981)` }}/>
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, width: 58, textAlign: "right", flexShrink: 0 }}>
              {p.value}/{p.max}
            </span>
            {p.note && <span style={{ fontSize: 11, color: "var(--color-text-secondary)", maxWidth: 120,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.note}</span>}
            {onDelete && (
              <button onClick={() => onDelete(p.id)} title="Удалить" style={{ background: "none", border: "none",
                cursor: "pointer", color: "var(--color-text-secondary)", display: "flex", padding: 2 }}>
                <Trash2 size={13}/>
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function ScoreTracker({ user, accent = "#e11d48", onBack }) {
  const [essays, setEssays] = useState(null);  // из essay_reviews
  const [mocks, setMocks] = useState(null);    // из score_log (кросс-девайс)
  // форма пробника
  const [value, setValue] = useState("");
  const [max, setMax] = useState(50);
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [adding, setAdding] = useState(false);

  // Прогресс по сочинениям
  useEffect(() => {
    let on = true;
    supabase.from("essay_reviews")
      .select("ai_balls, author_balls, created_at")
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (!on) return;
        if (error) { setEssays([]); return; }
        const s = (data || [])
          .map((r) => ({ value: r.author_balls ?? r.ai_balls, max: 22, date: r.created_at }))
          .filter((x) => typeof x.value === "number");
        setEssays(s);
      });
    return () => { on = false; };
  }, [user?.id]);

  // Журнал пробников (БД)
  const loadMocks = () => {
    supabase.from("score_log")
      .select("id, value, max_value, note, taken_at")
      .order("taken_at", { ascending: true })
      .then(({ data, error }) => {
        if (error) { setMocks([]); return; }
        setMocks((data || []).map((r) => ({
          id: r.id, value: Number(r.value), max: Number(r.max_value), note: r.note, date: r.taken_at,
        })));
      });
  };
  useEffect(() => { loadMocks(); /* eslint-disable-next-line */ }, [user?.id]);

  const addMock = async () => {
    const v = Number(value);
    if ((!v && v !== 0) || !user || adding) return;
    setAdding(true);
    const { error } = await supabase.from("score_log").insert({
      user_id: user.id, value: Math.max(0, v), max_value: Number(max),
      note: note.trim() || null, taken_at: date, kind: "mock",
    });
    setAdding(false);
    if (!error) { setValue(""); setNote(""); setDate(todayISO()); loadMocks(); }
  };
  const delMock = async (id) => {
    setMocks((m) => (m || []).filter((x) => x.id !== id)); // оптимистично
    await supabase.from("score_log").delete().eq("id", id);
  };

  const mockSeries = useMemo(() => (mocks || []).slice().sort((a, b) => a.date.localeCompare(b.date)), [mocks]);

  const inputS = {
    padding: "9px 11px", fontSize: 13, borderRadius: 9, fontFamily: "inherit",
    border: "0.5px solid var(--color-border-secondary)",
    background: "var(--color-background-primary)", color: "var(--color-text-primary)",
  };

  return (
    <div>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, background: "none",
        border: "none", cursor: "pointer", fontSize: 13, color: "var(--color-text-secondary)", padding: "0 0 14px 0" }}>
        <ArrowLeft size={14}/> Назад
      </button>

      <div style={{ ...card(), padding: "18px 20px", marginBottom: 14,
        background: `linear-gradient(135deg, ${accent}18, transparent)`, borderLeft: `4px solid ${accent}` }}>
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
          <TrendingUp size={20} style={{ color: accent }}/> Мой прогресс
        </div>
        <div style={{ fontSize: 12.5, color: "var(--color-text-secondary)" }}>
          Главное — не балл сегодня, а рост. Записи синхронизируются между устройствами.
        </div>
      </div>

      {/* До → после */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <DeltaHead title="Сочинение (из 22)" accent={accent} unit="" series={essays || []}/>
        <DeltaHead title="Пробники" accent={accent} unit="" series={mockSeries}/>
      </div>

      {/* Сочинения */}
      <div style={{ ...card(), padding: "14px 16px", marginBottom: 12 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700 }}>Сочинения по К1–К10</div>
        <div style={{ fontSize: 11.5, color: "var(--color-text-secondary)", marginTop: 2 }}>
          Берётся автоматически из твоих проверок (балл автора, если есть, иначе ИИ).
        </div>
        {essays === null ? (
          <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "12px 0",
            fontSize: 12.5, color: "var(--color-text-secondary)" }}>
            <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }}/> Загружаем…
          </div>
        ) : essays.length === 0 ? (
          <div style={{ fontSize: 12.5, color: "var(--color-text-secondary)", marginTop: 10 }}>
            Пока пусто. Открой урок сочинения → «Проверить по К1–К10» — и первый балл появится здесь.
          </div>
        ) : (
          <Bars series={essays} accent={accent}/>
        )}
      </div>

      {/* Пробники */}
      <div style={{ ...card(), padding: "14px 16px" }}>
        <div style={{ fontSize: 13.5, fontWeight: 700 }}>Журнал пробников</div>
        <div style={{ fontSize: 11.5, color: "var(--color-text-secondary)", marginTop: 2, marginBottom: 10 }}>
          Записывай результат каждого пробника — сохраняется в твоём аккаунте на всех устройствах.
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 4 }}>
          <input type="number" min={0} value={value} onChange={(e) => setValue(e.target.value)}
            placeholder="Балл" style={{ ...inputS, width: 80 }}/>
          <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>из</span>
          <select value={max} onChange={(e) => setMax(Number(e.target.value))} style={{ ...inputS, width: 110 }}>
            <option value={50}>50 (первичный)</option>
            <option value={100}>100 (тестовый)</option>
          </select>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...inputS }}/>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="заметка (необяз.)"
            style={{ ...inputS, flex: 1, minWidth: 120 }}/>
          <button onClick={addMock} disabled={value === "" || adding} style={{
            display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 9,
            border: "none", cursor: (value === "" || adding) ? "default" : "pointer", color: "#fff", fontSize: 13, fontWeight: 600,
            background: (value === "" || adding) ? "var(--color-border-secondary)" : `linear-gradient(135deg, ${accent}, ${accent}cc)`,
          }}>
            {adding ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }}/> : <Plus size={15}/>} Добавить
          </button>
        </div>

        {mocks === null ? (
          <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "12px 0",
            fontSize: 12.5, color: "var(--color-text-secondary)" }}>
            <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }}/> Загружаем…
          </div>
        ) : mockSeries.length === 0 ? (
          <div style={{ fontSize: 12.5, color: "var(--color-text-secondary)", marginTop: 10 }}>
            Запишешь первый пробник — увидишь динамику «до → после».
          </div>
        ) : (
          <Bars series={mockSeries} accent={accent} onDelete={delMock}/>
        )}
      </div>
    </div>
  );
}
