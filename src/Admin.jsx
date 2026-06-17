// ═══════════════════════════════════════════════════════════════════
//  Admin.jsx — панель владельца (видна только isAdmin).
//   • Сводка  • Курсы (цена/описание/скрыть/бесплатные уроки)
//   • Промокоды  • Объявление  • Выдать/забрать доступ  • Заказы  • Экспорт email
//  Всё через admin-RPC с проверкой is_admin().
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import {
  ArrowLeft, Loader2, Save, Gift, Trash2, Eye, EyeOff,
  Tag, Megaphone, Download, ChevronDown, ChevronRight,
} from "lucide-react";
import { supabase } from "./supabase";

const card = (e = {}) => ({
  background: "var(--color-background-primary)",
  borderRadius: "var(--border-radius-lg)",
  border: "0.5px solid var(--color-border-tertiary)",
  boxShadow: "var(--shadow-sm)", ...e,
});
const input = {
  padding: "9px 11px", fontSize: 13, borderRadius: 9,
  border: "0.5px solid var(--color-border-secondary)",
  background: "var(--color-background-primary)", color: "var(--color-text-primary)",
};
const rub = (n) => `${Math.round(Number(n || 0)).toLocaleString()} ₽`;
const dt = (s) => (s ? new Date(s).toLocaleDateString("ru-RU") : "—");
const H = ({ icon, children }) => (
  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, display: "flex", alignItems: "center", gap: 7 }}>
    {icon}{children}
  </div>
);

export default function Admin({ isAdmin = false, onBack }) {
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState([]);
  const [prices, setPrices] = useState({});   // slug -> {price, original}
  const [meta, setMeta] = useState({});       // slug -> {title, desc}
  const [access, setAccess] = useState([]);
  const [summary, setSummary] = useState(null);
  const [orders, setOrders] = useState([]);
  const [promos, setPromos] = useState([]);
  const [announce, setAnnounce] = useState("");
  const [email, setEmail] = useState("");
  const [grantSlug, setGrantSlug] = useState("");
  const [savingSlug, setSavingSlug] = useState("");
  const [openLessons, setOpenLessons] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [promoForm, setPromoForm] = useState({ code: "", percent: 50, max: "", expires: "" });
  const [msg, setMsg] = useState("");

  const flash = (t) => { setMsg(t); setTimeout(() => setMsg(""), 3500); };

  const load = async () => {
    setLoading(true);
    const { data: cat } = await supabase.rpc("admin_list_courses");
    const list = (cat || []).map((c) => ({
      id: c.slug, title: c.title, short_desc: c.short_desc,
      price: c.price, original_price: c.original_price, is_published: c.is_published,
    }));
    setCourses(list);
    const pr = {}, mt = {};
    list.forEach((c) => {
      pr[c.id] = { price: c.price ?? "", original: c.original_price ?? "" };
      mt[c.id] = { title: c.title ?? "", desc: c.short_desc ?? "" };
    });
    setPrices(pr); setMeta(mt);
    setGrantSlug((s) => s || (list[0]?.id ?? ""));
    const [{ data: acc }, { data: sum }, { data: ord }, { data: pm }, { data: ann }] = await Promise.all([
      supabase.rpc("admin_list_access"),
      supabase.rpc("admin_summary"),
      supabase.rpc("admin_list_orders"),
      supabase.rpc("admin_list_promos"),
      supabase.from("app_settings").select("value").eq("key", "announcement").maybeSingle(),
    ]);
    setAccess(acc || []); setSummary(sum || null); setOrders(ord || []); setPromos(pm || []);
    setAnnounce(ann?.value ? String(ann.value) : "");
    setLoading(false);
  };
  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  const setP = (slug, f, v) => setPrices((p) => ({ ...p, [slug]: { ...p[slug], [f]: v } }));
  const setM = (slug, f, v) => setMeta((m) => ({ ...m, [slug]: { ...m[slug], [f]: v } }));

  const saveCourse = async (slug) => {
    setSavingSlug(slug);
    const pr = prices[slug] || {}, mt = meta[slug] || {};
    await supabase.rpc("admin_set_price", {
      p_slug: slug, p_price: Number(pr.price) || 0,
      p_original: pr.original === "" || pr.original == null ? null : Number(pr.original),
    });
    await supabase.rpc("admin_set_course_meta", { p_slug: slug, p_title: mt.title || "", p_desc: mt.desc || "" });
    setSavingSlug(""); flash("Курс сохранён ✓"); load();
  };
  const togglePublish = async (slug, cur) => {
    await supabase.rpc("admin_set_published", { p_slug: slug, p_published: !cur });
    flash(cur ? "Курс скрыт" : "Курс на витрине"); load();
  };

  const openCourseLessons = async (slug) => {
    if (openLessons === slug) { setOpenLessons(null); return; }
    setOpenLessons(slug); setLessons([]);
    const { data } = await supabase.rpc("admin_list_lessons", { p_slug: slug });
    setLessons(data || []);
  };
  const toggleFree = async (id, cur) => {
    await supabase.rpc("admin_set_lesson_free", { p_id: id, p_free: !cur });
    setLessons((ls) => ls.map((l) => (l.id === id ? { ...l, is_free: !cur } : l)));
  };

  const createPromo = async () => {
    if (!promoForm.code.trim()) return flash("Введите код");
    const { error } = await supabase.rpc("admin_create_promo", {
      p_code: promoForm.code, p_percent: Number(promoForm.percent) || 1,
      p_max: promoForm.max === "" ? null : Number(promoForm.max),
      p_expires: promoForm.expires ? new Date(promoForm.expires).toISOString() : null,
    });
    if (error) return flash("Ошибка: " + error.message);
    flash("Промокод создан ✓"); setPromoForm({ code: "", percent: 50, max: "", expires: "" }); load();
  };
  const togglePromo = async (id, active) => {
    await supabase.rpc("admin_set_promo_active", { p_id: id, p_active: !active }); load();
  };

  const saveAnnounce = async () => {
    await supabase.rpc("admin_set_announcement", { p_text: announce });
    flash("Объявление сохранено (пусто = убрать баннер)");
  };

  const grant = async () => {
    if (!email.trim() || !grantSlug) return;
    const { data, error } = await supabase.rpc("admin_grant_access", { p_email: email.trim(), p_slug: grantSlug });
    if (error) return flash("Ошибка: " + error.message);
    flash(data === "granted" ? "Доступ выдан ✓" : data === "already" ? "Доступ уже есть"
      : data === "no_user" ? "Нет пользователя с такой почтой — пусть зарегистрируется" : "Готово");
    if (data === "granted") { setEmail(""); load(); }
  };
  const revoke = async (em, slug, source) => {
    if (source !== "manual" && !window.confirm(`Убрать доступ у ${em}? Деньги автоматически НЕ вернутся — пропадёт только доступ.`)) return;
    await supabase.rpc("admin_revoke_access", { p_email: em, p_slug: slug });
    flash("Доступ снят"); load();
  };

  const exportEmails = async () => {
    const { data } = await supabase.rpc("admin_student_emails");
    const emails = (data || []).map((r) => r.email).join("\n");
    const blob = new Blob([emails], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "kirenix_emails.txt"; a.click();
    URL.revokeObjectURL(a.href);
    flash(`Выгружено email: ${(data || []).length}`);
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
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, background: "none",
        border: "none", cursor: "pointer", fontSize: 13, color: "var(--color-text-secondary)", padding: "0 0 14px 0" }}>
        <ArrowLeft size={14}/> В кабинет
      </button>
      <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>Управление</div>
      {msg && <div style={{ ...card(), padding: "10px 14px", marginBottom: 14, fontSize: 13, borderLeft: "3px solid #6366f1" }}>{msg}</div>}

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 40, color: "var(--color-text-secondary)", gap: 8, fontSize: 13 }}>
          <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }}/> Загружаем…
        </div>
      ) : (
        <>
          {/* Сводка */}
          {summary && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
              {stat("Учеников", summary.students ?? 0)}
              {stat("Продаж", summary.sales ?? 0)}
              {stat("Выручка", rub(summary.revenue), "#10b981")}
              {stat("Отзывов на модерации", summary.pending_reviews ?? 0, summary.pending_reviews > 0 ? "#f59e0b" : undefined)}
              {stat("Рефералам к выплате", rub(summary.referral_due), summary.referral_due > 0 ? "#e11d48" : undefined)}
            </div>
          )}

          {/* Курсы */}
          <div style={{ ...card(), padding: 16, marginBottom: 14 }}>
            <H>Курсы</H>
            {courses.map((c) => {
              const pr = prices[c.id] || {}, mt = meta[c.id] || {};
              return (
                <div key={c.id} style={{ padding: "12px 0", borderTop: "0.5px solid var(--color-border-tertiary)" }}>
                  <input value={mt.title ?? ""} onChange={(e) => setM(c.id, "title", e.target.value)}
                    placeholder="Название" style={{ ...input, width: "100%", boxSizing: "border-box", fontWeight: 600 }}/>
                  <textarea value={mt.desc ?? ""} onChange={(e) => setM(c.id, "desc", e.target.value)}
                    placeholder="Короткое описание для витрины" rows={2}
                    style={{ ...input, width: "100%", boxSizing: "border-box", marginTop: 8, resize: "vertical" }}/>
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap", marginTop: 8 }}>
                    <label style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>цена
                      <input type="number" min="0" value={pr.price ?? ""} onChange={(e) => setP(c.id, "price", e.target.value)}
                        style={{ ...input, display: "block", width: 96, marginTop: 3 }}/></label>
                    <label style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>старая
                      <input type="number" min="0" value={pr.original ?? ""} placeholder="—" onChange={(e) => setP(c.id, "original", e.target.value)}
                        style={{ ...input, display: "block", width: 96, marginTop: 3 }}/></label>
                    <button onClick={() => saveCourse(c.id)} disabled={savingSlug === c.id}
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 13px", borderRadius: 9, border: "none",
                        cursor: "pointer", background: "linear-gradient(135deg,#e11d48,#f59e0b)", color: "#fff", fontSize: 12.5, fontWeight: 700 }}>
                      {savingSlug === c.id ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }}/> : <Save size={14}/>} Сохранить
                    </button>
                    <button onClick={() => togglePublish(c.id, c.is_published)}
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 12px", borderRadius: 9, cursor: "pointer",
                        fontSize: 12.5, fontWeight: 600, border: "0.5px solid var(--color-border-secondary)",
                        background: "var(--color-background-primary)", color: c.is_published ? "var(--color-text-secondary)" : "#ef4444" }}>
                      {c.is_published ? <><EyeOff size={14}/> Скрыть</> : <><Eye size={14}/> Показать</>}
                    </button>
                    <button onClick={() => openCourseLessons(c.id)}
                      style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "9px 10px", borderRadius: 9, cursor: "pointer",
                        fontSize: 12.5, fontWeight: 600, border: "0.5px solid var(--color-border-secondary)",
                        background: "var(--color-background-primary)", color: "var(--color-text-secondary)" }}>
                      {openLessons === c.id ? <ChevronDown size={14}/> : <ChevronRight size={14}/>} Бесплатные уроки
                    </button>
                  </div>
                  {!c.is_published && <div style={{ fontSize: 10.5, color: "#ef4444", marginTop: 4 }}>скрыт с витрины</div>}

                  {openLessons === c.id && (
                    <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 10, background: "var(--color-background-secondary)" }}>
                      <div style={{ fontSize: 11.5, color: "var(--color-text-secondary)", marginBottom: 8 }}>
                        Отметь уроки, которые открыты бесплатно (без покупки):
                      </div>
                      {lessons.length === 0
                        ? <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Загружаем…</div>
                        : lessons.map((l) => (
                          <label key={l.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, padding: "3px 0", cursor: "pointer" }}>
                            <input type="checkbox" checked={!!l.is_free} onChange={() => toggleFree(l.id, l.is_free)}/>
                            <span style={{ color: "var(--color-text-secondary)" }}>{l.num || "—"}</span>
                            <span>{l.title}</span>
                          </label>
                        ))}
                    </div>
                  )}
                </div>
              );
            })}
            <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 10 }}>
              Цена 0 ₽ = бесплатно для всех. «Скрыть» убирает курс с витрины, не удаляя.
            </div>
          </div>

          {/* Промокоды */}
          <div style={{ ...card(), padding: 16, marginBottom: 14 }}>
            <H icon={<Tag size={16} style={{ color: "#6366f1" }}/>}>Промокоды</H>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>код
                <input value={promoForm.code} onChange={(e) => setPromoForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                  placeholder="LETO50" style={{ ...input, display: "block", width: 120, marginTop: 3, textTransform: "uppercase" }}/></label>
              <label style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>скидка %
                <input type="number" min="1" max="100" value={promoForm.percent} onChange={(e) => setPromoForm((f) => ({ ...f, percent: e.target.value }))}
                  style={{ ...input, display: "block", width: 80, marginTop: 3 }}/></label>
              <label style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>лимит (шт)
                <input type="number" min="1" value={promoForm.max} placeholder="∞" onChange={(e) => setPromoForm((f) => ({ ...f, max: e.target.value }))}
                  style={{ ...input, display: "block", width: 80, marginTop: 3 }}/></label>
              <label style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>до даты
                <input type="date" value={promoForm.expires} onChange={(e) => setPromoForm((f) => ({ ...f, expires: e.target.value }))}
                  style={{ ...input, display: "block", marginTop: 3 }}/></label>
              <button onClick={createPromo} style={{ padding: "10px 16px", borderRadius: 9, border: "none", cursor: "pointer",
                background: "#6366f1", color: "#fff", fontSize: 13, fontWeight: 700 }}>Создать</button>
            </div>
            {promos.map((p) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0",
                borderTop: "0.5px solid var(--color-border-tertiary)", fontSize: 12.5, flexWrap: "wrap" }}>
                <strong style={{ fontFamily: "monospace" }}>{p.code}</strong>
                <span style={{ color: "#6366f1", fontWeight: 700 }}>−{p.percent}%</span>
                <span style={{ color: "var(--color-text-secondary)" }}>
                  использован {p.used}{p.max_uses ? `/${p.max_uses}` : ""}{p.expires_at ? ` · до ${dt(p.expires_at)}` : ""}
                </span>
                <button onClick={() => togglePromo(p.id, p.active)} style={{ marginLeft: "auto", padding: "5px 10px", borderRadius: 7,
                  cursor: "pointer", fontSize: 11.5, fontWeight: 600, border: "0.5px solid var(--color-border-secondary)",
                  background: "var(--color-background-primary)", color: p.active ? "#10b981" : "#ef4444" }}>
                  {p.active ? "активен" : "выключен"}
                </button>
              </div>
            ))}
            {promos.length === 0 && <div style={{ fontSize: 12.5, color: "var(--color-text-secondary)" }}>Промокодов пока нет.</div>}
          </div>

          {/* Объявление */}
          <div style={{ ...card(), padding: 16, marginBottom: 14 }}>
            <H icon={<Megaphone size={16} style={{ color: "#f59e0b" }}/>}>Объявление для учеников</H>
            <textarea value={announce} onChange={(e) => setAnnounce(e.target.value)} rows={2}
              placeholder="Например: Скидка 50% до конца недели по коду LETO50. Пусто — баннер не показывается."
              style={{ ...input, width: "100%", boxSizing: "border-box", resize: "vertical" }}/>
            <button onClick={saveAnnounce} style={{ marginTop: 8, padding: "9px 16px", borderRadius: 9, border: "none",
              cursor: "pointer", background: "#f59e0b", color: "#fff", fontSize: 13, fontWeight: 700 }}>Сохранить объявление</button>
          </div>

          {/* Выдать доступ */}
          <div style={{ ...card(), padding: 16, marginBottom: 14 }}>
            <H icon={<Gift size={16} style={{ color: "#e11d48" }}/>}>Выдать доступ</H>
            <div style={{ fontSize: 11.5, color: "var(--color-text-secondary)", marginBottom: 10 }}>
              По email уже зарегистрированного ученика (для бесплатного доступа за отзыв).
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="email ученика"
                style={{ ...input, flex: 1, minWidth: 180 }}/>
              <select value={grantSlug} onChange={(e) => setGrantSlug(e.target.value)} style={input}>
                {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
              <button onClick={grant} style={{ padding: "10px 16px", borderRadius: 9, border: "none", cursor: "pointer",
                background: "#10b981", color: "#fff", fontSize: 13, fontWeight: 700 }}>Выдать</button>
            </div>
          </div>

          {/* Доступы */}
          <div style={{ ...card(), padding: 16, marginBottom: 14 }}>
            <H>Доступы — {access.length}</H>
            {access.length === 0 && <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>Пока никто.</div>}
            {access.map((a, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0",
                borderTop: "0.5px solid var(--color-border-tertiary)", fontSize: 12.5 }}>
                <span style={{ flex: 1, minWidth: 0, wordBreak: "break-all" }}>{a.email}</span>
                <span style={{ color: "var(--color-text-secondary)" }}>{titleOf(a.course_slug)}</span>
                <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 7px", borderRadius: 6,
                  background: a.source === "manual" ? "#6366f120" : a.source === "free" ? "#f59e0b20" : "#10b98120",
                  color: a.source === "manual" ? "#6366f1" : a.source === "free" ? "#f59e0b" : "#10b981" }}>
                  {a.source === "manual" ? "выдан" : a.source === "free" ? "бесплатно" : "куплен"}
                </span>
                <button onClick={() => revoke(a.email, a.course_slug, a.source)} title="Забрать доступ"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", display: "flex", padding: 3 }}>
                  <Trash2 size={15}/>
                </button>
              </div>
            ))}
          </div>

          {/* Заказы */}
          <div style={{ ...card(), padding: 16, marginBottom: 14 }}>
            <H>Заказы / платежи</H>
            {orders.length === 0 && <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>Пока нет.</div>}
            {orders.map((o, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0",
                borderTop: "0.5px solid var(--color-border-tertiary)", fontSize: 12.5, flexWrap: "wrap" }}>
                <span style={{ flex: 1, minWidth: 120, wordBreak: "break-all" }}>{o.email}</span>
                <span style={{ color: "var(--color-text-secondary)" }}>{titleOf(o.course_slug)}</span>
                <strong>{rub(o.amount)}</strong>
                <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 7px", borderRadius: 6,
                  background: o.status === "succeeded" ? "#10b98120" : o.status === "refunded" ? "#ef444420" : "#9ca3af20",
                  color: o.status === "succeeded" ? "#10b981" : o.status === "refunded" ? "#ef4444" : "var(--color-text-secondary)" }}>
                  {o.status === "succeeded" ? "оплачен" : o.status === "refunded" ? "возврат" : o.status === "pending" ? "ожидает" : o.status}
                </span>
                <span style={{ color: "var(--color-text-secondary)", fontSize: 11 }}>{dt(o.created_at)}</span>
              </div>
            ))}
          </div>

          {/* Экспорт email */}
          <div style={{ ...card(), padding: 16 }}>
            <H icon={<Download size={16} style={{ color: "#10b981" }}/>}>Экспорт email учеников</H>
            <div style={{ fontSize: 11.5, color: "var(--color-text-secondary)", marginBottom: 10 }}>
              Скачать список всех email одним файлом (для рассылок и новостей).
            </div>
            <button onClick={exportEmails} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 16px",
              borderRadius: 9, border: "none", cursor: "pointer", background: "#10b981", color: "#fff", fontSize: 13, fontWeight: 700 }}>
              <Download size={15}/> Скачать email
            </button>
          </div>
        </>
      )}
    </div>
  );
}
