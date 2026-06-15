// ═══════════════════════════════════════════════════════════════════
//  EssayChecker.jsx — проверка сочинения (задание 27) по критериям
//  К1–К10 ФИПИ 2026. Уходит в Edge Function ai-tutor (mode: "essay").
//  Это «фишка» курса: то, что автопроверка маркетплейсов не умеет.
// ═══════════════════════════════════════════════════════════════════

import { useMemo, useState } from "react";
import { X, Loader2, CheckCircle2, FileText, Send } from "lucide-react";
import { supabase } from "./supabase";
import CourseMarkdown from "./CourseMarkdown";

const wc = (s) => (s.trim().match(/[^\s]+/g) || []).length;

export default function EssayChecker({ lessonId, accent = "#e11d48", onClose, free = false }) {
  const [source, setSource] = useState("");
  const [essay, setEssay] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // { answer, balls, words }
  const [error, setError] = useState(null);
  const [remaining, setRemaining] = useState(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const words = useMemo(() => wc(essay), [essay]);
  const tooShort = words > 0 && words < 150;

  const check = async () => {
    if (!essay.trim() || busy) return;
    setBusy(true); setError(null); setResult(null); setSent(false);
    try {
      const { data, error: err } = await supabase.functions.invoke("ai-tutor", {
        body: free
          ? { mode: "essay", free: true, essay, source_text: source }
          : { lesson_id: lessonId, mode: "essay", essay, source_text: source },
      });
      if (err) {
        let detail = err.message;
        try { const ctx = await err.context?.json?.(); if (ctx?.error) detail = ctx.error; } catch { /* ignore */ }
        setError(detail || "Не получилось проверить, попробуй ещё раз.");
      } else if (data?.error) {
        setError(data.error);
      } else {
        setResult(data);
        if (typeof data?.remaining === "number") setRemaining(data.remaining);
      }
    } catch (e) {
      setError("Ошибка сети: " + e.message);
    }
    setBusy(false);
  };

  const sendToAuthor = async () => {
    if (!result?.review_id || sending || sent) return;
    setSending(true);
    try {
      const { error: e } = await supabase.rpc("request_essay_review", { p_id: result.review_id });
      if (!e) setSent(true);
    } catch { /* ignore */ }
    setSending(false);
  };

  const ta = {
    width: "100%", boxSizing: "border-box", padding: "10px 12px",
    fontSize: 13, lineHeight: 1.6, borderRadius: 10, resize: "vertical",
    border: "0.5px solid var(--color-border-secondary)",
    background: "var(--color-background-primary)", color: "var(--color-text-primary)",
    fontFamily: "inherit",
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 400, display: "flex",
      alignItems: "flex-start", justifyContent: "center", overflowY: "auto",
      background: "rgba(15,23,42,.45)", padding: "24px 12px",
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "min(680px, 100%)", background: "var(--color-background-primary)",
        borderRadius: 16, boxShadow: "0 18px 50px rgba(0,0,0,.25)", overflow: "hidden",
      }}>
        {/* Шапка */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10, padding: "14px 16px",
          background: `linear-gradient(135deg, ${accent}, ${accent}cc)`, color: "#fff",
        }}>
          <CheckCircle2 size={18}/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{free ? "Бесплатная проверка сочинения" : "Проверка сочинения по К1–К10"}</div>
            <div style={{ fontSize: 10.5, opacity: .9 }}>{free ? "Одна проверка по К1–К10 — бесплатно, без карты" : "Критерии ФИПИ 2026 · максимум 22 балла"}</div>
          </div>
          {remaining !== null && (
            <span style={{ fontSize: 10, opacity: .9, whiteSpace: "nowrap" }}>ещё {remaining}/день</span>
          )}
          <button onClick={onClose} style={{ background: "none", border: "none",
            color: "#fff", cursor: "pointer", display: "flex", padding: 2 }}>
            <X size={18}/>
          </button>
        </div>

        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Ввод */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)" }}>
              Исходный текст <span style={{ fontWeight: 400 }}>(по которому пишешь — желательно, для проверки К2)</span>
            </label>
            <textarea value={source} onChange={(e) => setSource(e.target.value)}
              rows={4} placeholder="Вставь текст из варианта…" style={{ ...ta, marginTop: 6 }}/>
          </div>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)" }}>
                Твоё сочинение
              </label>
              <span style={{ fontSize: 11, fontWeight: 600,
                color: tooShort ? "#ef4444" : words >= 150 ? "#10b981" : "var(--color-text-secondary)" }}>
                {words} слов{tooShort ? " · нужно ≥150" : ""}
              </span>
            </div>
            <textarea value={essay} onChange={(e) => setEssay(e.target.value)}
              rows={9} placeholder="Вставь своё сочинение целиком…" style={{ ...ta, marginTop: 6 }}/>
            {tooShort && (
              <div style={{ fontSize: 11.5, color: "#ef4444", marginTop: 5 }}>
                ⚠️ Меньше 150 слов — на ЕГЭ такая работа оценивается в 0 баллов. Можешь всё равно проверить для тренировки.
              </div>
            )}
          </div>

          <button onClick={check} disabled={busy || !essay.trim()} style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "12px 18px", borderRadius: 10, border: "none",
            background: busy || !essay.trim() ? "var(--color-border-secondary)"
              : `linear-gradient(135deg, ${accent}, ${accent}cc)`,
            color: "#fff", fontSize: 13.5, fontWeight: 600,
            cursor: busy || !essay.trim() ? "default" : "pointer",
          }}>
            {busy
              ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }}/> Проверяю по критериям…</>
              : <><FileText size={15}/> Проверить по К1–К10</>}
          </button>

          {error && (
            <div style={{ fontSize: 12.5, color: "#ef4444", background: "#ef444410",
              border: "0.5px solid #ef444433", borderRadius: 10, padding: "10px 12px" }}>
              ⚠️ {error}
            </div>
          )}

          {/* Результат */}
          {result && (
            <div style={{ borderTop: "0.5px solid var(--color-border-tertiary)", paddingTop: 12 }}>
              {typeof result.balls === "number" && (
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                  <div style={{ fontSize: 30, fontWeight: 800, color: accent, whiteSpace: "nowrap" }}>
                    {result.balls}<span style={{ fontSize: 16, color: "var(--color-text-secondary)" }}>/22</span>
                  </div>
                  <div style={{ flex: 1, height: 9, background: `${accent}22`, borderRadius: 99 }}>
                    <div style={{ height: "100%", width: `${Math.round((result.balls / 22) * 100)}%`,
                      background: `linear-gradient(90deg, ${accent}, #10b981)`, borderRadius: 99 }}/>
                  </div>
                </div>
              )}
              <div style={{ background: "var(--color-background-secondary)", borderRadius: 12, padding: "4px 14px 12px" }}>
                <CourseMarkdown text={result.answer} accent={accent}/>
              </div>
              {free && (
                <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 12,
                  background: `${accent}0d`, border: `1px solid ${accent}33`, fontSize: 12.5, lineHeight: 1.6 }}>
                  💡 Это твоя бесплатная проверка. Хочешь <b>безлимит проверок</b> и чтобы сочинение
                  разобрал <b>лично автор</b>? Это в полном курсе — закрой окно и открой доступ к курсу русского.
                </div>
              )}
              {result.review_id && (sent ? (
                <div style={{ marginTop: 10, fontSize: 12.5, color: "#10b981", fontWeight: 600 }}>
                  ✓ Отправлено автору. Вердикт появится в разделе «Мои сочинения».
                </div>
              ) : (
                <button onClick={sendToAuthor} disabled={sending} style={{
                  marginTop: 10, display: "inline-flex", alignItems: "center", gap: 7,
                  padding: "9px 14px", borderRadius: 10, cursor: sending ? "default" : "pointer",
                  border: `1px solid ${accent}`, background: `${accent}10`, color: accent,
                  fontSize: 12.5, fontWeight: 600,
                }}>
                  {sending ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }}/> : <Send size={14}/>}
                  Отправить автору на личную проверку
                </button>
              ))}
              <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 8, lineHeight: 1.5 }}>
                Оценка ИИ — ориентир: помогает увидеть слабые места до экзамена. Финальную проверку по спорным
                местам делает автор курса.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
