// ═══════════════════════════════════════════════════════════════════
//  Reviews.jsx — отзывы.
//  Ученик оставляет отзыв (оценка + текст) → статус «на модерации».
//  Автор (admin) одобряет/скрывает. Одобренные показываются на лендинге.
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import { ArrowLeft, Star, Loader2, Send, Clock, Eye, EyeOff } from "lucide-react";
import { supabase } from "./supabase";

const card = (extra = {}) => ({
  background: "var(--color-background-primary)",
  borderRadius: "var(--border-radius-lg)",
  border: "0.5px solid var(--color-border-tertiary)",
  boxShadow: "var(--shadow-sm)",
  ...extra,
});

function Stars({ value, onChange, size = 22 }) {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={() => onChange && onChange(n)}
          style={{ background: "none", border: "none", padding: 0, display: "flex",
            cursor: onChange ? "pointer" : "default" }}>
          <Star size={size} style={{ color: "#f59e0b", fill: n <= value ? "#f59e0b" : "transparent" }} />
        </button>
      ))}
    </div>
  );
}

const STATUS_LABEL = {
  pending: { t: "На модерации", c: "#f59e0b", I: Clock },
  approved: { t: "Опубликован", c: "#10b981", I: Eye },
  hidden: { t: "Скрыт", c: "#ef4444", I: EyeOff },
};

export default function Reviews({ user, profile, onBack }) {
  const isAdmin = profile?.role === "admin";
  const [loading, setLoading] = useState(true);
  const [mine, setMine] = useState(null);
  const [all, setAll] = useState([]);
  const [rating, setRating] = useState(5);
  const [name, setName] = useState(profile?.full_name || "");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = async () => {
    setLoading(true);
    if (isAdmin) {
      const { data } = await supabase.from("reviews").select("*")
        .order("created_at", { ascending: false });
      setAll(data || []);
    } else {
      const { data } = await supabase.from("reviews").select("*")
        .eq("user_id", user.id).order("created_at", { ascending: false }).limit(1);
      setMine(data && data[0] ? data[0] : null);
    }
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const submit = async () => {
    if (body.trim().length < 3 || busy) return;
    setBusy(true); setErr("");
    const { error } = await supabase.from("reviews").insert({
      user_id: user.id, author_name: name.trim() || "Ученик",
      rating, body: body.trim(), status: "pending",
    });
    setBusy(false);
    if (error) setErr(error.message);
    else { setBody(""); load(); }
  };

  const moderate = async (id, status) => {
    await supabase.from("reviews").update({ status }).eq("id", id);
    load();
  };

  const input = {
    width: "100%", boxSizing: "border-box", padding: "10px 12px", fontSize: 13.5,
    borderRadius: 10, border: "0.5px solid var(--color-border-secondary)",
    background: "var(--color-background-primary)", color: "var(--color-text-primary)",
    fontFamily: "inherit",
  };

  return (
    <div>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6,
        background: "none", border: "none", cursor: "pointer", fontSize: 13,
        color: "var(--color-text-secondary)", padding: "0 0 14px 0" }}>
        <ArrowLeft size={14}/> В кабинет
      </button>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 40,
          color: "var(--color-text-secondary)", gap: 8, fontSize: 13 }}>
          <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }}/> Загружаем…
        </div>
      ) : isAdmin ? (
        /* ───── Модерация (автор) ───── */
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>Модерация отзывов</div>
          <div style={{ fontSize: 12.5, color: "var(--color-text-secondary)", marginBottom: 14 }}>
            Одобренные отзывы показываются на главной. Всего: {all.length}.
          </div>
          {all.length === 0 && (
            <div style={{ ...card(), padding: 16, fontSize: 13, color: "var(--color-text-secondary)" }}>
              Пока отзывов нет.
            </div>
          )}
          {all.map((r) => {
            const s = STATUS_LABEL[r.status] || STATUS_LABEL.pending;
            return (
              <div key={r.id} style={{ ...card(), padding: 14, marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <strong style={{ fontSize: 13.5 }}>{r.author_name}</strong>
                  <Stars value={r.rating} size={14}/>
                  <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 600, color: s.c,
                    display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <s.I size={12}/> {s.t}
                  </span>
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.55, marginBottom: 10 }}>{r.body}</div>
                <div style={{ display: "flex", gap: 8 }}>
                  {r.status !== "approved" && (
                    <button onClick={() => moderate(r.id, "approved")} style={{
                      padding: "7px 12px", borderRadius: 8, border: "none", cursor: "pointer",
                      background: "#10b981", color: "#fff", fontSize: 12.5, fontWeight: 600 }}>
                      Одобрить
                    </button>
                  )}
                  {r.status !== "hidden" && (
                    <button onClick={() => moderate(r.id, "hidden")} style={{
                      padding: "7px 12px", borderRadius: 8, cursor: "pointer",
                      border: "0.5px solid var(--color-border-secondary)",
                      background: "var(--color-background-primary)",
                      color: "var(--color-text-secondary)", fontSize: 12.5, fontWeight: 600 }}>
                      Скрыть
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : mine ? (
        /* ───── У ученика уже есть отзыв ───── */
        <div style={{ ...card(), padding: 18 }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>Ваш отзыв</div>
          <Stars value={mine.rating} size={18}/>
          <div style={{ fontSize: 13.5, lineHeight: 1.6, margin: "10px 0 12px" }}>{mine.body}</div>
          {(() => { const s = STATUS_LABEL[mine.status] || STATUS_LABEL.pending; return (
            <div style={{ fontSize: 12.5, fontWeight: 600, color: s.c,
              display: "inline-flex", alignItems: "center", gap: 6 }}>
              <s.I size={14}/> {s.t}
              {mine.status === "pending" && <span style={{ color: "var(--color-text-secondary)", fontWeight: 400 }}>
                — автор проверит и опубликует</span>}
            </div>
          ); })()}
        </div>
      ) : (
        /* ───── Форма отзыва ───── */
        <div style={{ ...card(), padding: 18 }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Оставьте отзыв</div>
          <div style={{ fontSize: 12.5, color: "var(--color-text-secondary)", marginBottom: 14 }}>
            Расскажите, как вам курс — после проверки автором отзыв появится на главной.
          </div>
          <label style={{ fontSize: 12.5, fontWeight: 600 }}>Как вас подписать</label>
          <input value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Имя (например: Аня, 11 класс)" style={{ ...input, margin: "6px 0 14px" }}/>
          <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>Оценка</div>
          <div style={{ marginBottom: 14 }}><Stars value={rating} onChange={setRating}/></div>
          <label style={{ fontSize: 12.5, fontWeight: 600 }}>Отзыв</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5}
            placeholder="Что понравилось, что помогло, какой результат…"
            style={{ ...input, margin: "6px 0 4px", resize: "vertical" }}/>
          {err && <div style={{ fontSize: 12, color: "#ef4444", marginBottom: 8 }}>⚠️ {err}</div>}
          <button onClick={submit} disabled={busy || body.trim().length < 3} style={{
            marginTop: 8, display: "inline-flex", alignItems: "center", gap: 8,
            padding: "11px 18px", borderRadius: 10, border: "none",
            background: busy || body.trim().length < 3 ? "var(--color-border-secondary)"
              : "linear-gradient(135deg,#e11d48,#f59e0b)",
            color: "#fff", fontSize: 13.5, fontWeight: 700,
            cursor: busy || body.trim().length < 3 ? "default" : "pointer" }}>
            {busy ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }}/> : <Send size={15}/>}
            Отправить на модерацию
          </button>
        </div>
      )}
    </div>
  );
}
