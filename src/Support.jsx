// ═══════════════════════════════════════════════════════════════════
//  Support.jsx — вкладка поддержки: FAQ + контакты.
//  Чат с автором — через существующие «Сообщения» (onMessages).
// ═══════════════════════════════════════════════════════════════════

import { useState } from "react";
import { ArrowLeft, ChevronDown, ChevronRight, MessageCircle, Mail, FileText, LifeBuoy } from "lucide-react";

const SUPPORT_EMAIL = "kirenix_help@mail.ru";

const card = (extra = {}) => ({
  background: "var(--color-background-primary)",
  borderRadius: "var(--border-radius-lg)",
  border: "0.5px solid var(--color-border-tertiary)",
  boxShadow: "var(--shadow-sm)",
  ...extra,
});

const FAQ = [
  {
    q: "Оплатил, но курс не открылся",
    a: "Доступ выдаётся автоматически в течение минуты после оплаты. Обнови страницу (Cmd/Ctrl+Shift+R). " +
       "Если за 5 минут доступа нет — напиши на почту поддержки и приложи чек или e-mail, с которого платил: вручную откроем доступ.",
  },
  {
    q: "Как проверить своё сочинение по критериям?",
    a: "Открой любой урок модуля «Сочинение», нажми «Проверить сочинение по К1–К10», вставь свой текст (и, по возможности, " +
       "исходный текст из варианта). Получишь разбор по каждому критерию и прогноз баллов. Можно отправить работу автору на личную проверку.",
  },
  {
    q: "Чёрный экран или урок не открывается",
    a: "Чаще всего помогает обновление с очисткой кэша: Cmd/Ctrl+Shift+R, или открой сайт в приватном окне. " +
       "Если не помогло — напиши в поддержку, какой браузер и что именно нажимал.",
  },
  {
    q: "Что входит в курс и навсегда ли доступ",
    a: "Все уроки курса с теорией, разобранными примерами, практикой с ответами и шпаргалками. Доступ — бессрочный, " +
       "учиться можно в своём темпе. Урок 1.1 открыт бесплатно — посмотри формат до покупки.",
  },
  {
    q: "Возврат и условия",
    a: "Условия покупки и возврата описаны в оферте (ссылка ниже). По спорным вопросам пиши на почту поддержки — разберёмся.",
  },
];

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
      <button onClick={() => setOpen((o) => !o)} style={{
        width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "13px 16px",
        background: "none", border: "none", cursor: "pointer", textAlign: "left",
        color: "var(--color-text-primary)", fontFamily: "inherit",
      }}>
        <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600 }}>{q}</span>
        {open ? <ChevronDown size={16} style={{ color: "var(--color-text-secondary)" }}/>
              : <ChevronRight size={16} style={{ color: "var(--color-text-secondary)" }}/>}
      </button>
      {open && (
        <div style={{ padding: "0 16px 14px", fontSize: 13, lineHeight: 1.7, color: "var(--color-text-secondary)" }}>
          {a}
        </div>
      )}
    </div>
  );
}

export default function Support({ accent = "#e11d48", onMessages, onBack }) {
  const linkBtn = (extra = {}) => ({
    display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: "var(--border-radius-md)",
    border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-primary)",
    cursor: "pointer", textAlign: "left", color: "var(--color-text-primary)", fontFamily: "inherit",
    textDecoration: "none", ...extra,
  });

  return (
    <div>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, background: "none",
        border: "none", cursor: "pointer", fontSize: 13, color: "var(--color-text-secondary)", padding: "0 0 14px 0" }}>
        <ArrowLeft size={14}/> Назад
      </button>

      <div style={{ ...card(), padding: "18px 20px", marginBottom: 14,
        background: `linear-gradient(135deg, ${accent}18, transparent)`, borderLeft: `4px solid ${accent}` }}>
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
          <LifeBuoy size={20} style={{ color: accent }}/> Поддержка
        </div>
        <div style={{ fontSize: 12.5, color: "var(--color-text-secondary)" }}>
          Ответы на частые вопросы и связь с автором. Обычно отвечаем в течение дня.
        </div>
      </div>

      {/* Быстрая связь */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
        <button onClick={onMessages} style={linkBtn()}>
          <span style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, background: `${accent}15`,
            display: "flex", alignItems: "center", justifyContent: "center" }}>
            <MessageCircle size={16} style={{ color: accent }}/>
          </span>
          <span>
            <span style={{ display: "block", fontSize: 13, fontWeight: 600 }}>Написать автору</span>
            <span style={{ display: "block", fontSize: 11, color: "var(--color-text-secondary)" }}>чат прямо в кабинете</span>
          </span>
        </button>
        <a href={`mailto:${SUPPORT_EMAIL}`} style={linkBtn()}>
          <span style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, background: `${accent}15`,
            display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Mail size={16} style={{ color: accent }}/>
          </span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 13, fontWeight: 600 }}>Почта поддержки</span>
            <span style={{ display: "block", fontSize: 11, color: "var(--color-text-secondary)",
              overflow: "hidden", textOverflow: "ellipsis" }}>{SUPPORT_EMAIL}</span>
          </span>
        </a>
      </div>

      {/* FAQ */}
      <div style={{ ...card(), overflow: "hidden", marginBottom: 14 }}>
        <div style={{ padding: "12px 16px", borderBottom: "0.5px solid var(--color-border-tertiary)",
          fontSize: 13, fontWeight: 700 }}>
          Частые вопросы
        </div>
        {FAQ.map((f, i) => <FaqItem key={i} q={f.q} a={f.a}/>)}
      </div>

      {/* Документы */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <a href="/oferta" style={{ ...linkBtn({ flex: 1, minWidth: 160 }) }}>
          <FileText size={15} style={{ color: "var(--color-text-secondary)" }}/>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Публичная оферта</span>
        </a>
        <a href="/contacts" style={{ ...linkBtn({ flex: 1, minWidth: 160 }) }}>
          <FileText size={15} style={{ color: "var(--color-text-secondary)" }}/>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Контакты и реквизиты</span>
        </a>
      </div>
    </div>
  );
}
