// ═══════════════════════════════════════════════════════════════════
//  MedalTracker.jsx — трекер золотой медали.
//  Ученик заполняет итоговые оценки 10–11 классов и баллы ЕГЭ,
//  трекер показывает прогресс, выполнение условий и «угрозы» медали.
//  Данные — в student_profiles.medal_data (jsonb), только своя строка (RLS).
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import { ArrowLeft, Medal, Save, Loader2, CheckCircle, AlertCircle, Plus, X } from "lucide-react";
import { supabase } from "./supabase";
import { MEDAL_SUBJECTS, EGE_SUBJECTS, PERIODS, subjectItog, computeMedal } from "./medal";

const card = (extra = {}) => ({
  background: "var(--color-background-primary)",
  borderRadius: "var(--border-radius-lg)",
  border: "0.5px solid var(--color-border-tertiary)",
  ...extra,
});

const GRADES = [null, 2, 3, 4, 5];

// Базовый стиль инпутов/селектов ЕГЭ
const field = {
  padding: "8px 10px", fontSize: 13, borderRadius: 8,
  border: "0.5px solid var(--color-border-secondary)",
  background: "var(--color-background-primary)",
  color: "var(--color-text-primary)",
};

export default function MedalTracker({ user, onBack }) {
  const [data, setData] = useState(null);   // medal_data
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(0);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!user) { setLoading(false); setData({}); return; }
    supabase
      .from("student_profiles")
      .select("medal_data")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data: row, error }) => {
        if (error) setErr(error.message);
        setData(row?.medal_data || {});
        setLoading(false);
      });
  }, [user]);

  const save = async (next) => {
    setData(next);
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("student_profiles")
      .upsert({ id: user.id, medal_data: next, updated_at: new Date().toISOString() });
    setSaving(false);
    if (error) setErr(error.message);
    else { setErr(""); setSavedAt(Date.now()); }
  };

  // Оценка за период: marks[subject][cls][period]
  const setMark = (subject, cls, period, grade) => {
    const marks = { ...(data?.marks || {}) };
    const subj = { ...(marks[subject] || {}) };
    const c = { ...(subj[String(cls)] || {}) };
    if (grade) c[period] = grade; else delete c[period];
    subj[String(cls)] = c;
    marks[subject] = subj;
    save({ ...data, marks });
  };

  const setEge = (patch) =>
    save({ ...data, ege: { ...(data?.ege || {}), ...patch } });

  // ЕГЭ: второй предмет (список профильных)
  const egeOthers = Array.isArray(data?.ege?.subjects) ? data.ege.subjects : [];
  const addOther = () =>
    setEge({ subjects: [...egeOthers, { name: EGE_SUBJECTS[0], score: null }] });
  const setOther = (i, patch) =>
    setEge({ subjects: egeOthers.map((o, idx) => (idx === i ? { ...o, ...patch } : o)) });
  const removeOther = (i) =>
    setEge({ subjects: egeOthers.filter((_, idx) => idx !== i) });

  if (loading) {
    return (
      <div style={{ display:"flex", justifyContent:"center", padding:40,
        color:"var(--color-text-secondary)", gap:8, fontSize:13 }}>
        <Loader2 size={16} style={{ animation:"spin 1s linear infinite" }}/> Загружаем…
      </div>
    );
  }

  const m = computeMedal(data);
  const ege = data?.ege || {};

  return (
    <div>
      <button onClick={onBack} style={{
        display:"flex", alignItems:"center", gap:6, background:"none",
        border:"none", cursor:"pointer", fontSize:13,
        color:"var(--color-text-secondary)", padding:"0 0 14px 0",
      }}>
        <ArrowLeft size={14}/> В кабинет
      </button>

      {/* Прогресс */}
      <div style={{ ...card(), padding:20, marginBottom:14,
        background:"linear-gradient(135deg,#f59e0b18,#f9731610)",
        borderLeft:"4px solid #f59e0b" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
          <Medal size={22} style={{ color:"#f59e0b" }}/>
          <div style={{ fontSize:17, fontWeight:700, flex:1 }}>Путь к золотой медали</div>
          <span style={{ fontSize:20, fontWeight:800, color:"#f59e0b" }}>{m.pct}%</span>
        </div>
        <div style={{ height:8, background:"#f59e0b30", borderRadius:99, marginBottom:12 }}>
          <div style={{ height:"100%", width:`${m.pct}%`, borderRadius:99,
            background:"linear-gradient(90deg,#f59e0b,#f97316)", transition:"width .3s" }}/>
        </div>
        {m.conditions.map((c) => (
          <div key={c.label} style={{ display:"flex", gap:8, alignItems:"flex-start",
            fontSize:12.5, padding:"4px 0" }}>
            {c.ok
              ? <CheckCircle size={15} style={{ color:"#10b981", flexShrink:0, marginTop:1 }}/>
              : <AlertCircle size={15} style={{ color:"#f59e0b", flexShrink:0, marginTop:1 }}/>}
            <span style={{ flex:1 }}>{c.label}</span>
            <span style={{ color:"var(--color-text-secondary)", whiteSpace:"nowrap" }}>{c.detail}</span>
          </div>
        ))}
        <div style={{ fontSize:10.5, color:"var(--color-text-secondary)", marginTop:8 }}>
          Условия медали «За особые успехи в учении» I степени (приказ Минпросвещения №546).
          {saving ? " Сохраняем…" : savedAt ? " Сохранено ✓" : ""}
        </div>
      </div>

      {err && (
        <div style={{ ...card(), padding:12, marginBottom:14, fontSize:12, color:"#ef4444" }}>
          Не удалось сохранить: {err}. Проверь, что применена миграция medal_and_ai.
        </div>
      )}

      {/* Угрозы */}
      {m.threats.length > 0 && (
        <div style={{ ...card(), padding:16, marginBottom:14 }}>
          <div style={{ fontSize:13.5, fontWeight:700, marginBottom:8 }}>
            ⚠️ Что сейчас отделяет от медали — {m.threats.length}
          </div>
          {m.threats.slice(0, 12).map((t, i) => (
            <div key={i} style={{ fontSize:12.5, padding:"3px 0",
              color:"var(--color-text-secondary)" }}>• {t.text}</div>
          ))}
          {m.threats.length > 12 && (
            <div style={{ fontSize:11.5, color:"var(--color-text-secondary)" }}>
              …и ещё {m.threats.length - 12}
            </div>
          )}
        </div>
      )}

      {/* ЕГЭ */}
      <div style={{ ...card(), padding:16, marginBottom:14 }}>
        <div style={{ fontSize:13.5, fontWeight:700, marginBottom:10 }}>Баллы ЕГЭ (текущие или целевые)</div>
        <label style={{ fontSize:12, display:"inline-block", marginBottom:14 }}>
          Русский язык <span style={{ color:"var(--color-text-secondary)" }}>— нужно 70+</span>
          <input type="number" min="0" max="100" value={ege.rus ?? ""}
            onChange={(e)=>setEge({ rus: e.target.value ? Number(e.target.value) : null })}
            placeholder="70+" style={{ ...field, display:"block", width:110, marginTop:4 }}/>
        </label>

        <div style={{ fontSize:12, fontWeight:600, marginBottom:6 }}>
          Ещё один предмет 70+
          <span style={{ fontWeight:400, color:"var(--color-text-secondary)" }}> — любой профильный (математика, информатика, физика…)</span>
        </div>
        {egeOthers.length === 0 && (
          <div style={{ fontSize:11.5, color:"var(--color-text-secondary)", marginBottom:8 }}>
            Добавь предмет, который сдаёшь, кроме русского.
          </div>
        )}
        {egeOthers.map((o, i) => (
          <div key={i} style={{ display:"flex", gap:8, alignItems:"center", marginBottom:8 }}>
            <select value={o.name || EGE_SUBJECTS[0]}
              onChange={(e)=>setOther(i, { name: e.target.value })}
              style={{ ...field, flex:1, minWidth:0 }}>
              {EGE_SUBJECTS.map((s)=>(<option key={s} value={s}>{s}</option>))}
            </select>
            <input type="number" min="0" max="100" value={o.score ?? ""}
              onChange={(e)=>setOther(i, { score: e.target.value ? Number(e.target.value) : null })}
              placeholder="балл" style={{ ...field, width:80 }}/>
            <button onClick={()=>removeOther(i)} title="Удалить"
              style={{ background:"none", border:"none", cursor:"pointer",
                color:"var(--color-text-secondary)", display:"flex", padding:4 }}>
              <X size={15}/>
            </button>
          </div>
        ))}
        <button onClick={addOther}
          style={{ display:"inline-flex", alignItems:"center", gap:6, marginTop:2,
            padding:"7px 12px", borderRadius:8, cursor:"pointer",
            border:"0.5px solid var(--color-border-secondary)",
            background:"var(--color-background-primary)",
            color:"var(--color-text-primary)", fontSize:12.5, fontWeight:600 }}>
          <Plus size={14}/> Добавить предмет
        </button>

        <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginTop:10 }}>
          💡 Для медали нужны русский 70+ и ещё любой один предмет 70+. Математику сдавать
          необязательно — подойдёт информатика, физика, обществознание и т.д.
        </div>
      </div>

      {/* Оценки */}
      <div style={{ ...card(), padding:16 }}>
        <div style={{ fontSize:13.5, fontWeight:700, marginBottom:4 }}>
          Оценки по предметам
        </div>
        <div style={{ fontSize:11.5, color:"var(--color-text-secondary)", marginBottom:12 }}>
          Вводи полугодовые и годовые за 10 и 11 класс — итоговая (как в аттестате)
          посчитается сама. Не изучаешь предмет — оставь пустым.
        </div>
        <div style={{ overflowX:"auto" }}>
          <table style={{ borderCollapse:"collapse", width:"100%", fontSize:12 }}>
            <thead>
              <tr style={{ color:"var(--color-text-secondary)" }}>
                <th rowSpan={2} style={{ textAlign:"left", padding:"4px 8px", position:"sticky", left:0,
                  background:"var(--color-background-primary)" }}>Предмет</th>
                <th colSpan={3} style={{ padding:"4px 8px", borderBottom:"0.5px solid var(--color-border-tertiary)" }}>10 класс</th>
                <th colSpan={3} style={{ padding:"4px 8px", borderBottom:"0.5px solid var(--color-border-tertiary)" }}>11 класс</th>
                <th rowSpan={2} style={{ padding:"4px 8px" }}>Итог</th>
              </tr>
              <tr style={{ color:"var(--color-text-secondary)", fontSize:10.5 }}>
                {[...PERIODS, ...PERIODS].map((p, i) => (
                  <th key={i} style={{ padding:"2px 6px", fontWeight:500 }} title={p.title}>{p.short}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MEDAL_SUBJECTS.map((s) => {
                const r = subjectItog(data?.marks?.[s]);
                return (
                  <tr key={s} style={{ borderTop:"0.5px solid var(--color-border-tertiary)" }}>
                    <td style={{ padding:"4px 8px", whiteSpace:"nowrap", position:"sticky", left:0,
                      background:"var(--color-background-primary)" }}>{s}</td>
                    {[10, 11].map((cls) =>
                      PERIODS.map((p) => {
                        const val = data?.marks?.[s]?.[String(cls)]?.[p.key] || "";
                        return (
                          <td key={`${cls}-${p.key}`} style={{ padding:"3px 4px", textAlign:"center" }}>
                            <select value={val}
                              onChange={(e)=>setMark(s, cls, p.key, e.target.value ? Number(e.target.value) : null)}
                              style={{ padding:"5px 6px", fontSize:12, borderRadius:7,
                                border:"0.5px solid var(--color-border-secondary)",
                                background: val === 5 ? "#10b98115" : val && val < 5 ? "#f59e0b15"
                                  : "var(--color-background-primary)",
                                color:"var(--color-text-primary)" }}>
                              {GRADES.map((g) => (
                                <option key={g ?? "-"} value={g ?? ""}>{g ?? "—"}</option>
                              ))}
                            </select>
                          </td>
                        );
                      })
                    )}
                    <td style={{ padding:"3px 8px", textAlign:"center", fontWeight:700,
                      color: r ? (r.itog === 5 ? "#10b981" : "#f59e0b") : "var(--color-text-secondary)" }}>
                      {r ? r.itog : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:10,
          fontSize:11.5, color:"var(--color-text-secondary)" }}>
          <Save size={12}/> Сохраняется автоматически. Итоговая = среднее всех оценок предмета, округлённое.
        </div>
      </div>
    </div>
  );
}
