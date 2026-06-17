// ═══════════════════════════════════════════════════════════════════
//  Admin.jsx — панель владельца (видна только isAdmin).
//   • Сводка: ученики, продажи, выручка, отзывы, рефералы
//   • Цены курсов + скрыть/показать на витрине
//   • Выдать / забрать доступ по email (любой, в т.ч. купленный — для возвратов)
//  Всё через admin-RPC с проверкой is_admin().
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Save, Gift, Trash2, Eye, EyeOff } from "lucide-react";
import { supabase } from "./supabase";

const card = (e = {}) => ({
  background: "var(--color-background-primary)",
  borderRadius: "var(--border-radius-lg)",
  border: "0.5px solid var(--color-border-tertiary)",
  boxShadow: "var(--shadow-sm)",
  ...e,
});
const input = {
  padding: "9px 11px", fontSize: 13, borderRadius: 9,
  border: "0.5px solid var(--color-border-secondary)",
  background: "var(--color-background-primary)", color: "var(--color-text-primary)",
};
const rub = (n) => `${Math.round(Number(n || 0)).toLocaleString()} ₽`;

export default function Admin({ isAdmin = false, onBack }) {
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState([]);
  const [prices, setPrices] = useState({});      // slug -> { price, original }
  const [access, setAccess] = useState([]);
  const [summary, setSummary] = useState(null);
  const [email, setEmail] = useState("");
  const [grantSlug, setGrantSlug] = useState("");
  const [savingSlug, setSavingSlug] = useState("");
  const [msg, setMsg] = useState("");

  const flash = (t) => { setMsg(t); setTimeout(() => setMsg(""), 3500); };

  const load = async () => {
    setLoading(true);
    const { data: cat } = await supabase.rpc("admin_list_courses");
    const list = (cat || []).map((c) => ({
      id: c.slug, title: c.title, price: c.price,
      original_price: c.original_price, is_published: c.is_published,
    }));
    setCourses(list);
    const p = {};
    list.forEach((c) => { p[c.id] = { price: c.price ?? "", original: c.original_price ?? "" }; });
    setPrices(p);
    setGrantSlug((s) => s || (list[0]?.id ?? ""));
    const [{ data: acc }, { data: sum }] = await Promise.all([
      supabase.rpc("admin_list_access"),
      supabase.rpc("admin_summary"),
    ]);
    setAccess(acc || []);
    setSummary(sum || null);
    setLoading(false);
  };
  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  const setP = (slug, field, val) =>
    setPrices((p) => ({ ...p, [slug]: { ...p[slug], [field]: val } }));

  const savePrice = async (slug) => {
    setSavingSlug(slug);
    const pr = prices[slug] || {};
    const { error } = await supabase.rpc("admin_set_price", {
      p_slug: slug,
      p_price: Number(pr.price) || 0,
      p_original: pr.original === "" || pr.original == null ? null : Number(pr.original),
    });
    setSavingSlug("");
    flash(error ? "Ошибка: " + error.message : "Цена сохранена ✓");
    if (!error) load();
  };

  const togglePublish = async (slug, current) => {
    await supabase.rpc("admin_set_published", { p_slug: slug, p_published: !current });
    flash(current ? "Курс скрыт с витрины" : "Курс снова на витрине");
    load();
  };

  const grant = async () => {
    if (!email.trim() || !grantSlug) return;
    const { data, error } = await supabase.rpc("admin_grant_access", {
      p_email: email.trim(), p_slug: grantSlug,
    });
    if (error) return flash("Ошибка: " + error.message);
    flash(
      data === "granted" ? "Доступ выдан ✓" :
      data === "already"  ? "У этого пользователя уже есть доступ" :
      data === "no_user"  ? "Нет пользователя с такой почтой — пусть сначала зарегистрируется на сайте" :
      "Готово");
    if (data === "granted") { setEmail(""); load(); }
  };

  const revoke = async (em, slug, source) => {
    if (source !== "manual" &&
        !window.confirm(`Убрать доступ у ${em}? Это для возврата — деньги автоматически НЕ вернутся, пропадёт только доступ к курсу.`))
      return;
    await supabase.rpc("admin_revoke_access", { p_email: em, p_slug: slug });
    flash("Доступ снят");
    load();
  };

  const titleOf = (slug) => courses.find((c) => c.id === slug)?.title || slug;

  if (!isAdmin) return null;

  const stat = (label, value, color) => (
    <div style={{ ...card(), padding: "12px 14px", flex: "1 1 120px", minWidth: 120 }}>
      <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: color || "var(--color-text-primary)" }}>{value}</div>
    </div>
  );

  return (
    <div>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6,
        background: "none", border: "none", cursor: "pointer", fontSize: 13,
        color: "var(--color-text-secondary)", padding: "0 0 14px 0" }}>
        <ArrowLeft size={14}/> В кабинет
      </button>

      <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>Управление</div>

      {msg && (
        <div style={{ ...card(), padding: "10px 14px", marginBottom: 14, fontSize: 13,
          borderLeft: "3px solid #6366f1" }}>{msg}</div>
      )}

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 40,
          color: "var(--color-text-secondary)", gap: 8, fontSize: 13 }}>
          <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }}/> Загружаем…
        </div>
      ) : (
        <>
          {/* ── Сводка ── */}
          {summary && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
              {stat("Учеников", summary.students ?? 0)}
              {stat("Продаж", summary.sales ?? 0)}
              {stat("Выручка", rub(summary.revenue), "#10b981")}
              {stat("Отзывов на модерации", summary.pending_reviews ?? 0, (summary.pending_reviews > 0) ? "#f59e0b" : undefined)}
              {stat("Рефералам к выплате", rub(summary.referral_due), (summary.referral_due > 0) ? "#e11d48" : undefined)}
            </div>
          )}

          {/* ── Цены и видимость ── */}
          <div style={{ ...card(), padding: 16, marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Курсы: цены и витрина</div>
            {courses.map((c) => {
              const pr = prices[c.id] || {};
              return (
                <div key={c.id} style={{ display: "flex", gap: 10, alignItems: "flex-end",
                  flexWrap: "wrap", padding: "10px 0", borderTop: "0.5px solid var(--color-border-tertiary)" }}>
                  <div style={{ flex: 1, minWidth: 130 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{c.title}</div>
                    {!c.is_published && <div style={{ fontSize: 10.5, color: "#ef4444", marginTop: 2 }}>скрыт с витрины</div>}
                  </div>
                  <label style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
                    цена
                    <input type="number" value={pr.price ?? ""} min="0"
                      onChange={(e) => setP(c.id, "price", e.target.value)}
                      style={{ ...input, display: "block", width: 96, marginTop: 3 }}/>
                  </label>
                  <label style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
                    старая (зачёрк.)
                    <input type="number" value={pr.original ?? ""} min="0" placeholder="—"
                      onChange={(e) => setP(c.id, "original", e.target.value)}
                      style={{ ...input, display: "block", width: 96, marginTop: 3 }}/>
                  </label>
                  <button onClick={() => savePrice(c.id)} disabled={savingSlug === c.id}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 13px",
                      borderRadius: 9, border: "none", cursor: "pointer",
                      background: "linear-gradient(135deg,#e11d48,#f59e0b)", color: "#fff",
                      fontSize: 12.5, fontWeight: 700 }}>
                    {savingSlug === c.id
                      ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }}/>
                      : <Save size={14}/>} Сохранить
                  </button>
                  <button onClick={() => togglePublish(c.id, c.is_published)} title={c.is_published ? "Скрыть с витрины" : "Показать на витрине"}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 12px",
                      borderRadius: 9, cursor: "pointer", fontSize: 12.5, fontWeight: 600,
                      border: "0.5px solid var(--color-border-secondary)",
                      background: "var(--color-background-primary)", color: "var(--color-text-secondary)" }}>
                    {c.is_published ? <><EyeOff size={14}/> Скрыть</> : <><Eye size={14}/> Показать</>}
                  </button>
                </div>
              );
            })}
            <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 10 }}>
              Новая цена действует сразу и на витрине, и при оплате. «Старая» — перечёркнутая цена со
              скидкой (пусто — без неё). Цена 0 ₽ = курс бесплатный для всех; «Скрыть» убирает курс
              с витрины, не удаляя.
            </div>
          </div>

          {/* ── Выдать доступ ── */}
          <div style={{ ...card(), padding: 16, marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4,
              display: "flex", alignItems: "center", gap: 7 }}>
              <Gift size={16} style={{ color: "#e11d48" }}/> Выдать доступ
            </div>
            <div style={{ fontSize: 11.5, color: "var(--color-text-secondary)", marginBottom: 10 }}>
              По email уже зарегистрированного ученика. Удобно для бесплатного доступа за отзыв.
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email"
                placeholder="email ученика" style={{ ...input, flex: 1, minWidth: 180 }}/>
              <select value={grantSlug} onChange={(e) => setGrantSlug(e.target.value)} style={input}>
                {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
              <button onClick={grant} style={{ padding: "10px 16px", borderRadius: 9, border: "none",
                cursor: "pointer", background: "#10b981", color: "#fff", fontSize: 13, fontWeight: 700 }}>
                Выдать
              </button>
            </div>
          </div>

          {/* ── Кто имеет доступ ── */}
          <div style={{ ...card(), padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Доступы — {access.length}</div>
            {access.length === 0 && (
              <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>Пока никто.</div>
            )}
            {access.map((a, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10,
                padding: "7px 0", borderTop: "0.5px solid var(--color-border-tertiary)", fontSize: 12.5 }}>
                <span style={{ flex: 1, minWidth: 0, wordBreak: "break-all" }}>{a.email}</span>
                <span style={{ color: "var(--color-text-secondary)" }}>{titleOf(a.course_slug)}</span>
                <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 7px", borderRadius: 6,
                  background: a.source === "manual" ? "#6366f120" : a.source === "free" ? "#f59e0b20" : "#10b98120",
                  color: a.source === "manual" ? "#6366f1" : a.source === "free" ? "#f59e0b" : "#10b981" }}>
                  {a.source === "manual" ? "выдан" : a.source === "free" ? "бесплатно" : "куплен"}
                </span>
                <button onClick={() => revoke(a.email, a.course_slug, a.source)} title="Забрать доступ"
                  style={{ background: "none", border: "none", cursor: "pointer",
                    color: "#ef4444", display: "flex", padding: 3 }}>
                  <Trash2 size={15}/>
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
