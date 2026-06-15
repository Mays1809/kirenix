// ═══════════════════════════════════════════════════════════════════
//  EssayReviews.jsx — «автор в петле».
//   • Ученик: список своих проверок сочинений + вердикт автора.
//   • Автор (admin): очередь на проверку, выставление балла и комментария.
//  RLS: ученик видит свои записи, админ — все. Вердикт — через rpc review_essay.
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, CheckCircle2, Clock, Bot } from "lucide-react";
import { supabase } from "./supabase";
import CourseMarkdown from "./CourseMarkdown";

const STATUS = {
  ai:       { label: "Проверено ИИ",      color: "#6366f1" },
  pending:  { label: "Ждёт автора",       color: "#f59e0b" },
  reviewed: { label: "Проверено автором", color: "#10b981" },
};

const card = (extra = {}) => ({
  background: "var(--color-background-primary)",
  borderRadius: "var(--border-radius-lg)",
  border: "0.5px solid var(--color-border-tertiary)",
  boxShadow: "var(--shadow-sm)",
  ...extra,
});

const fmt = (d) => {
  try {
    return new Date(d).toLocaleString("ru-RU",
      { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
};

function ReviewCard({ r, isAdmin, accent, onSaved }) {
  const [open, setOpen] = useState(false);
  const [balls, setBalls] = useState(r.author_balls ?? r.ai_balls ?? "");
  const [comment, setComment] = useState(r.author_comment ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const st = STATUS[r.status] || STATUS.ai;

  const save = async () => {
    setSaving(true); setSaved(false);
    const { error } = await supabase.rpc("review_essay", {
      p_id: r.id, p_balls: Number(balls) || 0, p_comment: comment || "",
    });
    setSaving(false);
    if (!error) { setSaved(true); onSaved && onSaved(); }
  };

  return (
    <div style={{ ...card(), padding: 0, overflow: "hidden" }}>
      <button onClick={() => setOpen((o) => !o)} style={{
        width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "12px 14px",
        background: "none", border: "none", cursor: "pointer", textAlign: "left",
      }}>
        <span style={{
          width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: `${st.color}18`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {r.status === "reviewed" ? <CheckCircle2 size={15} style={{ color: st.color }}/>
            : r.status === "pending" ? <Clock size={15} style={{ color: st.color }}/>
            : <Bot size={15} style={{ color: st.color }}/>}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 13, fontWeight: 600 }}>
            {isAdmin ? "Сочинение ученика" : "Моё сочинение"} · {fmt(r.created_at)}
          </span>
          <span style={{ display: "block", fontSize: 11.5, color: st.color, fontWeight: 600 }}>
            {st.label}
            {typeof r.ai_balls === "number" ? ` · ИИ ${r.ai_balls}/22` : ""}
            {typeof r.author_balls === "number" ? ` · автор ${r.author_balls}/22` : ""}
          </span>
        </span>
      </button>

      {open && (
        <div style={{ padding: "0 14px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
          {r.source_text && (
            <details>
              <summary style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)", cursor: "pointer" }}>
                Исходный текст
              </summary>
              <div style={{ fontSize: 12.5, lineHeight: 1.6, whiteSpace: "pre-wrap", marginTop: 6,
                color: "var(--color-text-secondary)" }}>{r.source_text}</div>
            </details>
          )}

          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: 4 }}>
              Текст сочинения {r.word_count ? `(${r.word_count} слов)` : ""}
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-wrap",
              background: "var(--color-background-secondary)", borderRadius: 10, padding: "10px 12px",
              maxHeight: 260, overflowY: "auto" }}>{r.essay}</div>
          </div>

          {r.ai_feedback && (
            <details open={isAdmin}>
              <summary style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)", cursor: "pointer" }}>
                Разбор ИИ по К1–К10
              </summary>
              <div style={{ background: "var(--color-background-secondary)", borderRadius: 10, padding: "2px 12px 10px", marginTop: 6 }}>
                <CourseMarkdown text={r.ai_feedback} accent={accent}/>
              </div>
            </details>
          )}

          {/* Вердикт автора — для ученика (чтение) */}
          {!isAdmin && r.status === "reviewed" && (
            <div style={{ ...card(), background: "#10b9810d", borderColor: "#10b98155", padding: "12px 14px" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#10b981", marginBottom: 6 }}>
                Вердикт автора: {r.author_balls}/22
              </div>
              {r.author_comment && (
                <div style={{ fontSize: 13, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{r.author_comment}</div>
              )}
            </div>
          )}
          {!isAdmin && r.status === "pending" && (
            <div style={{ fontSize: 12.5, color: "#f59e0b", fontWeight: 600 }}>
              ⏳ Отправлено автору — вердикт появится здесь.
            </div>
          )}

          {/* Форма вердикта — для автора */}
          {isAdmin && (
            <div style={{ ...card(), padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700 }}>Вердикт автора</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 12.5, color: "var(--color-text-secondary)" }}>Балл из 22:</span>
                <input type="number" min={0} max={22} value={balls}
                  onChange={(e) => setBalls(e.target.value)}
                  style={{ width: 80, padding: "8px 10px", fontSize: 14, fontWeight: 700, borderRadius: 8,
                    border: "0.5px solid var(--color-border-secondary)",
                    background: "var(--color-background-primary)", color: "var(--color-text-primary)" }}/>
              </div>
              <textarea value={comment} onChange={(e) => setComment(e.target.value)}
                rows={4} placeholder="Комментарий ученику: что хорошо, что исправить…"
                style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", fontSize: 13,
                  lineHeight: 1.6, borderRadius: 10, resize: "vertical", fontFamily: "inherit",
                  border: "0.5px solid var(--color-border-secondary)",
                  background: "var(--color-background-primary)", color: "var(--color-text-primary)" }}/>
              <button onClick={save} disabled={saving} style={{
                alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 7,
                padding: "9px 16px", borderRadius: 10, border: "none", cursor: saving ? "default" : "pointer",
                background: `linear-gradient(135deg, ${accent}, ${accent}cc)`, color: "#fff",
                fontSize: 13, fontWeight: 600,
              }}>
                {saving ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }}/> : <CheckCircle2 size={14}/>}
                {saved ? "Сохранено ✓" : r.status === "reviewed" ? "Обновить вердикт" : "Сохранить вердикт"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function EssayReviews({ isAdmin = false, accent = "#e11d48", onBack }) {
  const [rows, setRows] = useState(null);
  const [filter, setFilter] = useState(isAdmin ? "pending" : "all");

  const load = async () => {
    const { data } = await supabase
      .from("essay_reviews").select("*")
      .order("created_at", { ascending: false }).limit(100);
    setRows(data || []);
  };
  useEffect(() => { load(); }, []);

  const shown = (rows || []).filter((r) =>
    filter === "all" ? true : filter === "pending" ? r.status === "pending" : r.status === "reviewed");
  const pendingCount = (rows || []).filter((r) => r.status === "pending").length;

  const tabs = isAdmin
    ? [["pending", `Ждут проверки${pendingCount ? ` (${pendingCount})` : ""}`], ["reviewed", "Проверенные"], ["all", "Все"]]
    : [["all", "Все"], ["reviewed", "С вердиктом"]];

  return (
    <div>
      <button onClick={onBack} style={{
        display: "flex", alignItems: "center", gap: 6, background: "none", border: "none",
        cursor: "pointer", fontSize: 13, color: "var(--color-text-secondary)", padding: "0 0 14px 0",
      }}>
        <ArrowLeft size={14}/> Назад
      </button>

      <div style={{ ...card(), padding: "18px 20px", marginBottom: 14,
        background: `linear-gradient(135deg, ${accent}18, transparent)`, borderLeft: `4px solid ${accent}` }}>
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
          {isAdmin ? "✍️ Проверка сочинений" : "✍️ Мои сочинения"}
        </div>
        <div style={{ fontSize: 12.5, color: "var(--color-text-secondary)" }}>
          {isAdmin
            ? "Очередь работ учеников: смотри разбор ИИ и ставь финальный балл с комментарием."
            : "Твои проверки по К1–К10 и личный вердикт автора по отправленным работам."}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {tabs.map(([k, label]) => (
          <button key={k} onClick={() => setFilter(k)} style={{
            padding: "7px 14px", borderRadius: 99, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
            border: filter === k ? "none" : "0.5px solid var(--color-border-secondary)",
            background: filter === k ? accent : "var(--color-background-primary)",
            color: filter === k ? "#fff" : "var(--color-text-secondary)",
          }}>{label}</button>
        ))}
      </div>

      {rows === null ? (
        <div style={{ ...card(), padding: 40, display: "flex", justifyContent: "center", gap: 8,
          color: "var(--color-text-secondary)", fontSize: 13 }}>
          <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }}/> Загружаем…
        </div>
      ) : shown.length === 0 ? (
        <div style={{ ...card(), padding: 28, textAlign: "center", color: "var(--color-text-secondary)", fontSize: 13 }}>
          {isAdmin ? "Пока нет работ в этой вкладке." : "Здесь появятся твои проверенные сочинения. Открой урок сочинения и нажми «Проверить»."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {shown.map((r) => (
            <ReviewCard key={r.id} r={r} isAdmin={isAdmin} accent={accent} onSaved={load}/>
          ))}
        </div>
      )}
    </div>
  );
}
