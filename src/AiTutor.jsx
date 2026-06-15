// ═══════════════════════════════════════════════════════════════════
//  AiTutor.jsx — чат с AI-репетитором внутри урока.
//  Вопросы уходят в Edge Function ai-tutor (контекст урока, лимит 25/день).
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from "react";
import { Bot, Send, X, Loader2 } from "lucide-react";
import { supabase } from "./supabase";

export default function AiTutor({ lessonId, lessonTitle, accent = "#3b82f6", onClose }) {
  const [messages, setMessages] = useState([{
    role: "assistant",
    content: "Привет! Я AI-репетитор. Застрял на чём-то в этом уроке — спрашивай, объясню по шагам. 🙂",
  }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [remaining, setRemaining] = useState(null);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  const send = async () => {
    const q = input.trim();
    if (!q || busy) return;
    setInput("");
    const history = messages.filter((m, i) => i > 0); // без приветствия
    setMessages((p) => [...p, { role: "user", content: q }]);
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-tutor", {
        body: { lesson_id: lessonId, question: q, history },
      });
      let msg;
      if (error) {
        let detail = error.message;
        try {
          const ctx = await error.context?.json?.();
          if (ctx?.error) detail = ctx.error;
        } catch { /* ignore */ }
        msg = "⚠️ " + (detail || "Не получилось, попробуй ещё раз.");
      } else if (data?.error) {
        msg = "⚠️ " + data.error;
      } else {
        msg = data?.answer || "Пустой ответ — попробуй переформулировать.";
        if (typeof data?.remaining === "number") setRemaining(data.remaining);
      }
      setMessages((p) => [...p, { role: "assistant", content: msg }]);
    } catch (e) {
      setMessages((p) => [...p, { role: "assistant", content: "⚠️ Ошибка сети: " + e.message }]);
    }
    setBusy(false);
  };

  return (
    <div style={{
      position: "fixed", bottom: 16, right: 16, zIndex: 300,
      width: "min(380px, calc(100vw - 32px))", height: "min(540px, 75vh)",
      display: "flex", flexDirection: "column",
      background: "var(--color-background-primary)",
      border: "0.5px solid var(--color-border-secondary)",
      borderRadius: 16, boxShadow: "0 12px 40px rgba(0,0,0,.18)", overflow: "hidden",
    }}>
      {/* Шапка */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10, padding: "12px 14px",
        background: `linear-gradient(135deg, ${accent}, ${accent}cc)`, color: "#fff",
      }}>
        <Bot size={18}/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>AI-репетитор</div>
          <div style={{ fontSize: 10.5, opacity: .85, overflow: "hidden",
            textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {lessonTitle}
          </div>
        </div>
        {remaining !== null && (
          <span style={{ fontSize: 10, opacity: .85, whiteSpace: "nowrap" }}>
            ещё {remaining}/день
          </span>
        )}
        <button onClick={onClose} style={{ background: "none", border: "none",
          color: "#fff", cursor: "pointer", display: "flex", padding: 2 }}>
          <X size={16}/>
        </button>
      </div>

      {/* Сообщения */}
      <div style={{ flex: 1, overflowY: "auto", padding: 12,
        display: "flex", flexDirection: "column", gap: 8 }}>
        {messages.map((m, i) => (
          <div key={i} style={{
            alignSelf: m.role === "user" ? "flex-end" : "flex-start",
            maxWidth: "85%", padding: "9px 12px", borderRadius: 12,
            fontSize: 12.5, lineHeight: 1.6, whiteSpace: "pre-wrap",
            background: m.role === "user" ? accent : "var(--color-background-secondary)",
            color: m.role === "user" ? "#fff" : "var(--color-text-primary)",
            borderBottomRightRadius: m.role === "user" ? 4 : 12,
            borderBottomLeftRadius: m.role === "user" ? 12 : 4,
          }}>
            {m.content}
          </div>
        ))}
        {busy && (
          <div style={{ alignSelf: "flex-start", display: "flex", gap: 6,
            alignItems: "center", padding: "9px 12px", borderRadius: 12,
            background: "var(--color-background-secondary)",
            fontSize: 12, color: "var(--color-text-secondary)" }}>
            <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }}/>
            Думаю…
          </div>
        )}
        <div ref={endRef}/>
      </div>

      {/* Ввод */}
      <div style={{ display: "flex", gap: 8, padding: 10,
        borderTop: "0.5px solid var(--color-border-tertiary)" }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Например: почему остатки читаем снизу вверх?"
          style={{ flex: 1, padding: "10px 12px", fontSize: 13, borderRadius: 10,
            border: "0.5px solid var(--color-border-secondary)",
            background: "var(--color-background-primary)",
            color: "var(--color-text-primary)" }}
        />
        <button onClick={send} disabled={busy || !input.trim()} style={{
          width: 40, borderRadius: 10, border: "none",
          background: busy || !input.trim() ? "var(--color-border-secondary)" : accent,
          color: "#fff", cursor: busy || !input.trim() ? "default" : "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Send size={15}/>
        </button>
      </div>
    </div>
  );
}
