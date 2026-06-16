// ═══════════════════════════════════════════════════════════════════
//  Referral.jsx — реферальная программа.
//  Ученик: своя ссылка + статистика начислений (10% с ПЕРВОЙ покупки друга).
//  Автор (admin): список начислений с email партнёров + кнопка «Выплачено».
//  Сами выплаты автор делает вручную (перевод вне платформы).
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Copy, Check, Gift, Users, Wallet } from "lucide-react";
import { supabase } from "./supabase";

const card = (extra = {}) => ({
  background: "var(--color-background-primary)",
  borderRadius: "var(--border-radius-lg)",
  border: "0.5px solid var(--color-border-tertiary)",
  boxShadow: "var(--shadow-sm)",
  ...extra,
});

const rub = (n) => `${Math.round(Number(n || 0))} ₽`;

export default function Referral({ isAdmin = false, onBack }) {
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  const [rows, setRows] = useState([]);
  const [copied, setCopied] = useState(false);

  const load = async () => {
    setLoading(true);
    if (isAdmin) {
      const { data } = await supabase.rpc("referral_admin_list");
      setRows(data || []);
    } else {
      const { data: c } = await supabase.rpc("my_ref_code");
      setCode(c || "");
      const { data } = await supabase.from("referral_commissions").select("*")
        .order("created_at", { ascending: false });
      setRows(data || []);
    }
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const link = code ? `${window.location.origin}/?ref=${code}` : "";
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch { /* ignore */ }
  };
  const markPaid = async (id) => {
    await supabase.rpc("referral_mark_paid", { p_id: id });
    load();
  };

  const pending = rows.filter((r) => r.status === "pending").reduce((s, r) => s + Number(r.amount || 0), 0);
  const paid = rows.filter((r) => r.status === "paid").reduce((s, r) => s + Number(r.amount || 0), 0);

  const Back = (
    <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6,
      background: "none", border: "none", cursor: "pointer", fontSize: 13,
      color: "var(--color-text-secondary)", padding: "0 0 14px 0" }}>
      <ArrowLeft size={14}/> В кабинет
    </button>
  );

  if (loading) return (
    <div>{Back}
      <div style={{ display: "flex", justifyContent: "center", padding: 40,
        color: "var(--color-text-secondary)", gap: 8, fontSize: 13 }}>
        <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }}/> Загружаем…
      </div>
    </div>
  );

  // ───────── Автор: выплаты ─────────
  if (isAdmin) {
    return (
      <div>{Back}
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>Реферальные выплаты</div>
        <div style={{ fontSize: 12.5, color: "var(--color-text-secondary)", marginBottom: 14 }}>
          К выплате сейчас: <strong style={{ color: "#e11d48" }}>{rub(pending)}</strong>. Переводишь
          партнёру вручную и жмёшь «Выплачено».
        </div>
        {rows.length === 0 && (
          <div style={{ ...card(), padding: 16, fontSize: 13, color: "var(--color-text-secondary)" }}>
            Пока начислений нет.
          </div>
        )}
        {rows.map((r) => (
          <div key={r.id} style={{ ...card(), padding: 14, marginBottom: 10,
            display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{rub(r.amount)}
                <span style={{ fontSize: 11, fontWeight: 600, marginLeft: 8,
                  color: r.status === "paid" ? "#10b981" : "#f59e0b" }}>
                  {r.status === "paid" ? "выплачено" : "к выплате"}
                </span>
              </div>
              <div style={{ fontSize: 11.5, color: "var(--color-text-secondary)", marginTop: 3 }}>
                кому: <strong>{r.referrer_email || "—"}</strong> · привёл: {r.referred_email || "—"}
              </div>
            </div>
            {r.status === "pending" && (
              <button onClick={() => markPaid(r.id)} style={{
                padding: "8px 14px", borderRadius: 8, border: "none", cursor: "pointer",
                background: "#10b981", color: "#fff", fontSize: 12.5, fontWeight: 600 }}>
                Выплачено
              </button>
            )}
          </div>
        ))}
      </div>
    );
  }

  // ───────── Ученик: своя ссылка ─────────
  const friends = rows.length;
  return (
    <div>{Back}
      <div style={{ ...card({ background: "linear-gradient(135deg,#e11d4814,#f59e0b10)",
        borderLeft: "4px solid #e11d48" }), padding: 20, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <Gift size={22} style={{ color: "#e11d48" }}/>
          <div style={{ fontSize: 17, fontWeight: 800 }}>Приведи друга — получи 10%</div>
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.6, color: "var(--color-text-secondary)" }}>
          Делись ссылкой. Когда друг впервые оплатит курс, тебе начислится <strong>10% от его
          оплаты</strong>. Накопленное автор переводит вручную — напишет тебе в чате.
        </div>
      </div>

      <div style={{ ...card(), padding: 16, marginBottom: 14 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 8 }}>Твоя ссылка</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input readOnly value={link} onFocus={(e) => e.target.select()} style={{
            flex: 1, minWidth: 200, padding: "10px 12px", fontSize: 13, borderRadius: 10,
            border: "0.5px solid var(--color-border-secondary)",
            background: "var(--color-background-secondary)", color: "var(--color-text-primary)" }}/>
          <button onClick={copy} style={{ display: "inline-flex", alignItems: "center", gap: 7,
            padding: "10px 16px", borderRadius: 10, border: "none", cursor: "pointer",
            background: copied ? "#10b981" : "linear-gradient(135deg,#e11d48,#f59e0b)",
            color: "#fff", fontSize: 13, fontWeight: 700 }}>
            {copied ? <Check size={15}/> : <Copy size={15}/>} {copied ? "Скопировано" : "Копировать"}
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div style={{ ...card(), padding: 16, flex: 1, minWidth: 150 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, color: "var(--color-text-secondary)",
            fontSize: 12, marginBottom: 6 }}><Users size={14}/> Оплатили по ссылке</div>
          <div style={{ fontSize: 24, fontWeight: 800 }}>{friends}</div>
        </div>
        <div style={{ ...card(), padding: 16, flex: 1, minWidth: 150 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, color: "var(--color-text-secondary)",
            fontSize: 12, marginBottom: 6 }}><Wallet size={14}/> К выплате</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#e11d48" }}>{rub(pending)}</div>
          {paid > 0 && <div style={{ fontSize: 11.5, color: "var(--color-text-secondary)", marginTop: 2 }}>
            уже выплачено: {rub(paid)}</div>}
        </div>
      </div>
    </div>
  );
}
