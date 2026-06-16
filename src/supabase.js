// ═══════════════════════════════════════════════════════════════════
//  supabase.js — единственный файл для работы с базой данных
//
//  КАК НАСТРОИТЬ:
//  1. Зайди на supabase.com → создай проект
//  2. Зайди в Settings → API
//  3. Скопируй "Project URL" и "anon public key"
//  4. Вставь ниже вместо заглушек
//  5. Создай файл .env.local в корне проекта:
//     VITE_SUPABASE_URL=https://xxxxxx.supabase.co
//     VITE_SUPABASE_ANON_KEY=eyJxxxxxx...
// ═══════════════════════════════════════════════════════════════════

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  || "https://bgidvsfjnpitiosiwjar.supabase.co";
// Publishable-ключ (новая система ключей Supabase). Публичный — безопасен
// в браузере, доступ к данным ограничивает RLS.
const SUPABASE_KEY  = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_LixS-P-ezh8iceSn5lSrfw_baXs94rO";

// Cloudflare-фильтр РКН в РФ иногда рвёт/тормозит соединение к Supabase
// (ERR_CONNECTION_RESET / 20+ сек). Делаем fetch с таймаутом и авто-повтором —
// часто проходит со 2–3 попытки (как при ручном повторе), а не висит вечно.
const fetchWithRetry = async (input, init = {}, attempts = 3) => {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    try {
      return await fetch(input, { ...init, signal: init.signal ?? ctrl.signal });
    } catch (e) {
      lastErr = e;
      if (init.signal?.aborted) throw e;            // отмена приложением — не повторяем
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 700 * (i + 1)));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr;
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    // Хранить сессию в localStorage — пользователь остаётся залогинен между сессиями
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    // Realtime для чата и уведомлений
    params: { eventsPerSecond: 10 },
  },
  global: { fetch: fetchWithRetry },
});

// ═══════════════════════════════════════════════════════════════════
//  AUTH — Авторизация
// ═══════════════════════════════════════════════════════════════════

/**
 * Регистрация нового пользователя.
 * role: 'student' | 'teacher' | 'school'
 */
export const signUp = async ({ email, password, fullName, role }) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Эти данные попадут в триггер и создадут профиль автоматически
      data: { full_name: fullName, role },
    },
  });
  return { data, error };
};

/**
 * Вход по email + пароль
 */
export const signIn = async ({ email, password }) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { data, error };
};

// Вход через Google (OAuth) удалён в целях соответствия 149-ФЗ:
// иностранные средства авторизации (Google/Apple ID) для пользователей в РФ
// запрещены. Авторизация — по email и паролю или по номеру телефона (SMS-код).

/** Нормализация телефона в формат +7XXXXXXXXXX */
export const normalizePhone = (raw) => {
  let d = (raw || "").replace(/\D/g, "");
  if (d.length === 11 && (d[0] === "8" || d[0] === "7")) d = "7" + d.slice(1);
  else if (d.length === 10) d = "7" + d;
  return "+" + d;
};

/** Отправить одноразовый код по SMS (вход/регистрация по телефону).
 *  Требует включённого Phone-провайдера и Send SMS Hook в Supabase (см. SETUP_PHONE_AUTH.md). */
export const sendPhoneCode = async (phone, fullName) => {
  const { data, error } = await supabase.auth.signInWithOtp({
    phone: normalizePhone(phone),
    options: fullName ? { data: { full_name: fullName, role: "student" } } : undefined,
  });
  return { data, error };
};

/** Проверить код из SMS и войти */
export const verifyPhoneCode = async (phone, token) => {
  const { data, error } = await supabase.auth.verifyOtp({
    phone: normalizePhone(phone), token: token.trim(), type: "sms",
  });
  return { data, error };
};

/**
 * Выход из аккаунта
 */
export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  return { error };
};

/**
 * Получить текущего залогиненного пользователя
 */
export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

/**
 * Подписаться на изменения сессии (логин/логаут)
 * Используй в корневом компоненте App
 */
export const onAuthChange = (callback) => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(callback);
  return subscription; // вызови subscription.unsubscribe() при размонтировании
};

// ═══════════════════════════════════════════════════════════════════
//  PROFILES — Профили пользователей
// ═══════════════════════════════════════════════════════════════════

/**
 * Получить профиль по ID пользователя.
 * Возвращает profile + role-специфичные поля.
 */
export const getProfile = async (userId) => {
  const { data, error } = await supabase
    .from("profiles")
    .select(`
      *,
      student_profiles(*),
      teacher_profiles(*),
      school_profiles(*)
    `)
    .eq("id", userId)
    .single();
  return { data, error };
};

/**
 * Обновить профиль пользователя
 */
export const updateProfile = async (userId, updates) => {
  const { data, error } = await supabase
    .from("profiles")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", userId)
    .select()
    .single();
  return { data, error };
};

/**
 * Обновить профиль ученика (оценки медального трекера)
 */
export const updateStudentProfile = async (userId, updates) => {
  const { data, error } = await supabase
    .from("student_profiles")
    .upsert({ id: userId, ...updates, updated_at: new Date().toISOString() })
    .select()
    .single();
  return { data, error };
};

/**
 * Обновить профиль учителя
 */
export const updateTeacherProfile = async (userId, updates) => {
  const { data, error } = await supabase
    .from("teacher_profiles")
    .upsert({ id: userId, ...updates, updated_at: new Date().toISOString() })
    .select()
    .single();
  return { data, error };
};

// ═══════════════════════════════════════════════════════════════════
//  COURSES — Курсы
// ═══════════════════════════════════════════════════════════════════

/**
 * Получить список курсов с фильтрами.
 * subjectId: ID предмета (null = все)
 * search: поисковая строка
 * limit: количество курсов
 */
export const getCourses = async ({ subjectId = null, search = "", limit = 20, offset = 0 } = {}) => {
  let query = supabase
    .from("courses")
    .select(`
      *,
      subjects(name, icon, color),
      profiles!author_id(full_name, avatar_url),
      teacher_profiles!inner(rating)
    `)
    .eq("is_published", true)
    .order("is_featured", { ascending: false })
    .order("students_count", { ascending: false })
    .range(offset, offset + limit - 1);

  if (subjectId)  query = query.eq("subject_id", subjectId);
  if (search)     query = query.ilike("title", `%${search}%`);

  const { data, error } = await query;
  return { data, error };
};

/**
 * Получить один курс со всеми уроками
 */
export const getCourse = async (courseId) => {
  const { data, error } = await supabase
    .from("courses")
    .select(`
      *,
      subjects(name, icon, color),
      profiles!author_id(id, full_name, avatar_url),
      teacher_profiles!inner(rating, reviews_count, students_count, experience_yrs),
      lessons(id, title, type, is_free, order_index, duration_sec)
    `)
    .eq("id", courseId)
    .eq("is_published", true)
    .order("order_index", { foreignTable: "lessons" })
    .single();
  return { data, error };
};

/**
 * Создать новый курс (для учителя/школы)
 */
export const createCourse = async (courseData) => {
  const user = await getCurrentUser();
  const { data, error } = await supabase
    .from("courses")
    .insert({ ...courseData, author_id: user.id })
    .select()
    .single();
  return { data, error };
};

/**
 * Обновить курс
 */
export const updateCourse = async (courseId, updates) => {
  const { data, error } = await supabase
    .from("courses")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", courseId)
    .select()
    .single();
  return { data, error };
};

/**
 * Получить курсы конкретного учителя/школы
 */
export const getTeacherCourses = async (teacherId) => {
  const { data, error } = await supabase
    .from("courses")
    .select("*, subjects(name, icon)")
    .eq("author_id", teacherId)
    .order("created_at", { ascending: false });
  return { data, error };
};

// ═══════════════════════════════════════════════════════════════════
//  ENROLLMENTS — Записи на курсы
// ═══════════════════════════════════════════════════════════════════

/**
 * Записать ученика на курс (после оплаты или если бесплатный)
 */
export const enrollCourse = async (courseId, orderId = null) => {
  const user = await getCurrentUser();
  const { data, error } = await supabase
    .from("enrollments")
    .insert({ student_id: user.id, course_id: courseId, order_id: orderId })
    .select()
    .single();
  return { data, error };
};

/**
 * Получить все курсы ученика с прогрессом
 */
export const getStudentCourses = async (studentId) => {
  const { data, error } = await supabase
    .from("enrollments")
    .select(`
      *,
      courses(
        id, title, cover_url, cover_color,
        subjects(name, icon),
        profiles!author_id(full_name)
      )
    `)
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });
  return { data, error };
};

/**
 * Проверить, записан ли ученик на курс
 */
export const checkEnrollment = async (courseId) => {
  const user = await getCurrentUser();
  if (!user) return { enrolled: false };
  const { data } = await supabase
    .from("enrollments")
    .select("id")
    .eq("student_id", user.id)
    .eq("course_id", courseId)
    .single();
  return { enrolled: !!data };
};

/**
 * Отметить урок как пройденный
 */
export const completeLesson = async (lessonId) => {
  const user = await getCurrentUser();
  const { data, error } = await supabase
    .from("lesson_progress")
    .upsert({
      student_id: user.id,
      lesson_id: lessonId,
      is_completed: true,
      completed_at: new Date().toISOString(),
    })
    .select()
    .single();
  return { data, error };
};

/**
 * Получить прогресс ученика по всем урокам курса
 */
export const getLessonProgress = async (courseId) => {
  const user = await getCurrentUser();
  const { data, error } = await supabase
    .from("lesson_progress")
    .select("lesson_id, is_completed, watch_sec")
    .eq("student_id", user.id)
    .in("lesson_id",
      supabase.from("lessons").select("id").eq("course_id", courseId)
    );
  return { data, error };
};

// ═══════════════════════════════════════════════════════════════════
//  MOCK EXAMS — Пробники
// ═══════════════════════════════════════════════════════════════════

/**
 * Получить список пробников по предмету
 */
export const getMockExams = async (subjectId = null) => {
  let query = supabase
    .from("mock_exams")
    .select(`
      *,
      subjects(name, icon),
      profiles!author_id(full_name)
    `)
    .eq("is_published", true)
    .order("created_at", { ascending: false });

  if (subjectId) query = query.eq("subject_id", subjectId);

  const { data, error } = await query;
  return { data, error };
};

/**
 * Начать попытку пробника
 */
export const startExamAttempt = async (examId) => {
  const user = await getCurrentUser();
  const { data, error } = await supabase
    .from("exam_attempts")
    .insert({ student_id: user.id, exam_id: examId, status: "in_progress" })
    .select()
    .single();
  return { data, error };
};

/**
 * Сдать пробник (отправить ответы)
 */
export const submitExamAttempt = async (attemptId, answers, timeSpentSec) => {
  const { data, error } = await supabase
    .from("exam_attempts")
    .update({
      answers,
      time_spent_sec: timeSpentSec,
      status: "submitted",
      submitted_at: new Date().toISOString(),
    })
    .eq("id", attemptId)
    .select()
    .single();
  return { data, error };
};

// ═══════════════════════════════════════════════════════════════════
//  CHAT — Realtime чат
// ═══════════════════════════════════════════════════════════════════

/**
 * Получить или создать диалог между учеником и учителем
 */
export const getOrCreateConversation = async ({ teacherId, courseId }) => {
  const user = await getCurrentUser();

  // Ищем существующий диалог
  const { data: existing } = await supabase
    .from("conversations")
    .select("*")
    .eq("student_id", user.id)
    .eq("teacher_id", teacherId)
    .eq("course_id", courseId)
    .single();

  if (existing) return { data: existing, error: null };

  // Создаём новый
  const { data, error } = await supabase
    .from("conversations")
    .insert({ student_id: user.id, teacher_id: teacherId, course_id: courseId })
    .select()
    .single();

  return { data, error };
};

/**
 * Получить список всех диалогов пользователя
 */
export const getConversations = async () => {
  const user = await getCurrentUser();
  const { data, error } = await supabase
    .from("conversations")
    .select(`
      *,
      courses(title),
      student:profiles!student_id(full_name, avatar_url),
      teacher:profiles!teacher_id(full_name, avatar_url)
    `)
    .or(`student_id.eq.${user.id},teacher_id.eq.${user.id}`)
    .order("last_msg_at", { ascending: false });
  return { data, error };
};

/**
 * Получить сообщения диалога
 */
export const getMessages = async (conversationId, limit = 50) => {
  const { data, error } = await supabase
    .from("messages")
    .select(`
      *,
      profiles!sender_id(full_name, avatar_url)
    `)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return { data: data?.reverse(), error };
};

/**
 * Отправить сообщение
 */
export const sendMessage = async (conversationId, text, attachments = []) => {
  const user = await getCurrentUser();
  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      text,
      attachments,
    })
    .select()
    .single();
  return { data, error };
};

/**
 * Подписаться на новые сообщения в диалоге (Realtime)
 *
 * Использование:
 *   const sub = subscribeToMessages(convId, (msg) => setMessages(p => [...p, msg]));
 *   // При размонтировании:
 *   supabase.removeChannel(sub);
 */
export const subscribeToMessages = (conversationId, onMessage) => {
  return supabase
    .channel(`messages:${conversationId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => onMessage(payload.new)
    )
    .subscribe();
};

/**
 * Пометить сообщения как прочитанные
 */
export const markMessagesRead = async (conversationId) => {
  const user = await getCurrentUser();
  await supabase
    .from("messages")
    .update({ is_read: true })
    .eq("conversation_id", conversationId)
    .neq("sender_id", user.id);

  // Сбрасываем счётчик непрочитанных
  const profile = await getProfile(user.id);
  const isStudent = profile.data?.role === "student";
  await supabase
    .from("conversations")
    .update(isStudent ? { student_unread: 0 } : { teacher_unread: 0 })
    .eq("id", conversationId);
};

// ═══════════════════════════════════════════════════════════════════
//  NOTIFICATIONS — Уведомления
// ═══════════════════════════════════════════════════════════════════

/**
 * Получить уведомления текущего пользователя
 */
export const getNotifications = async (limit = 20) => {
  const user = await getCurrentUser();
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);
  return { data, error };
};

/**
 * Пометить уведомление прочитанным
 */
export const readNotification = async (notificationId) => {
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId);
  return { error };
};

/**
 * Пометить все уведомления прочитанными
 */
export const readAllNotifications = async () => {
  const user = await getCurrentUser();
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", user.id)
    .eq("is_read", false);
  return { error };
};

/**
 * Подписаться на новые уведомления (Realtime)
 */
export const subscribeToNotifications = (userId, onNotification) => {
  return supabase
    .channel(`notifications:${userId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${userId}`,
      },
      (payload) => onNotification(payload.new)
    )
    .subscribe();
};

// ═══════════════════════════════════════════════════════════════════
//  REVIEWS — Отзывы
// ═══════════════════════════════════════════════════════════════════

/**
 * Оставить отзыв на курс
 */
export const createReview = async (courseId, { rating, text }) => {
  const user = await getCurrentUser();

  // Проверяем что ученик записан на курс
  const { enrolled } = await checkEnrollment(courseId);
  if (!enrolled) return { error: { message: "Вы не записаны на этот курс" } };

  const { data, error } = await supabase
    .from("reviews")
    .insert({
      student_id: user.id,
      course_id: courseId,
      rating,
      text,
      is_verified: true, // verified потому что проверили запись выше
    })
    .select()
    .single();
  return { data, error };
};

/**
 * Получить отзывы курса
 */
export const getCourseReviews = async (courseId, limit = 10) => {
  const { data, error } = await supabase
    .from("reviews")
    .select(`
      *,
      profiles!student_id(full_name, avatar_url)
    `)
    .eq("course_id", courseId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return { data, error };
};

// ═══════════════════════════════════════════════════════════════════
//  ORDERS — Оплата (ЮKassa)
// ═══════════════════════════════════════════════════════════════════

/**
 * Создать заказ перед оплатой.
 * После создания — редиректим на ЮKassa.
 * После оплаты — ЮKassa вызывает webhook, который создаёт enrollment.
 *
 * В продакшне webhook обрабатывается в Supabase Edge Functions:
 *   supabase/functions/yookassa-webhook/index.ts
 */
export const createOrder = async (courseId, amount) => {
  const user = await getCurrentUser();
  const { data, error } = await supabase
    .from("orders")
    .insert({
      student_id: user.id,
      course_id: courseId,
      amount,
      status: "pending",
    })
    .select()
    .single();
  return { data, error };
};

// ═══════════════════════════════════════════════════════════════════
//  STORAGE — Загрузка файлов
// ═══════════════════════════════════════════════════════════════════

/**
 * Загрузить аватар пользователя.
 * file: объект File из input[type=file]
 * Возвращает публичный URL картинки.
 */
export const uploadAvatar = async (file) => {
  const user = await getCurrentUser();
  const ext  = file.name.split(".").pop();
  const path = `avatars/${user.id}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true });

  if (uploadError) return { url: null, error: uploadError };

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return { url: data.publicUrl, error: null };
};

/**
 * Загрузить обложку курса
 */
export const uploadCourseCover = async (courseId, file) => {
  const ext  = file.name.split(".").pop();
  const path = `covers/${courseId}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("course-covers")
    .upload(path, file, { upsert: true });

  if (uploadError) return { url: null, error: uploadError };

  const { data } = supabase.storage.from("course-covers").getPublicUrl(path);
  return { url: data.publicUrl, error: null };
};

/**
 * Загрузить файл-вложение в чат
 */
export const uploadAttachment = async (file) => {
  const user = await getCurrentUser();
  const path = `attachments/${user.id}/${Date.now()}_${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from("chat-attachments")
    .upload(path, file);

  if (uploadError) return { url: null, error: uploadError };

  const { data } = supabase.storage.from("chat-attachments").getPublicUrl(path);
  return { url: data.publicUrl, name: file.name, size: file.size, error: null };
};

// ═══════════════════════════════════════════════════════════════════
//  STATS — Статистика для учителя/школы
// ═══════════════════════════════════════════════════════════════════

/**
 * Получить статистику учителя за текущий месяц
 */
export const getTeacherStats = async (teacherId) => {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  // Считаем доход за месяц (оплаченные заказы)
  const { data: orders } = await supabase
    .from("orders")
    .select("amount, commission")
    .eq("status", "paid")
    .gte("paid_at", monthStart.toISOString())
    .in("course_id",
      supabase.from("courses").select("id").eq("author_id", teacherId)
    );

  const monthRevenue = orders?.reduce((sum, o) => sum + o.amount - (o.commission || 0), 0) || 0;

  // Общее число учеников
  const { count: totalStudents } = await supabase
    .from("enrollments")
    .select("*", { count: "exact", head: true })
    .in("course_id",
      supabase.from("courses").select("id").eq("author_id", teacherId)
    );

  // Непрочитанные сообщения
  const { count: unreadMessages } = await supabase
    .from("conversations")
    .select("*", { count: "exact", head: true })
    .eq("teacher_id", teacherId)
    .gt("teacher_unread", 0);

  return {
    monthRevenue,
    totalStudents: totalStudents || 0,
    unreadMessages: unreadMessages || 0,
  };
};