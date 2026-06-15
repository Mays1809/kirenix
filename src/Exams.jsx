// ═══════════════════════════════════════════════════════════════════
//  Exams.jsx — пробники. Честная страница: раздел в разработке,
//  пока тренируемся на практике внутри курса.
// ═══════════════════════════════════════════════════════════════════

import { ArrowLeft, FileText, Timer, Bot, CheckCircle, Play } from "lucide-react";

const card = (extra = {}) => ({
  background: "var(--color-background-primary)",
  borderRadius: "var(--border-radius-lg)",
  border: "0.5px solid var(--color-border-tertiary)",
  ...extra,
});

export default function Exams({ onBack, onOpenCourse }) {
  return (
    <div>
      <button onClick={onBack} style={{
        display: "flex", alignItems: "center", gap: 6, background: "none",
        border: "none", cursor: "pointer", fontSize: 13,
        color: "var(--color-text-secondary)", padding: "0 0 14px 0",
      }}>
        <ArrowLeft size={14}/> Назад
      </button>

      <div style={{
        ...card(), padding: "22px 20px", marginBottom: 14,
        background: "linear-gradient(135deg,#f59e0b15,transparent)",
        borderLeft: "4px solid #f59e0b",
      }}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
          📝 Пробники ЕГЭ — скоро
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.7, color: "var(--color-text-secondary)" }}>
          Раздел в разработке. Здесь появятся полные варианты ЕГЭ по информатике
          в формате 2026 года — с таймером, автопроверкой и разбором каждой ошибки.
        </div>
      </div>

      <div style={{ ...card(), padding: "18px 20px", marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Что будет внутри</div>
        {[
          [<FileText size={15}/>, "Полные варианты из 27 заданий в формате ФИПИ 2026"],
          [<Timer size={15}/>, "Таймер 3 ч 55 мин — как на настоящем экзамене"],
          [<CheckCircle size={15}/>, "Автопроверка и первичные/тестовые баллы"],
          [<Bot size={15}/>, "AI-разбор каждой ошибки: почему не так и как надо"],
        ].map(([icon, text], i) => (
          <div key={i} style={{ display: "flex", gap: 10, alignItems: "center",
            padding: "7px 0", fontSize: 13 }}>
            <span style={{ color: "#f59e0b", display: "flex" }}>{icon}</span>
            {text}
          </div>
        ))}
      </div>

      <div style={{ ...card(), padding: "18px 20px", textAlign: "center" }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 6 }}>
          А пока — практика в каждом уроке курса
        </div>
        <div style={{ fontSize: 12.5, color: "var(--color-text-secondary)", marginBottom: 14 }}>
          15–20 задач с ответами на каждый урок, всего ~600 задач. Урок 1.1 — бесплатно.
        </div>
        <button onClick={onOpenCourse} style={{
          display: "inline-flex", alignItems: "center", gap: 7, padding: "11px 20px",
          borderRadius: "var(--border-radius-md)", border: "none", cursor: "pointer",
          background: "linear-gradient(135deg,#3b82f6,#6366f1)", color: "#fff",
          fontSize: 13, fontWeight: 700,
        }}>
          <Play size={15}/> Открыть курс
        </button>
      </div>
    </div>
  );
}
