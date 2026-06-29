// ═══════════════════════════════════════════════════════════════════
//  Landing.jsx — премиум-лендинг (Liquid Glass) на Tailwind v4.
//  Бренд: рассвет rose→amber, серив Playfair (.pf-serif), Manrope.
//  Профессиональная отделка: SVG-иконки (Lucide, без эмодзи),
//  фокус-состояния, контраст ≥4.5:1, reduced-motion (см. index.css).
//  Позиционирование: личный ИИ-репетитор + курсы + проверка сочинения.
//  Интерфейс props не менялся (cards, onTryFree, onFreeEssay).
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect } from "react";
import {
  Play, ChevronRight, ArrowRight, Check, ShieldCheck, Clock, FileCheck,
  TrendingUp, Bot, PenLine, Sparkles, GraduationCap, ChevronDown, Star,
  Target, BookOpen, Lightbulb, ListChecks, ScrollText, AlertTriangle,
  MessageCircle, Wallet,
} from "lucide-react";
import { HeroArt } from "./Illustrations";
import { supabase } from "./supabase";

const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

const GLASS = "backdrop-blur-2xl bg-white/65 dark:bg-zinc-900/55 ring-1 ring-white/60 dark:ring-white/10 shadow-[0_18px_50px_-12px_rgba(20,20,45,0.22)]";
const GLASS_SOFT = "backdrop-blur-xl bg-white/55 dark:bg-zinc-900/45 ring-1 ring-white/55 dark:ring-white/10";
const LIFT = "transition duration-300 will-change-transform hover:-translate-y-1.5 hover:shadow-[0_28px_64px_-12px_rgba(20,20,45,0.28)]";
const EYEBROW = "text-[11px] font-bold tracking-[0.14em] uppercase";
// единое фокус-кольцо для клавиатурной навигации (доступность)
const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/80 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-900";

// SVG-иконки вместо эмодзи — ключ к «профессионально выглядит»
const FEATURES = [
  [Target, "Чёткая цель урока", "Знаешь, какое задание ЕГЭ закрываешь и зачем."],
  [BookOpen, "Глубокая теория", "Не «запомни», а «пойми»: правило простыми словами, таблицы, алгоритм."],
  [Lightbulb, "Разобранные примеры", "От простого к сложному, в формате ЕГЭ, с пошаговым решением."],
  [ListChecks, "Практика с ответами", "Задания для самопроверки и ключи в конце каждого урока."],
  [ScrollText, "Шпаргалки", "Сжатая выжимка правила — повторить за вечер перед экзаменом."],
  [AlertTriangle, "Карта ловушек", "Типичные ошибки с примерами, как делать НЕ надо."],
];

const STEPS = [
  ["Выбери предмет", "Информатика или русский. С нуля или сразу с твоего уровня — без воды."],
  ["Учись с разбором", "Теория, примеры и ИИ-наставник рядом на каждом шаге урока."],
  ["Практикуйся и расти", "Задания с проверкой, сочинение по К1–К10 и трекер баллов «до → после»."],
];

const FAQ = [
  ["Подойдёт, если готовлюсь с нуля?", "Да. Курс построен так, чтобы разобраться без репетитора: теория простыми словами, разобранные примеры, практика с ответами. А если что-то непонятно — спроси ИИ-наставника прямо в уроке."],
  ["Что за ИИ-наставник?", "Это помощник внутри платформы: объяснит тему простыми словами под твой уровень, разберёт твою ошибку и подскажет следующий шаг — в любое время, даже ночью перед экзаменом."],
  ["Чем вы лучше тестовых платформ?", "Мы проверяем то, что автопроверка не умеет, — твоё сочинение по реальным критериям К1–К10: ИИ плюс личный разбор автора."],
  ["Доступ навсегда?", "Да, бессрочный. Учись в своём темпе, возвращайся к шпаргалкам перед экзаменом."],
  ["Можно посмотреть до покупки?", "Первый урок открыт бесплатно — оцени формат и подачу."],
];

// ЗАГЛУШКИ — заменить на реальные цифры и отзывы перед активным продвижением.
const RESULTS = [
  ["2", "предмета: информатика и русский"],
  ["27", "заданий ЕГЭ разобрано"],
  ["70+", "уроков с практикой"],
  ["24/7", "ИИ-наставник на связи"],
];
const REVIEWS = [
  ["А.", "11 класс", "Сочинение наконец стало понятным — проверка по К1–К10 показала, где я реально терял баллы."],
  ["М.", "выпускник", "Готовился по информатике без репетитора и разобрался с нуля. Объясняют по-человечески."],
  ["Д.", "11 класс", "Шпаргалки — топ. Перед экзаменом повторил всё за вечер и не растерялся."],
];

function Faq({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`${GLASS_SOFT} rounded-2xl overflow-hidden`}>
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className={`w-full flex items-center gap-3 px-[18px] py-[15px] text-left text-zinc-900 dark:text-zinc-100 cursor-pointer ${FOCUS} focus-visible:rounded-2xl`}>
        <span className="flex-1 text-sm font-semibold">{q}</span>
        <ChevronDown size={17} aria-hidden className={`text-zinc-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`}/>
      </button>
      {open && <div className="px-[18px] pb-[15px] text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-300">{a}</div>}
    </div>
  );
}

export default function Landing({ cards, onTryFree, onFreeEssay }) {
  // одобренные отзывы из базы (если есть — показываем их вместо заглушек)
  const [dbReviews, setDbReviews] = useState([]);
  useEffect(() => {
    supabase.from("reviews").select("author_name,rating,body")
      .eq("status", "approved").order("created_at", { ascending: false }).limit(9)
      .then(({ data }) => { if (data && data.length) setDbReviews(data); });
  }, []);
  return (
    <div className="relative text-left isolate">
      {/* живой градиентный фон под стеклом */}
      <div className="pf-mesh"/>
      <div className="pf-blob" style={{ width: 220, height: 220, top: -30, left: -40,
        background: "radial-gradient(circle, #e11d48, transparent 70%)" }}/>
      <div className="pf-blob" style={{ width: 260, height: 260, top: 120, right: -60,
        background: "radial-gradient(circle, #f59e0b, transparent 70%)", animationDelay: "1.5s" }}/>

      <div className="relative z-[1]">

        {/* ───────── HERO ───────── */}
        <section className={`${GLASS} rounded-[28px] p-7 sm:p-9 mb-5`}>
          <div className="grid grid-cols-1 md:grid-cols-[1.15fr_0.85fr] gap-6 items-center">
            <div className="pf-fade">
              <div className={`${EYEBROW} text-amber-700 dark:text-amber-300 mb-3`}>Подготовка к ЕГЭ 2027 · информатика и русский</div>
              <h1 className="pf-serif text-[40px] leading-[1.08] tracking-tight text-zinc-900 dark:text-zinc-50">
                Высокий балл на ЕГЭ<br/>
                <span className="pf-gradient-text">без репетитора</span>
              </h1>
              <p className="mt-4 mb-6 max-w-[470px] text-[14.5px] leading-relaxed text-zinc-600 dark:text-zinc-300">
                Полные курсы по информатике и русскому — теория, разборы, практика с ответами.
                Рядом на каждом шаге — <strong className="text-zinc-900 dark:text-zinc-100">ИИ-наставник</strong>, который
                объяснит любую тему 24/7, и <strong className="text-zinc-900 dark:text-zinc-100">проверка сочинения</strong> по критериям ФИПИ.
              </p>
              <div className="flex flex-wrap gap-3">
                <button onClick={onTryFree}
                  className={`pf-cta inline-flex items-center gap-2 rounded-2xl px-6 py-3.5 text-[14.5px] font-bold text-white
                    bg-gradient-to-br from-[#f59e0b] to-[#f97316] shadow-[0_10px_26px_rgba(249,115,22,0.4)] cursor-pointer ${FOCUS}`}>
                  <Play size={17} aria-hidden/> Бесплатный урок
                </button>
                <button onClick={() => scrollTo("pf-courses")}
                  className={`${GLASS_SOFT} ${LIFT} ${FOCUS} inline-flex items-center gap-1.5 rounded-2xl px-5 py-3.5
                    text-[14.5px] font-semibold text-zinc-900 dark:text-zinc-100 cursor-pointer`}>
                  Смотреть курсы <ChevronRight size={16} aria-hidden/>
                </button>
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                <ShieldCheck size={15} className="text-emerald-600 dark:text-emerald-500 shrink-0" aria-hidden/>
                По кодификатору ФИПИ 2027 · доступ навсегда · оплата через ЮKassa
              </div>
            </div>
            <div className="pf-float relative" aria-hidden>
              <HeroArt/>
            </div>
          </div>
        </section>

        {/* ───────── TRUST BAR ───────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            [<ShieldCheck size={18}/>, "По ФИПИ 2027", "кодификатор и демоверсия"],
            [<FileCheck size={18}/>, "Проверка сочинения", "ИИ + личный разбор автора"],
            [<Clock size={18}/>, "ИИ-наставник 24/7", "объяснит в любое время"],
            [<GraduationCap size={18}/>, "Урок бесплатно", "оцени формат до покупки"],
          ].map(([ic, t, d], i) => (
            <div key={i} className={`${GLASS_SOFT} ${LIFT} rounded-2xl p-[14px]`}>
              <div className="text-[#e11d48] mb-2" aria-hidden>{ic}</div>
              <div className="text-[12.5px] font-bold text-zinc-900 dark:text-zinc-100">{t}</div>
              <div className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-0.5">{d}</div>
            </div>
          ))}
        </div>

        {/* ───────── ИИ-НАСТАВНИК (центр стратегии) ───────── */}
        <section className="relative overflow-hidden mb-7 rounded-[28px] p-7 sm:p-8 text-white
          bg-gradient-to-br from-[#1d1b3a] via-[#2c2150] to-[#4a2350] shadow-[0_26px_64px_-16px_rgba(20,16,45,0.6)]">
          <div className="pf-blob" style={{ width: 240, height: 240, top: -70, left: -40,
            background: "radial-gradient(circle, rgba(245,158,11,.55), transparent 70%)" }} aria-hidden/>
          <div className="relative z-[1] grid grid-cols-1 md:grid-cols-[0.95fr_1.05fr] gap-6 items-center">
            <div>
              <div className={`${EYEBROW} text-amber-300 mb-3`}>Личный ИИ-репетитор</div>
              <h2 className="pf-serif text-[28px] leading-snug text-white">Не понял тему в 2 ночи?<br/>Спроси ИИ-наставника</h2>
              <p className="mt-3 mb-[18px] max-w-[440px] text-sm leading-relaxed text-white/85">
                Объяснит простыми словами под твой уровень, разберёт твою ошибку и подскажет
                следующий шаг. Как репетитор — только круглосуточно и <strong className="text-white">доступно каждому</strong>.
              </p>
              <button onClick={onTryFree}
                className={`pf-cta inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold text-[#2c2150] bg-white shadow-[0_10px_26px_rgba(0,0,0,0.25)] cursor-pointer ${FOCUS}`}>
                <MessageCircle size={16} aria-hidden/> Попробовать в бесплатном уроке
              </button>
            </div>
            <div className="flex flex-col gap-2.5">
              {[
                [Clock, "Отвечает 24/7", "Даже ночью перед экзаменом — наставник на связи."],
                [MessageCircle, "Объясняет простыми словами", "Под твой уровень: «как пятикласснику», короче, с примером."],
                [ListChecks, "Ведёт по практике пошагово", "Даёт наводку, а не готовый ответ — чтобы ты понял сам."],
                [Wallet, "Доступная цена", "Бесплатный вход и честная стоимость — чтобы мог позволить каждый."],
              ].map(([Ic, t, d], i) => (
                <div key={i} className="flex items-start gap-3 rounded-2xl p-3.5 bg-white/10 ring-1 ring-white/15">
                  <span className="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center shrink-0 bg-amber-500/20 text-amber-200" aria-hidden>
                    <Ic size={17}/>
                  </span>
                  <div>
                    <div className="text-[13.5px] font-bold text-white">{t}</div>
                    <div className="text-[12px] leading-snug text-white/70 mt-0.5">{d}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ───────── КУРСЫ ───────── */}
        <section id="pf-courses" className="mb-7 scroll-mt-6">
          <div className={`${EYEBROW} text-[#e11d48] mb-3`}>Курсы</div>
          <h2 className="pf-serif text-[27px] mb-4 text-zinc-900 dark:text-zinc-50">Выбери свой предмет</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">{cards}</div>
        </section>

        {/* ───────── КАК ЭТО РАБОТАЕТ ───────── */}
        <section className="mb-7">
          <div className={`${EYEBROW} text-indigo-500 dark:text-indigo-400 mb-3`}>Как это работает</div>
          <h2 className="pf-serif text-[27px] mb-4 text-zinc-900 dark:text-zinc-50">Три шага до результата</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {STEPS.map(([t, d], i) => (
              <div key={i} className={`${GLASS} rounded-3xl p-[20px] relative`}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-[15px] font-bold text-white mb-3
                  bg-gradient-to-br from-[#e11d48] to-[#f59e0b] shadow-[0_8px_20px_rgba(225,29,72,0.3)]">{i + 1}</div>
                <div className="text-[15px] font-bold mb-1 text-zinc-900 dark:text-zinc-100">{t}</div>
                <div className="text-[12.5px] leading-relaxed text-zinc-600 dark:text-zinc-400">{d}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ───────── ЧТО ВНУТРИ УРОКА ───────── */}
        <section className="mb-7">
          <div className={`${EYEBROW} text-[#e11d48] mb-3`}>Методика</div>
          <h2 className="pf-serif text-[27px] mb-1 text-zinc-900 dark:text-zinc-50">Что внутри каждого урока</h2>
          <p className="mb-[18px] max-w-[560px] text-[13.5px] leading-relaxed text-zinc-600 dark:text-zinc-400">
            Единая строгая структура — ученик идёт по ней и осваивает тему с нуля, шаг за шагом.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {FEATURES.map(([Ic, t, d]) => (
              <div key={t} className={`${GLASS} ${LIFT} rounded-3xl p-[18px]`}>
                <div className="w-[46px] h-[46px] rounded-2xl flex items-center justify-center mb-3 text-[#e11d48]
                  bg-gradient-to-br from-[#e11d48]/12 to-[#f59e0b]/12" aria-hidden>
                  <Ic size={22} strokeWidth={2}/>
                </div>
                <div className="text-sm font-bold mb-1 text-zinc-900 dark:text-zinc-100">{t}</div>
                <div className="text-[12.5px] leading-snug text-zinc-600 dark:text-zinc-400">{d}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ───────── ОТЛИЧИЕ: ПРОВЕРКА СОЧИНЕНИЯ ───────── */}
        <section className="relative overflow-hidden mb-7 rounded-[28px] p-7 sm:p-8 text-white
          bg-gradient-to-br from-[#221a40] via-[#3b2c5e] to-[#5b2a52] shadow-[0_26px_64px_-16px_rgba(20,16,45,0.6)]">
          <div className="pf-blob" style={{ width: 240, height: 240, top: -70, right: -50,
            background: "radial-gradient(circle, rgba(245,158,11,.6), transparent 70%)" }} aria-hidden/>
          <div className="relative z-[1] grid grid-cols-1 md:grid-cols-[1.1fr_0.9fr] gap-6 items-center">
            <div>
              <div className={`${EYEBROW} text-amber-300 mb-3`}>Чего нет у других</div>
              <h2 className="pf-serif text-[28px] leading-snug text-white">Проверим твоё сочинение по критериям К1–К10</h2>
              <p className="mt-3 mb-[18px] max-w-[440px] text-sm leading-relaxed text-white/85">
                Сочинение — это 22 из 50 баллов. Тестовые платформы его не проверяют, а мы —
                да: мгновенный разбор ИИ по каждому критерию и прогноз баллов, плюс личный
                вердикт автора курса.
              </p>
              <div className="flex flex-col gap-2.5">
                {[
                  [Bot, "ИИ-разбор по К1–К10 + прогноз баллов"],
                  [PenLine, "Личная проверка автором, как у репетитора"],
                  [TrendingUp, "Трекер баллов «до → после»"],
                ].map(([Ic, t], i) => (
                  <div key={i} className="flex items-center gap-2.5 text-[13.5px]">
                    <span className="w-[30px] h-[30px] rounded-[9px] flex items-center justify-center shrink-0
                      bg-amber-500/20 text-amber-200" aria-hidden><Ic size={15}/></span>
                    {t}
                  </div>
                ))}
              </div>
              <button onClick={onFreeEssay}
                className={`pf-cta mt-5 inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold text-[#3b2c5e] bg-white shadow-[0_10px_26px_rgba(0,0,0,0.25)] cursor-pointer ${FOCUS}`}>
                <FileCheck size={16} aria-hidden/> Проверить сочинение бесплатно
              </button>
            </div>
            <div className={`${GLASS} rounded-[18px] p-4 text-zinc-900 dark:text-zinc-100`} aria-hidden>
              <div className="flex items-center gap-2.5 mb-3">
                <span className="pf-serif text-[30px] text-[#e11d48]">19<span className="text-[15px] text-zinc-500">/22</span></span>
                <div className="flex-1 h-[9px] rounded-full bg-[#e11d48]/15">
                  <div className="h-full w-[86%] rounded-full bg-gradient-to-r from-[#e11d48] to-emerald-500"/>
                </div>
              </div>
              {[["К1 Позиция автора", "1/1"], ["К2 Комментарий", "3/3"], ["К7 Орфография", "2/3"], ["К8 Пунктуация", "3/3"]].map(([k, v]) => (
                <div key={k} className="flex justify-between text-[12.5px] py-[7px] border-b border-black/5 dark:border-white/10">
                  <span className="text-zinc-600 dark:text-zinc-400">{k}</span>
                  <span className="font-bold flex items-center gap-1.5"><Check size={13} className="text-emerald-600"/>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ───────── АВТОР ───────── */}
        <section className={`${GLASS} rounded-3xl p-[22px] mb-7 flex flex-wrap gap-[18px] items-center`}>
          <div className="w-[66px] h-[66px] rounded-full shrink-0 flex items-center justify-center text-[22px] font-bold text-white
            bg-gradient-to-br from-[#1d1b3a] to-[#5b2a52] shadow-[0_10px_24px_rgba(20,16,45,0.3)]" aria-hidden>КШ</div>
          <div className="flex-1 min-w-[240px]">
            <div className={`${EYEBROW} text-amber-700 dark:text-amber-300 mb-1.5`}>Автор курса</div>
            <div className="pf-serif text-[21px] mb-1 text-zinc-900 dark:text-zinc-100">Кирилл Шевелев</div>
            <p className="text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-400">
              Собрал курсы так, как хотел бы готовиться сам: без воды, по делу, с разбором каждого задания
              и личной поддержкой. С каждым учеником можно списаться прямо в кабинете.
            </p>
          </div>
          <Sparkles size={24} className="text-amber-500 shrink-0" aria-hidden/>
        </section>

        {/* ───────── РЕЗУЛЬТАТЫ / В ЦИФРАХ ───────── */}
        <section className="mb-7">
          <div className={`${EYEBROW} text-emerald-600 dark:text-emerald-500 mb-3`}>Kirenix в цифрах</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {RESULTS.map(([n, l], i) => (
              <div key={i} className={`${GLASS} rounded-2xl p-4 text-center`}>
                <div className="pf-serif text-[34px] leading-none pf-gradient-text">{n}</div>
                <div className="mt-2 text-[11.5px] text-zinc-600 dark:text-zinc-400 leading-snug">{l}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ───────── ОТЗЫВЫ ───────── */}
        <section className="mb-7">
          <div className={`${EYEBROW} text-[#e11d48] mb-3`}>Отзывы</div>
          <h2 className="pf-serif text-[27px] mb-4 text-zinc-900 dark:text-zinc-50">Что говорят ученики</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(dbReviews.length
              ? dbReviews.map((r) => ({
                  ini: (r.author_name || "?").trim().charAt(0).toUpperCase(),
                  who: r.author_name, text: r.body, rating: r.rating }))
              : REVIEWS.map(([ini, who, text]) => ({ ini, who, text, rating: 5 }))
            ).map(({ ini, who, text, rating }, i) => (
              <div key={i} className={`${GLASS} ${LIFT} rounded-3xl p-5`}>
                <div className="flex gap-0.5 mb-3 text-amber-400" role="img" aria-label={`Оценка ${rating} из 5`}>
                  {[0, 1, 2, 3, 4].map((s) => (
                    <Star key={s} size={15} aria-hidden fill={s < rating ? "currentColor" : "none"} strokeWidth={s < rating ? 0 : 1.5}/>
                  ))}
                </div>
                <p className="text-[13.5px] leading-relaxed text-zinc-700 dark:text-zinc-300 mb-4">«{text}»</p>
                <div className="flex items-center gap-2.5">
                  <span className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold bg-gradient-to-br from-[#1d1b3a] to-[#5b2a52]" aria-hidden>{ini}</span>
                  <span className="text-[12px] text-zinc-600 dark:text-zinc-400">{who}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ───────── FAQ ───────── */}
        <section className="mb-7">
          <div className={`${EYEBROW} text-[#e11d48] mb-3`}>Вопросы</div>
          <h2 className="pf-serif text-[25px] mb-3.5 text-zinc-900 dark:text-zinc-50">Частые вопросы</h2>
          <div className="flex flex-col gap-2.5">{FAQ.map(([q, a], i) => <Faq key={i} q={q} a={a}/>)}</div>
        </section>

        {/* ───────── ФИНАЛЬНЫЙ CTA ───────── */}
        <section className="relative overflow-hidden mb-3 rounded-[28px] text-center py-9 px-6 text-white
          bg-gradient-to-br from-[#e11d48] to-[#f97316] shadow-[0_26px_64px_-16px_rgba(225,29,72,0.55)]">
          <div className="pf-blob" style={{ width: 300, height: 300, top: -120, left: "50%", marginLeft: -150,
            background: "radial-gradient(circle, rgba(255,255,255,.35), transparent 70%)" }} aria-hidden/>
          <div className="relative z-[1]">
            <h2 className="pf-serif text-[30px] mb-2 text-white">Начни с бесплатного урока</h2>
            <p className="mx-auto mb-5 max-w-[440px] text-[14.5px] leading-relaxed text-white/90">
              Посмотри формат и подачу, попробуй ИИ-наставника — а дальше реши сам. Первый урок открыт без оплаты.
            </p>
            <button onClick={onTryFree}
              className={`pf-cta inline-flex items-center gap-2 rounded-2xl px-7 py-3.5 text-[15px] font-bold text-[#e11d48] bg-white
                shadow-[0_12px_30px_rgba(0,0,0,0.2)] cursor-pointer ${FOCUS} focus-visible:ring-white`}>
              <Play size={17} aria-hidden/> Открыть бесплатный урок <ArrowRight size={16} aria-hidden/>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
