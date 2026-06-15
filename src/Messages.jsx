// ═══════════════════════════════════════════════════════════════════
//  Messages.jsx — сообщения.
//  Ученик: один диалог с автором курса (Кириллом).
//  Админ: список диалогов всех учеников + ответы.
//  Обновление — при открытии и раз в 10 секунд (без realtime).
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Send, Loader2, MessageCircle, User } from "lucide-react";
import { supabase } from "./supabase";

const card = (extra = {}) => ({
  background: "var(--color-background-primary)",
  borderRadius: "var(--border-radius-lg)",
  border: "0.5px solid var(--color-border-tertiary)",
  ...extra,
});

const Bubble = ({ mine, name, text, time }) => (
  <div style={{
    alignSelf: mine ? "flex-end" : "flex-start",
    maxWidth: "80%", padding: "9px 12px", borderRadius: 12,
    fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap",
    background: mine ? "#3b82f6" : "var(--color-background-secondary)",
    color: mine ? "#fff" : "var(--color-text-primary)",
    borderBottomRightRadius: mine ? 4 : 12,
    borderBottomLeftRadius: mine ? 12 : 4,
  }}>
    {name && (
      <div style={{ fontSize: 10.5, fontWeight: 700, opacity: .75, marginBottom: 2 }}>{name}</div>
    )}
    {text}
    <div style={{ fontSize: 9.5, opacity: .6, textAlign: "right", marginTop: 3 }}>{time}</div>
  </div>
);

const fmtTime = (iso) => {
  const d = new Date(iso);
  const today = new Date().toDateString() === d.toDateString();
  return today
    ? d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" }) +
      " " + d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
};

export default function Messages({ user, profile, isAdmin, onBack }) {
  const [all, setAll] = useState(null);      // все доступные сообщения
  const [thread, setThread] = useState(null); // user_id открытого диалога (для админа)
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);

  const load = async () => {
    const { data } = await supabase
      .from("support_messages")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(500);
    setAll(data || []);
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);

  /* диалоги для админа */
  const threads = useMemo(() => {
    if (!isAdmin || !all) return [];
    const map = new Map();
    for (const m of all) {
      const cur = map.get(m.user_id) || { user_id: m.user_id, name: null, last: null, unread: 0 };
      if (m.user_name) cur.name = m.user_name;
      cur.last = m;
      if (m.sender === "student" && !m.is_read) cur.unread++;
      map.set(m.user_id, cur);
    }
    return [...map.values()].sort((a, b) =>
      new Date(b.last.created_at) - new Date(a.last.created_at));
  }, [all, isAdmin]);

  const threadId = isAdmin ? thread : user?.id;
  const msgs = useMemo(
    () => (all || []).filter((m) => m.user_id === threadId),
    [all, threadId]
  );

  /* пометить входящие прочитанными при открытии диалога */
  useEffect(() => {
    if (!all || !threadId) return;
    const incoming = isAdmin ? "student" : "owner";
    const unread = msgs.filter((m) => m.sender === incoming && !m.is_read);
    if (!unread.length) return;
    supabase.from("support_messages")
      .update({ is_read: true })
      .in("id", unread.map((m) => m.id))
      .then(() => {});
  }, [threadId, all]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending || !threadId) return;
    setSending(true);
    setInput("");
    const row = {
      user_id: threadId,
      sender: isAdmin ? "owner" : "student",
      user_name: isAdmin ? null : (profile?.full_name || user?.email || ""),
      text,
    };
    const { error } = await supabase.from("support_messages").insert(row);
    if (error) alert("Не отправилось: " + error.message);
    await load();
    setSending(false);
  };

  if (!user) {
    return (
      <div style={{ ...card(), padding: 24, textAlign: "center", fontSize: 13 }}>
        Войди в аккаунт, чтобы написать автору курса.
      </div>
    );
  }

  /* ── список диалогов (админ, пока не открыт диалог) ── */
  if (isAdmin && !thread) {
    return (
      <div>
        <button onClick={onBack} style={{
          display: "flex", alignItems: "center", gap: 6, background: "none",
          border: "none", cursor: "pointer", fontSize: 13,
          color: "var(--color-text-secondary)", padding: "0 0 14px 0",
        }}>
          <ArrowLeft size={14}/> Назад
        </button>
        <div style={{ ...card(), overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", fontSize: 14, fontWeight: 700,
            borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
            💬 Сообщения учеников
          </div>
          {all === null ? (
            <div style={{ padding: 24, textAlign: "center" }}>
              <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }}/>
            </div>
          ) : threads.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", fontSize: 13,
              color: "var(--color-text-secondary)" }}>
              Пока никто не писал. Когда ученик отправит сообщение — оно появится здесь.
            </div>
          ) : threads.map((t) => (
            <button key={t.user_id} onClick={() => setThread(t.user_id)} style={{
              width: "100%", display: "flex", gap: 10, alignItems: "center",
              padding: "12px 16px", background: "none", textAlign: "left",
              borderWidth: "0.5px 0 0 0", borderStyle: "solid",
              borderColor: "var(--color-border-tertiary)", cursor: "pointer",
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                background: "#6366f1", color: "#fff", display: "flex",
                alignItems: "center", justifyContent: "center",
              }}><User size={16}/></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  {t.name || "Ученик"}
                </div>
                <div style={{ fontSize: 11.5, color: "var(--color-text-secondary)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {t.last.sender === "owner" ? "Ты: " : ""}{t.last.text}
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 10, color: "var(--color-text-secondary)" }}>
                  {fmtTime(t.last.created_at)}
                </div>
                {t.unread > 0 && (
                  <span style={{
                    display: "inline-block", marginTop: 3, minWidth: 18,
                    padding: "1px 5px", borderRadius: 99, background: "#ef4444",
                    color: "#fff", fontSize: 10, fontWeight: 700, textAlign: "center",
                  }}>{t.unread}</span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  /* ── сам диалог ── */
  const headerName = isAdmin
    ? (threads.find((t) => t.user_id === thread)?.name || "Ученик")
    : "Кирилл Шевелев · автор курса";

  return (
    <div>
      <button
        onClick={() => (isAdmin ? setThread(null) : onBack())}
        style={{
          display: "flex", alignItems: "center", gap: 6, background: "none",
          border: "none", cursor: "pointer", fontSize: 13,
          color: "var(--color-text-secondary)", padding: "0 0 14px 0",
        }}>
        <ArrowLeft size={14}/> {isAdmin ? "Ко всем диалогам" : "Назад"}
      </button>

      <div style={{ ...card(), display: "flex", flexDirection: "column",
        height: "min(620px, 74vh)", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10,
          padding: "12px 16px", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
          <div style={{
            width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
            background: "linear-gradient(135deg,#3b82f6,#6366f1)", color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: 700,
          }}>{isAdmin ? <User size={15}/> : "КШ"}</div>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 700 }}>{headerName}</div>
            <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
              {isAdmin ? "диалог ученика" : "отвечает лично, обычно в течение дня"}
            </div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 14,
          display: "flex", flexDirection: "column", gap: 8 }}>
          {all === null ? (
            <div style={{ textAlign: "center", padding: 20 }}>
              <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }}/>
            </div>
          ) : msgs.length === 0 ? (
            <div style={{ textAlign: "center", padding: 30,
              color: "var(--color-text-secondary)", fontSize: 12.5, lineHeight: 1.7 }}>
              <MessageCircle size={26} style={{ marginBottom: 8, opacity: .5 }}/><br/>
              {isAdmin
                ? "В этом диалоге пока пусто."
                : "Напиши первым! Вопросы по урокам, оплате или медальному треку — отвечу лично."}
            </div>
          ) : msgs.map((m) => {
            const mine = isAdmin ? m.sender === "owner" : m.sender === "student";
            return (
              <Bubble key={m.id} mine={mine} text={m.text}
                time={fmtTime(m.created_at)}
                name={!mine ? (m.sender === "owner" ? "Кирилл" : (m.user_name || "Ученик")) : null}/>
            );
          })}
          <div ref={endRef}/>
        </div>

        <div style={{ display: "flex", gap: 8, padding: 10,
          borderTop: "0.5px solid var(--color-border-tertiary)" }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Написать сообщение…"
            style={{ flex: 1, padding: "10px 12px", fontSize: 13, borderRadius: 10,
              border: "0.5px solid var(--color-border-secondary)",
              background: "var(--color-background-primary)",
              color: "var(--color-text-primary)" }}
          />
          <button onClick={send} disabled={sending || !input.trim()} style={{
            width: 42, borderRadius: 10, border: "none",
            background: sending || !input.trim() ? "var(--color-border-secondary)" : "#3b82f6",
            color: "#fff", cursor: sending || !input.trim() ? "default" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {sending
              ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }}/>
              : <Send size={15}/>}
          </button>
        </div>
      </div>
    </div>
  );
}
