// ═══════════════════════════════════════════════════════════════════
//  AiTutor.jsx — голосовой ИИ-наставник внутри урока.
//  Текст + ГОЛОС: ввод микрофоном и озвучка ответа через Web Speech API
//  (бесплатно, в браузере, ru-RU). Вопросы уходят в Edge Function ai-tutor
//  (контекст урока, лимит 25/день). Быстрые режимы «объясни проще».
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from "react";
import { Bot, Send, X, Loader2, Mic, Volume2, VolumeX } from "lucide-react";
import { supabase } from "./supabase";

// Поддержка браузером (Chrome/Edge — да; иначе кнопки прячем, текст работает)
const SR = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
const TTS = typeof window !== "undefined" && "speechSynthesis" in window;

// Быстрые режимы — отправляют наставнику уточняющую инструкцию
const QUICK = [
  ["Проще", "Объясни это ещё проще, как будто мне 12 лет."],
  ["Короче", "Сформулируй короче — в 2–3 предложениях."],
  ["Пример", "Приведи конкретный пример."],
  ["По шагам", "Разбери по шагам, по пунктам."],
];

export default function AiTutor({ lessonId, lessonTitle, accent = "#3b82f6", onClose }) {
  const [messages, setMessages] = useState([{
    role: "assistant",
    content: "Привет! Я ИИ-наставник. Спрашивай голосом 🎤 или текстом — объясню по шагам. 🙂",
  }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [remaining, setRemaining] = useState(null);
  const [listening, setListening] = useState(false);
  const [speak, setSpeak] = useState(false);
  const endRef = useRef(null);
  const recRef = useRef(null);
  const speakRef = useRef(false);   // актуальное значение для колбэков/таймеров
  speakRef.current = speak;

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, busy]);
  // чистим речь и распознавание при закрытии
  useEffect(() => () => { try { window.speechSynthesis?.cancel(); recRef.current?.stop?.(); } catch { /* ignore */ } }, []);

  // Озвучить текст ответа (если включён динамик)
  const sayAloud = (text) => {
    if (!speakRef.current || !TTS) return;
    const clean = String(text).replace(/[*_`#>•]/g, "").replace(/⚠️/g, "").trim();
    if (!clean) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(clean);
      u.lang = "ru-RU";
      const ru = window.speechSynthesis.getVoices().find((v) => (v.lang || "").toLowerCase().startsWith("ru"));
      if (ru) u.voice = ru;
      window.speechSynthesis.speak(u);
    } catch { /* ignore */ }
  };

  const send = async (override) => {
    const q = (typeof override === "string" ? override : input).trim();
    if (!q || busy) return;
    if (typeof override !== "string") setInput("");
    const history = messages.filter((_, i) => i > 0); // без приветствия
    setMessages((p) => [...p, { role: "user", content: q }]);
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-tutor", {
        body: { lesson_id: lessonId, question: q, history },
      });
      let msg;
      if (error) {
        let detail = error.message;
        try { const ctx = await error.context?.json?.(); if (ctx?.error) detail = ctx.error; } catch { /* ignore */ }
        msg = "⚠️ " + (detail || "Не получилось, попробуй ещё раз.");
      } else if (data?.error) {
        msg = "⚠️ " + data.error;
      } else {
        msg = data?.answer || "Пустой ответ — попробуй переформулировать.";
        if (typeof data?.remaining === "number") setRemaining(data.remaining);
      }
      setMessages((p) => [...p, { role: "assistant", content: msg }]);
      sayAloud(msg);
    } catch (e) {
      setMessages((p) => [...p, { role: "assistant", content: "⚠️ Ошибка сети: " + e.message }]);
    }
    setBusy(false);
  };

  // Микрофон: старт/стоп распознавания речи
  const toggleMic = () => {
    if (!SR || busy) return;
    if (listening) { try { recRef.current?.stop(); } catch { /* ignore */ } setListening(false); return; }
    try {
      window.speechSynthesis?.cancel(); // не слушать собственную озвучку
      const rec = new SR();
      rec.lang = "ru-RU"; rec.interimResults = false; rec.maxAlternatives = 1;
      rec.onresult = (e) => {
        const t = e.results?.[0]?.[0]?.transcript || "";
        setListening(false);
        if (t.trim()) send(t);
      };
      rec.onerror = () => setListening(false);
      rec.onend = () => setListening(false);
      recRef.current = rec;
      setListening(true);
      rec.start();
    } catch { setListening(false); }
  };

  const toggleSpeak = () => setSpeak((s) => {
    const next = !s;
    if (!next) { try { window.speechSynthesis?.cancel(); } catch { /* ignore */ } }
    return next;
  });

  const iconBtn = (extra = {}) => ({
    background: "none", border: "none", color: "#fff", cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center", padding: 3,
    borderRadius: 8, ...extra,
  });

  return (
    <div style={{
      position: "fixed", bottom: 16, right: 16, zIndex: 300,
      width: "min(380px, calc(100vw - 32px))", height: "min(560px, 76vh)",
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
        <Bot size={18} aria-hidden/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>ИИ-наставник</div>
          <div style={{ fontSize: 10.5, opacity: .85, overflow: "hidden",
            textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {lessonTitle}
          </div>
        </div>
        {remaining !== null && (
          <span style={{ fontSize: 10, opacity: .85, whiteSpace: "nowrap" }}>ещё {remaining}/день</span>
        )}
        {TTS && (
          <button onClick={toggleSpeak} title={speak ? "Озвучка включена" : "Озвучивать ответы"}
            aria-label={speak ? "Выключить озвучку" : "Включить озвучку"}
            style={iconBtn({ background: speak ? "rgba(255,255,255,.22)" : "none" })}>
            {speak ? <Volume2 size={16}/> : <VolumeX size={16}/>}
          </button>
        )}
        <button onClick={onClose} aria-label="Закрыть" style={iconBtn()}>
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

      {/* Быстрые режимы «объясни проще» */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "8px 10px 0" }}>
        {QUICK.map(([label, prompt]) => (
          <button key={label} onClick={() => send(prompt)} disabled={busy}
            style={{
              fontSize: 11, fontWeight: 600, padding: "5px 10px", borderRadius: 999,
              border: "0.5px solid var(--color-border-secondary)",
              background: "var(--color-background-secondary)",
              color: busy ? "var(--color-text-secondary)" : "var(--color-text-primary)",
              cursor: busy ? "default" : "pointer", whiteSpace: "nowrap",
            }}>
            {label}
          </button>
        ))}
      </div>

      {/* Ввод + микрофон */}
      <div style={{ display: "flex", gap: 8, padding: 10,
        borderTop: "0.5px solid var(--color-border-tertiary)" }}>
        {SR && (
          <button onClick={toggleMic} disabled={busy}
            aria-label={listening ? "Остановить запись" : "Говорить"}
            title={listening ? "Слушаю… нажми, чтобы остановить" : "Спросить голосом"}
            style={{
              width: 40, borderRadius: 10, border: "none", flexShrink: 0,
              background: listening ? "#ef4444" : "var(--color-background-secondary)",
              color: listening ? "#fff" : "var(--color-text-primary)",
              cursor: busy ? "default" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
            <Mic size={16}/>
          </button>
        )}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={listening ? "Слушаю… говори" : "Спроси текстом или голосом"}
          style={{ flex: 1, minWidth: 0, padding: "10px 12px", fontSize: 13, borderRadius: 10,
            border: "0.5px solid var(--color-border-secondary)",
            background: "var(--color-background-primary)",
            color: "var(--color-text-primary)" }}
        />
        <button onClick={() => send()} disabled={busy || !input.trim()} aria-label="Отправить" style={{
          width: 40, borderRadius: 10, border: "none", flexShrink: 0,
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
