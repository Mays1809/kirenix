// ═══════════════════════════════════════════════════════════════════
//  medal.js — расчёт прогресса к золотой медали
//  Условия («За особые успехи в учении» I степени, приказ Минпросвещения):
//   1) все ИТОГОВЫЕ оценки аттестата за 10 и 11 класс — «5»
//      (итоговая = среднее арифметическое полугодовых и годовых, округлённое);
//   2) ЕГЭ русский язык ≥ 70 баллов;
//   3) ЕГЭ ещё по одному предмету ≥ 70 баллов (любой профильный, не обязательно математика).
//  Математика в аттестате — это три отдельных предмета: алгебра, геометрия,
//  вероятность и статистика (у каждого своя итоговая).
// ═══════════════════════════════════════════════════════════════════

// Предметы аттестата (по каждому — своя итоговая из полугодий и года)
export const MEDAL_SUBJECTS = [
  "Русский язык", "Литература",
  "Алгебра", "Геометрия", "Вероятность и статистика",
  "Информатика", "Физика", "Химия", "Биология",
  "История", "Обществознание", "География",
  "Иностранный язык", "Физическая культура",
  "ОБЗР", "Индивидуальный проект",
];

// Профильные ЕГЭ-предметы (100-балльные) для второго условия медали
export const EGE_SUBJECTS = [
  "Математика (профиль)", "Информатика", "Физика", "Химия", "Биология",
  "История", "Обществознание", "География", "Литература",
  "Английский язык", "Немецкий язык", "Французский язык",
  "Испанский язык", "Китайский язык",
];

// Периоды, из которых складывается итоговая: полугодие I, полугодие II, годовая
export const PERIODS = [
  { key: "h1", short: "I", title: "Полугодие I" },
  { key: "h2", short: "II", title: "Полугодие II" },
  { key: "y", short: "год", title: "Годовая" },
];

/**
 * Итоговая оценка по предмету = среднее арифметическое всех заполненных
 * полугодовых и годовых за 10 и 11 класс, округлённое (0.5 — вверх).
 * marks[subject] = { "10": {h1,h2,y}, "11": {h1,h2,y} }
 * Возвращает { itog, avg, count } либо null, если ничего не заполнено.
 */
export function subjectItog(subjMarks) {
  const vals = [];
  ["10", "11"].forEach((cls) => {
    const c = (subjMarks && subjMarks[cls]) || {};
    PERIODS.forEach((p) => {
      const v = Number(c[p.key]);
      if (v >= 2 && v <= 5) vals.push(v);
    });
  });
  if (!vals.length) return null;
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  return { itog: Math.round(avg), avg, count: vals.length };
}

/** Возвращает { pct, conditions[], threats[], itogs[] } по medal_data */
export function computeMedal(d) {
  const data = d || {};
  const marks = data.marks || {};
  const ege = data.ege || {};

  // ── Итоговые по предметам ──
  const itogs = Object.keys(marks)
    .map((s) => {
      const r = subjectItog(marks[s]);
      return r ? { s, ...r } : null;
    })
    .filter(Boolean);

  const filledCount = itogs.length;
  const fives = itogs.filter((x) => x.itog === 5).length;
  const gradesFilled = filledCount > 0;
  const gradesOk = gradesFilled && fives === filledCount;
  const gradesPart = gradesFilled ? fives / filledCount : 0;

  // ── ЕГЭ ──
  const rus = Number(ege.rus) || 0;
  const rusOk = rus >= 70;

  const others = Array.isArray(ege.subjects) ? ege.subjects : [];
  const bestOther = others.reduce((m, o) => Math.max(m, Number(o.score) || 0), 0);
  const secondOk = bestOther >= 70;
  const secondSubj = secondOk
    ? (others.find((o) => (Number(o.score) || 0) >= 70)?.name || null)
    : null;

  const rusPart = Math.min(rus, 70) / 70;
  const secondPart = Math.min(bestOther, 70) / 70;

  const pct = Math.round(70 * gradesPart + 15 * rusPart + 15 * secondPart);
  const anyData = gradesFilled || rus || bestOther;

  const threats = [
    ...itogs.filter((x) => x.itog < 5).map((x) => ({
      kind: "grade",
      text: `${x.s}: итоговая ${x.itog} (среднее ${x.avg.toFixed(1)}) — нужна «5»`,
    })),
    ...(!rusOk ? [{ kind: "ege", text: rus
        ? `ЕГЭ русский: цель 70+, сейчас ${rus}`
        : "ЕГЭ русский: укажи текущий/целевой балл (нужно 70+)" }] : []),
    ...(!secondOk ? [{ kind: "ege", text: bestOther
        ? `Второй предмет ЕГЭ: цель 70+, лучший сейчас ${bestOther}`
        : "Добавь второй предмет ЕГЭ с баллом 70+ (любой профильный)" }] : []),
  ];

  return {
    pct: anyData ? pct : 0,
    filled: gradesFilled,
    itogs,
    conditions: [
      { label: "Все итоговые оценки 10–11 класса — «5»",
        ok: gradesOk,
        detail: gradesFilled ? `пятёрок ${fives} из ${filledCount}` : "оценки не заполнены" },
      { label: "ЕГЭ русский язык — 70+ баллов",
        ok: rusOk, detail: rus ? `сейчас ${rus}` : "не указано" },
      { label: "ЕГЭ ещё один предмет — 70+ баллов",
        ok: secondOk,
        detail: secondOk ? `${secondSubj}: ${bestOther}`
              : bestOther ? `лучший: ${bestOther}` : "не указано" },
    ],
    threats,
  };
}
