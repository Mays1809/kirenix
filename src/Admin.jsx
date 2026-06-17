// ═══════════════════════════════════════════════════════════════════
//  Admin.jsx — панель владельца: менять цены курсов и выдавать/забирать
//  доступ по email (для первых учеников / бесплатного доступа за отзыв).
//  Видна только владельцу (isAdmin). Все действия — через admin-RPC.
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Save, Gift, Trash2 } from "lucide-react";
import { supabase } from "./supabase";
import { fetchCatalog } from "./courses/courseApi";

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

export default function Admin({ isAdmin = false, onBack }) {
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState([]);
  const [prices, setPrices] = useState({});      // slug -> { price, original }
  const [access, setAccess] = useState([]);
  const [email, setEmail] = useState("");
  const [grantSlug, setGrantSlug] = useState("");
  const [savingSlug, setSavingSlug] = useState("");
  const [msg, setMsg] = useState("");

  const flash = (t) => { setMsg(t); setTimeout(() => setMsg(""), 3500); };

  const load = async () => {
    setLoading(true);
    try {
      const cat = await fetchCatalog();
      setCourses(cat);
      const p = {};
      cat.forEach((c) => { p[c.id] = { price: c.price ?? "", original: c.original_price ?? "" }; });
      setPrices(p);
      setGrantSlug((s) => s || (cat[0]?.id ?? ""));
    } catch { /* ignore */ }
    const { data } = await supabase.rpc("admin_list_access");
    setAccess(data || []);
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

  const revoke = async (em, slug) => {
    await supabase.rpc("admin_revoke_access", { p_email: em, p_slug: slug });
    load();
  };

  const titleOf = (slug) => courses.find((c) => c.id === slug)?.title || slug;

  if (!isAdmin) return null;

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
          {/* ── Цены ── */}
          <div style={{ ...card(), padding: 16, marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Цены курсов</div>
            {courses.map((c) => {
              const pr = prices[c.id] || {};
              return (
                <div key={c.id} style={{ display: "flex", gap: 10, alignItems: "center",
                  flexWrap: "wrap", padding: "8px 0", borderTop: "0.5px solid var(--color-border-tertiary)" }}>
                  <div style={{ flex: 1, minWidth: 140, fontSize: 13, fontWeight: 600 }}>{c.title}</div>
                  <label style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
                    цена
                    <input type="number" value={pr.price ?? ""} min="0"
                      onChange={(e) => setP(c.id, "price", e.target.value)}
                      style={{ ...input, display: "block", width: 100, marginTop: 3 }}/>
                  </label>
                  <label style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
                    старая (зачёрк.)
                    <input type="number" value={pr.original ?? ""} min="0" placeholder="—"
                      onChange={(e) => setP(c.id, "original", e.target.value)}
                      style={{ ...input, display: "block", width: 100, marginTop: 3 }}/>
                  </label>
                  <button onClick={() => savePrice(c.id)} disabled={savingSlug === c.id}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 14px",
                      borderRadius: 9, border: "none", cursor: "pointer",
                      background: "linear-gradient(135deg,#e11d48,#f59e0b)", color: "#fff",
                      fontSize: 12.5, fontWeight: 700, alignSelf: "flex-end" }}>
                    {savingSlug === c.id
                      ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }}/>
                      : <Save size={14}/>} Сохранить
                  </button>
                </div>
              );
            })}
            <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 10 }}>
              Новая цена сразу действует и на витрине, и при оплате. «Старая» — это перечёркнутая
              цена рядом со скидкой (оставь пустой, если не нужна).
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
                placeholder="email ученика"
                style={{ ...input, flex: 1, minWidth: 180 }}/>
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
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>
              Доступы — {access.length}
            </div>
            {access.length === 0 && (
              <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>Пока никто.</div>
            )}
            {access.map((a, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10,
                padding: "7px 0", borderTop: "0.5px solid var(--color-border-tertiary)", fontSize: 12.5 }}>
                <span style={{ flex: 1, minWidth: 0, wordBreak: "break-all" }}>{a.email}</span>
                <span style={{ color: "var(--color-text-secondary)" }}>{titleOf(a.course_slug)}</span>
                <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 7px", borderRadius: 6,
                  background: a.source === "manual" ? "#6366f120" : "#10b98120",
                  color: a.source === "manual" ? "#6366f1" : "#10b981" }}>
                  {a.source === "manual" ? "выдан" : "куплен"}
                </span>
                {a.source === "manual" && (
                  <button onClick={() => revoke(a.email, a.course_slug)} title="Забрать доступ"
                    style={{ background: "none", border: "none", cursor: "pointer",
                      color: "#ef4444", display: "flex", padding: 3 }}>
                    <Trash2 size={15}/>
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
