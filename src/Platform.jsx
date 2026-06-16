import { useState, useRef, useEffect } from "react";
import {
  BookOpen, Clock, ChevronRight,
  MessageCircle, Bell, User,
  GraduationCap,
  Play, FileText, Home, ArrowLeft,
  ShoppingCart, Loader2, Medal,
} from "lucide-react";
import { supabase } from "./supabase";   // <-- реальный клиент
import CourseStudy, { getContentId } from "./CourseStudy";
import MedalTracker from "./MedalTracker";
import Messages from "./Messages";
import Exams from "./Exams";
import EssayReviews from "./EssayReviews";
import ScoreTracker from "./ScoreTracker";
import Support from "./Support";
import Landing from "./Landing";
import EssayChecker from "./EssayChecker";
import Reviews from "./Reviews";
import Referral from "./Referral";
import { computeMedal } from "./medal";
import {
  fetchCourseIndex, checkCourseAccess, startPurchase, clearLessonCache,
  fetchCatalog,
} from "./courses/courseApi";

/* ═══════════════════════════════════════════════════════════════════
   МОКОВЫЕ ДАННЫЕ (для каталога и учителей)
   ═══════════════════════════════════════════════════════════════════ */

/* Фолбэк-каталог: используется, пока не загрузился каталог из БД
   (или если таблица catalog_courses ещё не создана) */
const FALLBACK_CATALOG = [
  {
    id:"c3", title:"Информатика ЕГЭ 2026: все 27 заданий",
    teacher:"Кирилл Шевелев", teacher_avatar:"КШ", school:"Авторский курс",
    subject:"Информатика", subject_icon:"💻", subject_color:"#3b82f6",
    price:5200, original_price:null,
    duration:"70 ч", lessons:38, format:"text",
    level:"intermediate", cover_color:"#3b82f6",
    content_id:"informatics",   // ← встроенный полный курс (11 модулей)
    tags:["11 модулей","Разбор всех 27 заданий","Практика с ответами","Python"],
    short_desc:"Полный текстовый курс: теория, разобранные примеры, практика с ответами, шпаргалки. Машина Тьюринга, задание 22 «на максимум» — по ФИПИ 2026.",
  },
  {
    id:"c4", title:"Русский язык ЕГЭ 2026: все 27 заданий и сочинение",
    teacher:"Кирилл Шевелев", teacher_avatar:"КШ", school:"Авторский курс",
    subject:"Русский язык", subject_icon:"📝", subject_color:"#e11d48",
    price:4000, original_price:5900,
    duration:"60 ч", lessons:35, format:"text",
    level:"intermediate", cover_color:"#e11d48",
    content_id:"russian",   // ← встроенный полный курс (8 модулей)
    tags:["8 модулей","Все 27 заданий","Сочинение на 22 балла","По ФИПИ 2026"],
    short_desc:"Полный текстовый курс: теория, разобранные примеры, практика с ответами, шпаргалки. Орфоэпия, паронимы, орфография, пунктуация и сочинение по критериям К1–К10 ФИПИ 2026.",
  },
];

/* ── Владельцы платформы: полный доступ ко всем курсам без покупки ── */
const OWNER_EMAILS = ["maysbad@gmail.com"];
const isOwner = (user, profile) =>
  OWNER_EMAILS.includes((user?.email || "").toLowerCase()) ||
  ["owner", "admin"].includes(profile?.role);

const initialsOf = (name = "") =>
  name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase() || "У";


/* ═══════════════════════════════════════════════════════════════════
   УТИЛИТЫ И СТИЛИ
   ═══════════════════════════════════════════════════════════════════ */

const card = (extra = {}) => ({
  background:   "var(--color-background-primary)",
  borderRadius: "var(--border-radius-lg)",
  border:       "0.5px solid var(--color-border-tertiary)",
  boxShadow:    "var(--shadow-sm)",
  ...extra,
});

const gradBtn = (disabled = false) => ({
  padding: "11px 20px", borderRadius: "var(--border-radius-md)",
  border: "none",
  background: disabled
    ? "var(--color-border-secondary)"
    : "linear-gradient(135deg, #f59e0b 0%, #f97316 100%)",
  boxShadow: disabled ? "none" : "0 4px 14px rgba(249,115,22,.35)",
  color: "#fff", fontSize: 13, fontWeight: 600,
  cursor: disabled ? "not-allowed" : "pointer",
  display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
  transition: "transform .2s, box-shadow .2s",
  whiteSpace: "nowrap",
});

const Avatar = ({ initials, size = 36, color = "#6366f1" }) => (
  <div style={{
    width:size, height:size, borderRadius:"50%", flexShrink:0,
    background:color, display:"flex", alignItems:"center", justifyContent:"center",
    fontSize:size*.38, fontWeight:600, color:"#fff",
  }}>
    {initials}
  </div>
);

const Badge = ({ children, color = "#6366f1" }) => (
  <span style={{
    display:"inline-flex", alignItems:"center", gap:3,
    fontSize:10, fontWeight:600, color,
    background:color+"18", borderRadius:99, padding:"3px 8px", whiteSpace:"nowrap",
  }}>
    {children}
  </span>
);


/* ═══════════════════════════════════════════════════════════════════
   КНОПКА ПОКУПКИ (реальная оплата через ЮKassa Edge Function)
   ═══════════════════════════════════════════════════════════════════ */

const BuyCourseButton = ({ course, user, onAccess }) => {
  const [loading, setLoading] = useState(false);

  const handleBuy = async () => {
    if (!user) { alert("Войдите в аккаунт, чтобы купить курс."); return; }
    setLoading(true);
    try {
      // Платёж создаёт сервер (Edge Function) — цена тоже задана на сервере
      const res = await startPurchase(getContentId(course));
      if (res?.url) { window.location.href = res.url; return; }
      if (res?.already) {
        clearLessonCache();
        if (onAccess) onAccess();
      }
    } catch (e) {
      alert("Ошибка оплаты: " + e.message);
    }
    setLoading(false);
  };

  return (
    <button
      onClick={handleBuy}
      disabled={loading}
      style={{
        ...gradBtn(loading),
        flex: 1,
        maxWidth: 240,
      }}
    >
      {loading
        ? <Loader2 size={15} style={{ animation:"spin 1s linear infinite" }} />
        : <ShoppingCart size={15} />}
      {`Купить за ${course.price.toLocaleString()} ₽`}
    </button>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   КАРТОЧКА КУРСА
   ═══════════════════════════════════════════════════════════════════ */

const CourseCard = ({ course, onOpen, owned, onStudy }) => (
  <div
    onClick={() => (owned ? onStudy(course) : onOpen(course))}
    style={{ ...card(), cursor:"pointer", overflow:"hidden", transition:"transform .2s, box-shadow .2s" }}
    onMouseEnter={e => { e.currentTarget.style.transform="translateY(-3px)"; e.currentTarget.style.boxShadow="0 8px 24px rgba(0,0,0,.1)"; }}
    onMouseLeave={e => { e.currentTarget.style.transform="translateY(0)";    e.currentTarget.style.boxShadow="none"; }}
  >
    <div style={{
      height:100, background:`linear-gradient(135deg,${course.cover_color}dd,${course.cover_color}88)`,
      display:"flex", alignItems:"center", justifyContent:"center",
      fontSize:40, position:"relative",
    }}>
      {course.subject_icon}
      {course.original_price && (
        <div style={{
          position:"absolute", top:8, right:8,
          background:"#ef4444", color:"#fff",
          fontSize:10, fontWeight:700, borderRadius:99, padding:"2px 7px",
        }}>
          -{Math.round((1-course.price/course.original_price)*100)}%
        </div>
      )}
    </div>

    <div style={{ padding:"12px 14px" }}>
      <div style={{ fontSize:10, color:"var(--color-text-secondary)", marginBottom:4 }}>
        {course.school}
      </div>
      <div style={{ fontSize:13, fontWeight:600, lineHeight:1.4, marginBottom:8 }}>
        {course.title}
      </div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
        <div style={{ fontSize:11, color:"var(--color-text-secondary)" }}>{course.teacher}</div>
        {owned ? <Badge color="#10b981">✓ Куплено</Badge> : <Badge color="#10b981">Урок 1.1 бесплатно</Badge>}
      </div>
      <div style={{ display:"flex", gap:10, marginBottom:10 }}>
        {[
          [<Clock size={10}/>, course.duration],
          [<BookOpen size={10}/>, `${course.lessons} уроков`],
          [<Play size={10}/>, "все 27 заданий"],
        ].map(([icon,text],i) => (
          <span key={i} style={{ display:"flex", alignItems:"center", gap:3,
            fontSize:10, color:"var(--color-text-secondary)" }}>
            {icon}{text}
          </span>
        ))}
      </div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        {owned ? (
          <span style={{ fontSize:13, fontWeight:700, color:"#10b981" }}>✓ Курс открыт</span>
        ) : (
          <div style={{ display:"flex", alignItems:"baseline", gap:6 }}>
            <span style={{ fontSize:16, fontWeight:700,
              color:course.price===0?"#10b981":"var(--color-text-primary)" }}>
              {course.price===0?"Бесплатно":`${course.price.toLocaleString()} ₽`}
            </span>
            {course.original_price && (
              <span style={{ fontSize:11, color:"var(--color-text-secondary)", textDecoration:"line-through" }}>
                {course.original_price.toLocaleString()} ₽
              </span>
            )}
          </div>
        )}
        <div style={{
          background: owned ? "linear-gradient(135deg,#10b981,#059669)" : "linear-gradient(135deg,#f59e0b,#f97316)",
          borderRadius:99, padding:"5px 12px",
          fontSize:11, fontWeight:600, color:"#fff",
        }}>
          {owned ? "Открыть →" : (course.price===0?"Начать":"Купить")}
        </div>
      </div>
    </div>
  </div>
);

/* ═══════════════════════════════════════════════════════════════════
   СТРАНИЦА КУРСА
   ═══════════════════════════════════════════════════════════════════ */

const CoursePage = ({ course, onBack, onMessages, onStudy, user, profile }) => {
  const contentId = getContentId(course);
  const hasContent = !!contentId;
  const owner = isOwner(user, profile);
  const [access, setAccess] = useState(false);
  const [checking, setChecking] = useState(hasContent);
  const [courseIndex, setCourseIndex] = useState(null);

  /* Доступ проверяет сервер (RPC has_course_access: покупка или админ) */
  useEffect(() => {
    let active = true;
    if (!hasContent) { setChecking(false); return; }
    checkCourseAccess(contentId).then((a) => {
      if (active) { setAccess(a); setChecking(false); }
    });
    fetchCourseIndex(contentId)
      .then((idx) => { if (active) setCourseIndex(idx); })
      .catch(() => {});
    return () => { active = false; };
  }, [course.id, user]); // eslint-disable-line react-hooks/exhaustive-deps

  const fullAccess = owner || access;

  return (
  <div>
    <button onClick={onBack} style={{
      display:"flex", alignItems:"center", gap:6, background:"none", border:"none",
      cursor:"pointer", fontSize:13, color:"var(--color-text-secondary)", padding:"0 0 16px 0",
    }}>
      <ArrowLeft size={14}/> Назад к каталогу
    </button>

    <div style={{
      ...card(), overflow:"hidden", marginBottom:14, boxShadow:"var(--shadow-md)",
      background:`linear-gradient(135deg,${course.cover_color}22,transparent)`,
      borderLeft:`4px solid ${course.cover_color}`,
    }}>
      <div style={{ padding:"20px" }}>
        <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginBottom:6 }}>
          {course.subject_icon} {course.subject} · {course.school}
        </div>
        <div className="pf-serif" style={{ fontSize:22, lineHeight:1.25, marginBottom:10 }}>
          {course.title}
        </div>
        <div style={{ fontSize:13, color:"var(--color-text-secondary)", lineHeight:1.6, marginBottom:14 }}>
          {course.short_desc}
        </div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:16 }}>
          <Badge color="#10b981">Урок 1.1 — бесплатно</Badge>
          <Badge color={course.cover_color}>Доступ навсегда</Badge>
          <Badge color={course.cover_color}>Проверено по ФИПИ 2026</Badge>
        </div>

        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
          <Avatar initials={course.teacher_avatar} size={38} color={course.cover_color}/>
          <div>
            <div style={{ fontSize:13, fontWeight:500 }}>{course.teacher}</div>
            <div style={{ fontSize:11, color:"var(--color-text-secondary)" }}>Автор курса</div>
          </div>
          <button onClick={onMessages} style={{
            marginLeft:"auto", display:"flex", alignItems:"center", gap:6,
            fontSize:12, padding:"7px 14px", borderRadius:"var(--border-radius-md)",
            border:`1px solid ${course.cover_color}`, background:"transparent",
            cursor:"pointer", color:course.cover_color, fontWeight:500,
          }}>
            <MessageCircle size={14}/> Написать
          </button>
        </div>

        <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:16 }}>
          {course.tags.map(t => <Badge key={t} color={course.cover_color}>{t}</Badge>)}
        </div>

        <div style={{
          display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10,
          padding:"12px", background:"var(--color-background-secondary)",
          borderRadius:"var(--border-radius-md)", marginBottom:16,
        }}>
          {[
            [<Clock size={16}/>,      course.duration, "Длительность"],
            [<BookOpen size={16}/>,   `${course.lessons} уроков`, "Уроков"],
            [<Play size={16}/>,       course.format==="video"?"Видео":course.format==="live"?"Вебинары":course.format==="text"?"Текстовый":"Смешанный", "Формат"],
            [<GraduationCap size={16}/>, course.level==="beginner"?"Начальный":course.level==="intermediate"?"Средний":"Продвинутый", "Уровень"],
          ].map(([icon,val,lbl],i) => (
            <div key={i} style={{ textAlign:"center" }}>
              <div style={{ color:course.cover_color, display:"flex", justifyContent:"center", marginBottom:4 }}>{icon}</div>
              <div style={{ fontSize:12, fontWeight:600 }}>{val}</div>
              <div style={{ fontSize:10, color:"var(--color-text-secondary)" }}>{lbl}</div>
            </div>
          ))}
        </div>

        <div style={{ display:"flex", alignItems:"center", gap:14, flexWrap:"wrap" }}>
          <div>
            <div style={{ fontSize:26, fontWeight:700,
              color:course.price===0?"#10b981":"var(--color-text-primary)" }}>
              {course.price===0?"Бесплатно":`${course.price.toLocaleString()} ₽`}
            </div>
            {course.original_price && (
              <div style={{ fontSize:13, color:"var(--color-text-secondary)", textDecoration:"line-through" }}>
                {course.original_price.toLocaleString()} ₽
              </div>
            )}
          </div>
          {/* Доступ к урокам: владелец/купивший — открыть, остальным — оплата */}
          {checking ? (
            <div style={{ display:"flex", alignItems:"center", gap:8, padding:"11px 20px",
              fontSize:12, color:"var(--color-text-secondary)" }}>
              <Loader2 size={15} style={{ animation:"spin 1s linear infinite" }}/>
              Проверяем доступ…
            </div>
          ) : fullAccess && hasContent ? (
            <>
              <button onClick={() => onStudy(course)} style={{
                ...gradBtn(false), flex:1, maxWidth:240,
                background:`linear-gradient(135deg, ${course.cover_color}, ${course.cover_color}cc)`,
                boxShadow:`0 4px 14px ${course.cover_color}55`,
              }}>
                <BookOpen size={15}/> Открыть курс
              </button>
              {owner && !access && (
                <Badge color="#f59e0b">Доступ владельца</Badge>
              )}
            </>
          ) : hasContent ? (
            <>
              <BuyCourseButton
                course={course}
                user={user}
                onAccess={() => setAccess(true)}
              />
              <button onClick={() => onStudy(course)} style={{
                padding:"11px 16px", borderRadius:"var(--border-radius-md)",
                border:`1px solid ${course.cover_color}`,
                background:`${course.cover_color}10`, color:course.cover_color,
                fontSize:12.5, fontWeight:600, cursor:"pointer",
                display:"flex", alignItems:"center", gap:6,
              }}>
                <Play size={14}/> Бесплатный урок
              </button>
            </>
          ) : null}
        </div>
        {!checking && !fullAccess && hasContent && (
          <div style={{ marginTop:10, fontSize:12, color:"var(--color-text-secondary)" }}>
            🔒 Все {courseIndex?.lessonCount ?? course.lessons} уроков откроются сразу после оплаты.
            Урок 1.1 — бесплатный.
          </div>
        )}
      </div>
    </div>

    {/* Программа курса: модули из БД (публичное оглавление) */}
    {hasContent && (
      <div style={{ ...card(), padding:"16px" }}>
        <div style={{ fontSize:14, fontWeight:600, marginBottom:12 }}>
          Программа курса{courseIndex ? ` · ${courseIndex.lessonCount} уроков` : ""}
        </div>
        {!courseIndex ? (
          <div style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 0",
            fontSize:12, color:"var(--color-text-secondary)" }}>
            <Loader2 size={14} style={{ animation:"spin 1s linear infinite" }}/>
            Загружаем программу…
          </div>
        ) : courseIndex.modules.map((m,i,arr) => (
          <div key={m.num} style={{
            display:"flex", alignItems:"center", gap:10, padding:"10px 0",
            borderBottom:i<arr.length-1?"0.5px solid var(--color-border-tertiary)":"none",
          }}>
            <div style={{
              width:30, height:30, borderRadius:"50%", flexShrink:0, fontSize:14,
              background:`${course.cover_color}12`,
              display:"flex", alignItems:"center", justifyContent:"center",
            }}>{m.icon}</div>
            <span style={{ flex:1, fontSize:13 }}>
              Модуль {m.num}. {m.title}
            </span>
            {m.num === 1 && !fullAccess && <Badge color="#10b981">Урок 1.1 бесплатно</Badge>}
            <span style={{ fontSize:11, color:"var(--color-text-secondary)" }}>
              {m.lessons.filter(l=>!l.isSummary).length} ур.
            </span>
          </div>
        ))}
      </div>
    )}
  </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   КАБИНЕТ УЧЕНИКА (реальные курсы из Supabase)
   ═══════════════════════════════════════════════════════════════════ */

const StudentCabinet = ({ user, profile, catalog, unread, onCatalog, onStudy, onMedal, onMessages, onExams, onEssays, onScores, onSupport, onReviews, onReferral }) => {
  const [myCourses, setMyCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [medal, setMedal] = useState(null);
  const [pendingEssays, setPendingEssays] = useState(0);
  const author = isOwner(user, profile);
  const glass = "backdrop-blur-xl bg-white/65 dark:bg-zinc-900/55 ring-1 ring-black/[0.04] dark:ring-white/10 shadow-[0_14px_40px_-14px_rgba(20,20,45,0.22)]";
  const lift = "transition duration-300 hover:-translate-y-1 hover:shadow-[0_22px_50px_-16px_rgba(20,20,45,0.28)]";

  useEffect(() => {
    if (!user) return;
    supabase
      .from("student_profiles")
      .select("medal_data")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setMedal(computeMedal(data?.medal_data)))
      .catch(() => setMedal(computeMedal(null)));
  }, [user]);

  useEffect(() => {
    if (!author) return;
    supabase.from("essay_reviews")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .then(({ count }) => setPendingEssays(count || 0))
      .catch(() => {});
  }, [author]);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    // Владелец/автор видит все свои курсы с контентом — без записи доступа
    if (isOwner(user, profile)) {
      setMyCourses(catalog.filter(c => getContentId(c)));
      setLoading(false);
      return;
    }
    // Купленные курсы: записи course_access (RLS отдаёт только свои)
    supabase
      .from("course_access")
      .select("course_slug")
      .then(({ data, error }) => {
        if (!error && data) {
          const owned = data
            .map(a => catalog.find(c => getContentId(c) === a.course_slug))
            .filter(Boolean);
          setMyCourses(owned);
        }
        setLoading(false);
      });
  }, [user, profile, catalog]);

  return (
    <div className="flex flex-col gap-3 rounded-3xl bg-gradient-to-b from-[#e11d48]/[0.05] via-transparent to-[#6366f1]/[0.05]">
      <div className={`${glass} rounded-3xl p-[18px]`}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-[50px] h-[50px] rounded-full shrink-0 flex items-center justify-center text-white text-lg font-bold
            bg-gradient-to-br from-[#1d1b3a] to-[#3b2c5e] shadow-[0_6px_16px_rgba(20,16,45,0.3)]">
            {initialsOf(profile?.full_name || user?.email || "")}
          </div>
          <div>
            <div className="pf-serif text-[19px] text-zinc-900 dark:text-zinc-100">{profile?.full_name || "Ученик"}</div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">{user?.email || ""}</div>
          </div>
        </div>

        <div onClick={onMedal} className="cursor-pointer rounded-2xl p-3 mb-3 ring-1 ring-amber-500/30
          bg-gradient-to-br from-amber-500/[0.12] to-orange-500/[0.06]">
          <div className="flex items-center gap-2.5">
            <Medal size={22} className="text-amber-500 shrink-0"/>
            <div className="flex-1">
              <div className="text-[13px] font-semibold mb-1 text-zinc-900 dark:text-zinc-100">
                {medal === null
                  ? "Путь к золотой медали"
                  : medal.filled || medal.pct > 0
                    ? `Путь к золотой медали — ${medal.pct}%`
                    : "Медальный трекер: заполни оценки →"}
              </div>
              <div className="h-1.5 rounded-full bg-amber-500/30">
                <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500"
                  style={{ width:`${medal?.pct || 0}%` }}/>
              </div>
              {medal?.threats?.length > 0 && (
                <div className="text-[10.5px] text-zinc-500 dark:text-zinc-400 mt-1">
                  ⚠️ Угроз медали: {medal.threats.length} — открой трекер
                </div>
              )}
            </div>
            <span className="text-base font-bold text-amber-500">{medal?.pct ?? "…"}%</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          {[
            { label:"Курсов",    value:myCourses.length, icon:<BookOpen size={16}/>, color:"#6366f1", onClick:onCatalog },
            { label:"Пробников", value:"скоро", icon:<FileText size={16}/>, color:"#f59e0b", onClick:onExams },
            { label:"Сообщений", value:unread > 0 ? unread : "—", icon:<MessageCircle size={16}/>, color:"#10b981", onClick:onMessages, dot:unread > 0 },
          ].map((s,i) => (
            <button key={i} onClick={s.onClick}
              className="relative rounded-2xl p-2.5 text-center text-zinc-900 dark:text-zinc-100
                bg-white/55 dark:bg-zinc-800/55 ring-1 ring-black/[0.04] dark:ring-white/10 transition hover:-translate-y-0.5 hover:bg-white/80 dark:hover:bg-zinc-800/80">
              <div className="flex justify-center mb-1" style={{ color:s.color }}>{s.icon}</div>
              <div className={`${typeof s.value === "number" ? "text-lg" : "text-sm"} font-bold leading-[22px]`}>{s.value}</div>
              <div className="text-[10px] text-zinc-500 dark:text-zinc-400">{s.label}</div>
              {s.dot && <span className="absolute top-2 right-2.5 w-2 h-2 rounded-full bg-red-500"/>}
            </button>
          ))}
        </div>
      </div>

      <button onClick={onEssays} className={`${glass} ${lift} w-full flex items-center gap-2.5 rounded-2xl px-3.5 py-3 text-left text-zinc-900 dark:text-zinc-100 border-l-[3px] border-l-[#e11d48]`}>
        <span className="text-lg">✍️</span>
        <span className="flex-1 min-w-0">
          <span className="block text-[13.5px] font-bold">{author ? "Проверка сочинений" : "Мои сочинения"}</span>
          <span className="block text-[11.5px] text-zinc-500 dark:text-zinc-400">
            {author ? "Очередь работ учеников на проверку" : "Проверка по К1–К10 и вердикт автора"}
          </span>
        </span>
        {author && pendingEssays > 0 && (
          <span className="text-[11px] font-bold text-white bg-amber-500 rounded-full px-2.5 py-0.5">{pendingEssays}</span>
        )}
        <ChevronRight size={16} className="text-zinc-400"/>
      </button>

      <div className="grid grid-cols-2 gap-2.5">
        <button onClick={onScores} className={`${glass} ${lift} flex items-center gap-2.5 rounded-2xl px-3.5 py-3 text-left text-zinc-900 dark:text-zinc-100`}>
          <span className="w-8 h-8 rounded-[9px] shrink-0 flex items-center justify-center text-base bg-emerald-500/[0.12]">📈</span>
          <span className="min-w-0">
            <span className="block text-[13px] font-bold">Трекер баллов</span>
            <span className="block text-[11px] text-zinc-500 dark:text-zinc-400">рост до/после</span>
          </span>
        </button>
        <button onClick={onSupport} className={`${glass} ${lift} flex items-center gap-2.5 rounded-2xl px-3.5 py-3 text-left text-zinc-900 dark:text-zinc-100`}>
          <span className="w-8 h-8 rounded-[9px] shrink-0 flex items-center justify-center text-base bg-indigo-500/[0.12]">🛟</span>
          <span className="min-w-0">
            <span className="block text-[13px] font-bold">Поддержка</span>
            <span className="block text-[11px] text-zinc-500 dark:text-zinc-400">FAQ и контакты</span>
          </span>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <button onClick={onReferral} className={`${glass} ${lift} flex items-center gap-2.5 rounded-2xl px-3.5 py-3 text-left text-zinc-900 dark:text-zinc-100`}>
          <span className="w-8 h-8 rounded-[9px] shrink-0 flex items-center justify-center text-base bg-rose-500/[0.12]">🎁</span>
          <span className="min-w-0">
            <span className="block text-[13px] font-bold">Пригласить друга</span>
            <span className="block text-[11px] text-zinc-500 dark:text-zinc-400">10% с покупки друга</span>
          </span>
        </button>
        <button onClick={onReviews} className={`${glass} ${lift} flex items-center gap-2.5 rounded-2xl px-3.5 py-3 text-left text-zinc-900 dark:text-zinc-100`}>
          <span className="w-8 h-8 rounded-[9px] shrink-0 flex items-center justify-center text-base bg-amber-500/[0.12]">⭐</span>
          <span className="min-w-0">
            <span className="block text-[13px] font-bold">{author ? "Отзывы" : "Оставить отзыв"}</span>
            <span className="block text-[11px] text-zinc-500 dark:text-zinc-400">{author ? "на модерацию" : "поделись мнением"}</span>
          </span>
        </button>
      </div>

      <div className={`${glass} rounded-2xl overflow-hidden`}>
        <div className="px-4 py-2.5 border-b border-black/5 dark:border-white/10 flex items-center justify-between">
          <span className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">Мои курсы</span>
          <button onClick={onCatalog}
            className="inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-xs font-bold text-white
              bg-gradient-to-br from-[#f59e0b] to-[#f97316] shadow-[0_4px_12px_rgba(249,115,22,0.35)]
              transition hover:-translate-y-0.5 hover:shadow-[0_8px_18px_rgba(249,115,22,0.45)]">
            + Найти курс
          </button>
        </div>
        {loading ? (
          <div className="text-center py-5"><Loader2 size={20} className="inline animate-spin"/></div>
        ) : myCourses.length === 0 ? (
          <div className="py-7 px-5 text-center">
            <div className="text-sm text-zinc-500 dark:text-zinc-400 mb-3">
              У тебя пока нет курсов. Начни с бесплатного урока!
            </div>
            <button onClick={onCatalog}
              className="inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-bold text-white
                bg-gradient-to-br from-[#e11d48] to-[#f97316] shadow-[0_8px_22px_rgba(225,29,72,0.35)]
                transition hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(225,29,72,0.45)]">
              Выбрать курс →
            </button>
          </div>
        ) : (
          myCourses.map((course, i) => {
            const hasContent = !!getContentId(course);
            return (
            <div key={course.id}
              onClick={hasContent ? () => onStudy(course) : undefined}
              className={`flex gap-3 items-center px-4 py-3 ${i < myCourses.length-1 ? "border-b border-black/5 dark:border-white/10" : ""} ${hasContent ? "cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.03]" : ""}`}>
              <div className="w-11 h-11 rounded-xl shrink-0 flex items-center justify-center text-[22px]"
                style={{ background:`linear-gradient(135deg,${course.cover_color || '#6366f1'}dd,${course.cover_color || '#6366f1'}88)` }}>
                {course.subject_icon || "📚"}
              </div>
              <div className="flex-1">
                <div className="text-[13px] font-medium mb-0.5 leading-tight text-zinc-900 dark:text-zinc-100">{course.title}</div>
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Автор: {course.teacher || "Кирилл Шевелев"}</div>
              </div>
              {hasContent
                ? <Badge color="#3b82f6">Учиться →</Badge>
                : <Badge color="#10b981">Куплен</Badge>}
            </div>
            );
          })
        )}
      </div>

    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   ГЛАВНЫЙ КОМПОНЕНТ ПЛАТФОРМЫ
   ═══════════════════════════════════════════════════════════════════ */

export default function Platform({ user, profile, notifications, onProfileUpdate, onNotificationRead, onLogout }) {
  const [page,       setPage]    = useState("catalog");
  const [selCourse,  setCourse]  = useState(null);
  const [catalog,    setCatalog] = useState(FALLBACK_CATALOG);
  const [ownedSlugs, setOwnedSlugs] = useState(() => new Set());
  const [freeEssayOpen, setFreeEssayOpen] = useState(false);
  const [unread,     setUnread]  = useState(0);
  const adminView = isOwner(user, profile);

  /* Каталог из БД (цены и описания меняются в Supabase без деплоя) */
  useEffect(() => {
    fetchCatalog()
      .then((rows) => { if (rows.length) setCatalog(rows); })
      .catch(() => {}); // нет таблицы/сети — остаёмся на фолбэке
  }, []);

  /* Непрочитанные сообщения (RLS отдаёт ученику свои, админу — все) */
  useEffect(() => {
    if (!user) return;
    const check = () =>
      supabase
        .from("support_messages")
        .select("id", { count: "exact", head: true })
        .eq("is_read", false)
        .eq("sender", adminView ? "student" : "owner")
        .then(({ count, error }) => { if (!error) setUnread(count || 0); });
    check();
    const t = setInterval(check, 30000);
    return () => clearInterval(t);
  }, [user, adminView, page]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = catalog;

  const openCourse = c => { setCourse(c); setPage("course"); };
  const openStudy  = c => { setCourse(c); setPage("study");  };
  const [studyKey, setStudyKey] = useState(0);

  /* Какие курсы уже куплены — чтобы на карточках показывать «Открыть», а не «Купить» */
  useEffect(() => {
    if (!user) { setOwnedSlugs(new Set()); return; }
    if (isOwner(user, profile)) {
      setOwnedSlugs(new Set(catalog.map(getContentId).filter(Boolean)));
      return;
    }
    supabase.from("course_access").select("course_slug").then(({ data, error }) => {
      if (!error) setOwnedSlugs(new Set((data || []).map(a => a.course_slug)));
    });
  }, [user, profile, catalog, studyKey]);

  /* ── Привязка реферала: если в ссылке был ?ref=, закрепляем за пользователем ── */
  useEffect(() => {
    if (!user) return;
    const code = localStorage.getItem("kirenix_ref");
    if (!code) return;
    supabase.rpc("claim_referral", { p_code: code })
      .finally(() => localStorage.removeItem("kirenix_ref"));
  }, [user]);

  /* ── Возврат с оплаты ЮKassa: ждём вебхук и открываем курс ── */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") !== "pending") return;
    window.history.replaceState({}, "", window.location.pathname);

    const paidCourse = catalog.find(c => getContentId(c));
    if (!paidCourse) return;
    setCourse(paidCourse);
    setPage("study");

    let tries = 0;
    const timer = setInterval(async () => {
      tries++;
      const ok = await checkCourseAccess(getContentId(paidCourse));
      if (ok) {
        clearInterval(timer);
        clearLessonCache();
        setStudyKey(k => k + 1);   // перерисовать курс уже с доступом
        alert("Оплата прошла! Курс открыт — приятной учёбы 🎉");
      } else if (tries >= 15) {
        clearInterval(timer);
        alert("Платёж ещё обрабатывается. Если курс не откроется за пару минут — обнови страницу.");
      }
    }, 2000);
    return () => clearInterval(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ fontFamily:"var(--font-sans)", color:"var(--color-text-primary)",
      maxWidth:800, margin:"0 auto" }}>
      <style>{`*{box-sizing:border-box;} input:focus,select:focus{outline:none;}`}</style>

      {/* Топбар */}
      <div style={{
        display:"flex", alignItems:"center", gap:10, padding:"10px 16px",
        borderBottom:"0.5px solid var(--color-border-tertiary)",
        background:"var(--color-background-primary)",
        position:"sticky", top:0, zIndex:100,
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginRight:4 }}>
          <img src="/favicon.svg" alt="Kirenix" width={24} height={24}
            style={{ borderRadius:7, display:"block" }}/>
          <div>
            <span style={{ fontSize:14, fontWeight:800, letterSpacing:"-.01em" }}>Kirenix</span>
          </div>
        </div>

        <div style={{ display:"flex", gap:4 }}>
          {[
            { id:"catalog", label:"Курс",       icon:<Home size={12}/> },
            { id:"student", label:"Мой кабинет",icon:<User size={12}/> },
          ].map(n => (
            <button key={n.id} onClick={()=>setPage(n.id)} style={{
              display:"flex", alignItems:"center", gap:4,
              padding:"5px 10px", borderRadius:99, border:"none",
              background:page===n.id
                ?"linear-gradient(135deg,#f59e0b,#f97316)"
                :"var(--color-background-secondary)",
              color:page===n.id?"#fff":"var(--color-text-secondary)",
              fontSize:11, fontWeight:page===n.id?600:400, cursor:"pointer",
            }}>
              {n.icon}{n.label}
            </button>
          ))}
        </div>

        <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:10 }}>
          <button onClick={()=>setPage("messages")} title="Сообщения"
            style={{ position:"relative", background:"none", border:"none",
            cursor:"pointer", display:"flex", color:"var(--color-text-secondary)", padding:4 }}>
            <Bell size={18}/>
            {unread > 0 && (
              <div style={{ position:"absolute", top:0, right:0, width:8, height:8,
                borderRadius:"50%", background:"#ef4444" }}/>
            )}
          </button>
          <Avatar initials={initialsOf(profile?.full_name || user?.email || "")} size={30} color="#6366f1"/>
          {/* Кнопка Выйти */}
          <button
            onClick={onLogout}
            style={{
              padding: "5px 12px",
              borderRadius: 8,
              border: "none",
              background: "#ef4444",
              color: "white",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Выйти
          </button>
        </div>
      </div>

      <div style={{ padding:"1rem" }}>

        {/* ════ КАТАЛОГ ════ */}
        {page==="catalog" && (
          <Landing
            cards={filtered.map(c => <CourseCard key={c.id} course={c} onOpen={openCourse}
              owned={ownedSlugs.has(getContentId(c))} onStudy={openStudy}/>)}
            onTryFree={() => openStudy(catalog[0])}
            onFreeEssay={() => setFreeEssayOpen(true)}
          />
        )}
        {false && (
          <div>
            <div style={{
              borderRadius:"var(--border-radius-lg)", overflow:"hidden",
              background:"linear-gradient(135deg,#3b82f6,#6366f1,#8b5cf6)",
              padding:"24px 20px", marginBottom:16, color:"#fff",
            }}>
              <div style={{ fontSize:22, fontWeight:700, marginBottom:6 }}>
                Информатика ЕГЭ 2026 💻
              </div>
              <div style={{ fontSize:13, opacity:.9, marginBottom:16, lineHeight:1.6 }}>
                Авторский курс Кирилла Шевелева: вся теория, разобранные примеры,
                практика с ответами и шпаргалки — по всем заданиям экзамена.
              </div>
              <div style={{ display:"flex", gap:16 }}>
                {[["11","Модулей"],["38","Уроков"],["27","Заданий ЕГЭ"]].map(([v,l])=>(
                  <div key={l}>
                    <div style={{ fontSize:18, fontWeight:700 }}>{v}</div>
                    <div style={{ fontSize:11, opacity:.8 }}>{l}</div>
                  </div>
                ))}
              </div>
              <div style={{ display:"flex", gap:10, marginTop:18, flexWrap:"wrap" }}>
                <button onClick={()=>openStudy(catalog[0])} style={{
                  display:"flex", alignItems:"center", gap:7, padding:"11px 18px",
                  borderRadius:"var(--border-radius-md)", border:"none",
                  background:"#fff", color:"#3b82f6", fontSize:13, fontWeight:700,
                  cursor:"pointer", boxShadow:"0 4px 14px rgba(0,0,0,.15)",
                }}>
                  <Play size={15}/> Попробовать бесплатный урок
                </button>
                <button onClick={()=>openCourse(catalog[0])} style={{
                  display:"flex", alignItems:"center", gap:7, padding:"11px 18px",
                  borderRadius:"var(--border-radius-md)",
                  border:"1.5px solid rgba(255,255,255,.7)", background:"transparent",
                  color:"#fff", fontSize:13, fontWeight:600, cursor:"pointer",
                }}>
                  Подробнее о курсе <ChevronRight size={14}/>
                </button>
              </div>
            </div>

            {/* ── Что внутри курса ── */}
            <div style={{ ...card(), padding:"18px 20px", marginBottom:16 }}>
              <div style={{ fontSize:15, fontWeight:700, marginBottom:12 }}>
                Что внутри каждого урока
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(240px,1fr))", gap:10 }}>
                {[
                  ["📖","Подробная теория","с выводом всех формул — не «запомни», а «пойми»"],
                  ["💡","6–10 разобранных примеров","на каждый тип задания, с полным решением"],
                  ["✍️","Практика с ответами","15–20 задач на урок, чтобы закрепить"],
                  ["📝","Шпаргалка и типичные ошибки","краткая выжимка для повторения перед экзаменом"],
                  ["🐍","Рабочий Python-код","проверяй свои решения программой, как на ЕГЭ"],
                  ["🧠","Изменения 2026 учтены","Машина Тьюринга (зад. 12), «максимум» в зад. 22 — по ФИПИ"],
                ].map(([icon,t,d]) => (
                  <div key={t} style={{ display:"flex", gap:10 }}>
                    <span style={{ fontSize:18, flexShrink:0 }}>{icon}</span>
                    <div>
                      <div style={{ fontSize:12.5, fontWeight:600 }}>{t}</div>
                      <div style={{ fontSize:11.5, color:"var(--color-text-secondary)", lineHeight:1.5 }}>{d}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Карточка курса ── */}
            <div style={{
              display:"grid",
              gridTemplateColumns:"repeat(auto-fill, minmax(220px, 1fr))",
              gap:14, marginBottom:16,
            }}>
              {filtered.map(c => (
                <CourseCard key={c.id} course={c} onOpen={openCourse}/>
              ))}
            </div>

            {/* ── Об авторе ── */}
            <div style={{ ...card(), padding:"18px 20px", marginBottom:16,
              display:"flex", gap:14, alignItems:"flex-start" }}>
              <Avatar initials="КШ" size={52} color="#3b82f6"/>
              <div>
                <div style={{ fontSize:14, fontWeight:700, marginBottom:2 }}>Кирилл Шевелев</div>
                <div style={{ fontSize:11.5, color:"var(--color-text-secondary)", marginBottom:8 }}>
                  Автор и единственный преподаватель курса
                </div>
                <div style={{ fontSize:12.5, lineHeight:1.65 }}>
                  Курс написан лично, без копирования чужих материалов: каждый числовой
                  ответ и каждый пример проверены программно на Python. Формат каждого
                  урока одинаковый и честный: теория с выводом формул → разобранные
                  примеры → практика с ответами → шпаргалка → типичные ошибки.
                </div>
              </div>
            </div>

            {/* ── FAQ ── */}
            <div style={{ ...card(), padding:"18px 20px", marginBottom:16 }}>
              <div style={{ fontSize:15, fontWeight:700, marginBottom:10 }}>Частые вопросы</div>
              {[
                ["Как проходит обучение?","Текстовые уроки: теория, разобранные примеры, практика с ответами. Учишься в своём темпе, прогресс отмечается прямо в курсе."],
                ["Подойдёт ли мне, если начинаю с нуля?","Да. Первые модули стартуют с базовых понятий, Python разбирается с нуля в модуле 3."],
                ["Сколько действует доступ?","Бессрочно — включая все будущие обновления курса."],
                ["Что произойдёт после оплаты?","Доступ откроется автоматически примерно за минуту, курс появится в «Моём кабинете». Оплата через ЮKassa."],
                ["Можно ли вернуть деньги?","Да, по публичной оферте: в течение 14 дней до получения доступа — полностью, после начала обучения — пропорционально непройденным материалам."],
                ["Курс точно актуален для ЕГЭ 2026?","Да: структура из 27 заданий, Машина Тьюринга в задании 12 и «максимум» в задании 22 — сверено с документами ФИПИ 2026."],
              ].map(([q,a]) => (
                <details key={q} style={{ borderBottom:"0.5px solid var(--color-border-tertiary)", padding:"8px 0" }}>
                  <summary style={{ fontSize:13, fontWeight:600, cursor:"pointer" }}>{q}</summary>
                  <div style={{ fontSize:12.5, color:"var(--color-text-secondary)", lineHeight:1.65, padding:"6px 0 2px" }}>{a}</div>
                </details>
              ))}
            </div>

            {/* ── Финальный CTA ── */}
            <div style={{ ...card(), padding:"24px 20px", textAlign:"center",
              background:"linear-gradient(135deg,#3b82f615,transparent)",
              borderLeft:"4px solid #3b82f6" }}>
              <div style={{ fontSize:16, fontWeight:700, marginBottom:6 }}>
                Начни с бесплатного урока — прямо сейчас
              </div>
              <div style={{ fontSize:12.5, color:"var(--color-text-secondary)", marginBottom:14 }}>
                Урок 1.1 «Системы счисления» открыт для всех. Понравится — полный курс за {(catalog[0]?.price ?? 5200).toLocaleString()} ₽.
              </div>
              <div style={{ display:"flex", gap:10, justifyContent:"center", flexWrap:"wrap" }}>
                <button onClick={()=>openStudy(catalog[0])} style={{
                  display:"flex", alignItems:"center", gap:7, padding:"11px 20px",
                  borderRadius:"var(--border-radius-md)", border:"none",
                  background:"linear-gradient(135deg,#3b82f6,#6366f1)", color:"#fff",
                  fontSize:13, fontWeight:700, cursor:"pointer",
                  boxShadow:"0 4px 14px rgba(59,130,246,.35)",
                }}>
                  <Play size={15}/> Открыть бесплатный урок
                </button>
                <button onClick={()=>openCourse(catalog[0])} style={{
                  display:"flex", alignItems:"center", gap:7, padding:"11px 20px",
                  borderRadius:"var(--border-radius-md)",
                  border:"1px solid #3b82f6", background:"transparent",
                  color:"#3b82f6", fontSize:13, fontWeight:600, cursor:"pointer",
                }}>
                  <ShoppingCart size={15}/> Купить за {(catalog[0]?.price ?? 5200).toLocaleString()} ₽
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ════ СТРАНИЦА КУРСА ════ */}
        {page==="course" && selCourse && (
          <CoursePage
            course={selCourse}
            onBack={()=>setPage("catalog")}
            onMessages={()=>setPage("messages")}
            onStudy={openStudy}
            user={user}      // <-- для покупки и проверки доступа
            profile={profile} // <-- для проверки владельца
          />
        )}

        {/* ════ ПРОХОЖДЕНИЕ КУРСА (контент из БД, под RLS) ════ */}
        {page==="study" && selCourse && getContentId(selCourse) && (
          <CourseStudy
            key={studyKey}
            contentId={getContentId(selCourse)}
            user={user}
            price={selCourse.price}
            onBack={()=>setPage(catalog.some(c=>c.id===selCourse.id) ? "course" : "student")}
          />
        )}

        {/* ════ КАБИНЕТ УЧЕНИКА ════ */}
        {page==="student" && (
          <StudentCabinet user={user} profile={profile} catalog={catalog} unread={unread}
            onCatalog={()=>setPage("catalog")}
            onStudy={openStudy} onMedal={()=>setPage("medal")}
            onMessages={()=>setPage("messages")} onExams={()=>setPage("exams")}
            onEssays={()=>setPage("essays")} onScores={()=>setPage("scores")}
            onSupport={()=>setPage("support")}
            onReviews={()=>setPage("reviews")} onReferral={()=>setPage("referral")} />
        )}

        {/* ════ МЕДАЛЬНЫЙ ТРЕКЕР ════ */}
        {page==="medal" && (
          <MedalTracker user={user} onBack={()=>setPage("student")} />
        )}

        {/* ════ СООБЩЕНИЯ ════ */}
        {page==="messages" && (
          <Messages user={user} profile={profile} isAdmin={adminView}
            onBack={()=>setPage("student")} />
        )}

        {/* ════ ПРОБНИКИ ════ */}
        {page==="exams" && (
          <Exams onBack={()=>setPage("student")}
            onOpenCourse={()=>{ const c = catalog.find(x=>getContentId(x)); if (c) openStudy(c); }} />
        )}

        {/* ════ ПРОВЕРКА СОЧИНЕНИЙ (автор в петле) ════ */}
        {page==="essays" && (
          <EssayReviews isAdmin={adminView} accent="#e11d48" onBack={()=>setPage("student")} />
        )}

        {/* ════ ТРЕКЕР БАЛЛОВ ════ */}
        {page==="scores" && (
          <ScoreTracker user={user} accent="#e11d48" onBack={()=>setPage("student")} />
        )}

        {/* ════ ПОДДЕРЖКА ════ */}
        {page==="support" && (
          <Support accent="#e11d48" onMessages={()=>setPage("messages")} onBack={()=>setPage("student")} />
        )}

        {/* ════ ОТЗЫВЫ ════ */}
        {page==="reviews" && (
          <Reviews user={user} profile={profile} isAdmin={adminView} onBack={()=>setPage("student")} />
        )}

        {/* ════ РЕФЕРАЛКА ════ */}
        {page==="referral" && (
          <Referral isAdmin={adminView} onBack={()=>setPage("student")} />
        )}
      </div>

      {/* Бесплатная проверка сочинения (лид-магнит) */}
      {freeEssayOpen && (
        <EssayChecker free accent="#e11d48" onClose={()=>setFreeEssayOpen(false)} />
      )}
    </div>
  );
}