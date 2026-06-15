// ═══════════════════════════════════════════════════════════════════
//  AuthScreen.jsx — Экраны входа и регистрации
//
//  Использование в App.jsx:
//    import AuthScreen from "./AuthScreen";
//    if (!user) return <AuthScreen onAuth={setUser}/>;
// ═══════════════════════════════════════════════════════════════════

import { useState } from "react";
import {
  Mail, Lock, User, Phone,
  ArrowRight, Eye, EyeOff, Loader2, AlertCircle, CheckCircle,
} from "lucide-react";
import { signIn, signUp, sendPhoneCode, verifyPhoneCode } from "./supabase";

/* ─── Стили ──────────────────────────────────────────────────────── */

const inp = (error) => ({
  width: "100%", boxSizing: "border-box",
  padding: "11px 14px 11px 40px",
  fontSize: 14, borderRadius: 10,
  border: `1px solid ${error ? "#ef4444" : "var(--color-border-secondary)"}`,
  background: "var(--color-background-secondary)",
  color: "var(--color-text-primary)",
  outline: "none", transition: "border .2s",
});

const Label = ({ children }) => (
  <div style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: 6 }}>
    {children}
  </div>
);

const Field = ({ icon: Icon, type = "text", placeholder, value, onChange, error, right }) => (
  <div style={{ position: "relative", marginBottom: error ? 4 : 14 }}>
    <Icon size={16} style={{
      position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)",
      color: "var(--color-text-secondary)",
    }}/>
    <input type={type} placeholder={placeholder} value={value}
      onChange={e => onChange(e.target.value)}
      style={inp(error)}/>
    {right && (
      <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)" }}>
        {right}
      </div>
    )}
  </div>
);

const ErrorMsg = ({ msg }) => msg ? (
  <div style={{ display: "flex", alignItems: "center", gap: 6,
    fontSize: 12, color: "#ef4444", marginBottom: 10 }}>
    <AlertCircle size={13}/> {msg}
  </div>
) : null;

/* ─── Кнопка ─────────────────────────────────────────────────────── */

const Btn = ({ children, onClick, disabled, loading, variant = "primary" }) => (
  <button onClick={onClick} disabled={disabled || loading} style={{
    width: "100%", padding: "13px 0",
    borderRadius: 10, border: variant === "outline"
      ? "1px solid var(--color-border-secondary)" : "none",
    background: variant === "outline"
      ? "transparent"
      : disabled || loading
        ? "var(--color-border-secondary)"
        : "linear-gradient(135deg,#f59e0b,#f97316)",
    boxShadow: variant !== "outline" && !disabled ? "0 4px 14px rgba(249,115,22,.35)" : "none",
    color: variant === "outline" ? "var(--color-text-primary)" : "#fff",
    fontSize: 14, fontWeight: 600,
    cursor: disabled || loading ? "not-allowed" : "pointer",
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    transition: "transform .2s",
    marginBottom: 10,
  }}>
    {loading
      ? <Loader2 size={17} style={{ animation: "spin 1s linear infinite" }}/>
      : children}
  </button>
);

/* ─── Выбор роли ─────────────────────────────────────────────────── */

/* Регистрируются только ученики — роль фиксированная ("student"):
   курс авторский, услуги оказывает лично самозанятый Кирилл Шевелев. */

/* ═══════════════════════════════════════════════════════════════════
   ГЛАВНЫЙ КОМПОНЕНТ AuthScreen
   ═══════════════════════════════════════════════════════════════════ */

/* Вход по телефону выключен (SMS платные). Чтобы включить: поставь true
   и настрой SMS.RU + Send SMS Hook по SETUP_PHONE_AUTH.md. */
const PHONE_AUTH_ENABLED = false;

export default function AuthScreen({ onAuth }) {
  // mode: "login" | "register" | "role"
  const [mode,     setMode]    = useState("login");
  const [role]                 = useState("student");
  const [name,     setName]    = useState("");
  const [email,    setEmail]   = useState("");
  const [password, setPass]    = useState("");
  const [passShow, setPassShow]= useState(false);
  const [loading,  setLoading] = useState(false);
  const [error,    setError]   = useState("");
  const [success,  setSuccess] = useState("");
  // Вход по телефону (российский способ авторизации)
  const [method,    setMethod]    = useState(PHONE_AUTH_ENABLED ? "phone" : "email"); // "phone" | "email"
  const [phone,     setPhone]     = useState("");
  const [code,      setCode]      = useState("");
  const [phoneStep, setPhoneStep] = useState("enter"); // "enter" | "code"

  const reset = () => { setError(""); setSuccess(""); };

  /* ── Телефон: отправка кода ── */
  const handleSendCode = async () => {
    if (phone.replace(/\D/g, "").length < 10) { setError("Введи корректный номер телефона"); return; }
    setLoading(true); reset();
    const { error } = await sendPhoneCode(phone, mode === "register" ? name.trim() : undefined);
    setLoading(false);
    if (error) { setError(error.message || "Не удалось отправить код"); return; }
    setPhoneStep("code");
  };

  /* ── Телефон: проверка кода ── */
  const handleVerifyCode = async () => {
    if (code.trim().length < 4) { setError("Введи код из SMS"); return; }
    setLoading(true); reset();
    const { data, error } = await verifyPhoneCode(phone, code);
    setLoading(false);
    if (error) { setError(error.message?.includes("expired") ? "Код истёк — запроси новый" : "Неверный код"); return; }
    onAuth(data.user);
  };

  /* ── Вход ── */
  const handleLogin = async () => {
    if (!email || !password) { setError("Заполни все поля"); return; }
    setLoading(true); reset();
    const { data, error } = await signIn({ email, password });
    setLoading(false);
    if (error) {
      setError(
        error.message.includes("Invalid login") ? "Неверный email или пароль" :
        error.message.includes("Email not confirmed") ? "Подтверди email перед входом" :
        error.message
      );
    } else {
      onAuth(data.user);
    }
  };

  /* ── Регистрация ── */
  const handleRegister = async () => {
    if (!name.trim()) { setError("Введи имя"); return; }
    if (!email)       { setError("Введи email"); return; }
    if (password.length < 6) { setError("Пароль должен быть не менее 6 символов"); return; }
    setLoading(true); reset();

    const { error } = await signUp({ email, password, fullName: name.trim(), role });
    setLoading(false);

    if (error) {
      setError(
        error.message.includes("already registered") ? "Этот email уже зарегистрирован" :
        error.message
      );
    } else {
      // Supabase по умолчанию требует подтверждения email
      // Можно отключить в Supabase Dashboard → Auth → Settings → "Confirm email"
      setSuccess("Письмо с подтверждением отправлено на " + email);
    }
  };

  return (
    <div className="relative isolate min-h-screen flex flex-col items-center justify-start px-4 pt-6 pb-10 overflow-hidden"
      style={{ fontFamily: "var(--font-sans)", color: "var(--color-text-primary)" }}>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
      <div className="pf-mesh"/>
      <div className="pf-blob" style={{ width: 240, height: 240, top: -40, left: -60,
        background: "radial-gradient(circle, #e11d48, transparent 70%)" }}/>
      <div className="pf-blob" style={{ width: 260, height: 260, bottom: -50, right: -60,
        background: "radial-gradient(circle, #f59e0b, transparent 70%)", animationDelay: "1.4s" }}/>

      {/* Логотип */}
      <div className="relative z-[1] text-center mb-7 pf-fade">
        <svg viewBox="0 0 64 64" width="58" height="58" className="mx-auto pf-float" style={{ display: "block" }}>
          <defs><linearGradient id="kxl" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#e11d48"/><stop offset="0.55" stopColor="#f43f5e"/><stop offset="1" stopColor="#f59e0b"/>
          </linearGradient></defs>
          <rect width="64" height="64" rx="15" fill="url(#kxl)"/>
          <g fill="none" stroke="#fff" strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 13 V51"/><path d="M25 32 L44 13"/><path d="M25 32 L45 51"/>
          </g>
        </svg>
        <div className="pf-serif text-[26px] mt-3 text-zinc-900 dark:text-zinc-100">Kirenix</div>
        <div className="text-[13px] text-zinc-500 dark:text-zinc-400 mt-1">Курсы ЕГЭ 2026 — информатика и русский</div>
      </div>

      <div className="relative z-[1] w-full max-w-[420px] rounded-3xl p-6
        backdrop-blur-2xl bg-white/70 dark:bg-zinc-900/60 ring-1 ring-white/60 dark:ring-white/10
        shadow-[0_22px_60px_-18px_rgba(20,20,45,0.35)]">

        {/* ════ ВХОД ════ */}
        {mode === "login" && (
          <>
            <div className="pf-serif" style={{ fontSize: 22, marginBottom: 4 }}>Добро пожаловать</div>
            <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 16 }}>
              Войди, чтобы продолжить обучение
            </div>

            {PHONE_AUTH_ENABLED && (
            <div style={{ display: "flex", gap: 6, padding: 4, marginBottom: 18, borderRadius: 12,
              background: "var(--color-background-secondary)" }}>
              {[["phone", "По телефону"], ["email", "По email"]].map(([m, lbl]) => (
                <button key={m} onClick={() => { setMethod(m); reset(); setPhoneStep("enter"); }} style={{
                  flex: 1, padding: "8px 0", borderRadius: 9, border: "none", cursor: "pointer",
                  fontSize: 12.5, fontWeight: 600,
                  background: method === m ? "var(--color-background-primary)" : "transparent",
                  boxShadow: method === m ? "var(--shadow-sm)" : "none",
                  color: method === m ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                }}>{lbl}</button>
              ))}
            </div>
            )}

            {method === "phone" ? (
              phoneStep === "enter" ? (
                <>
                  <Label>Номер телефона</Label>
                  <Field icon={Phone} type="tel" placeholder="+7 999 123-45-67"
                    value={phone} onChange={setPhone} error={error && !phone}/>
                  <ErrorMsg msg={error}/>
                  <Btn onClick={handleSendCode} loading={loading}>
                    Получить код <ArrowRight size={16}/>
                  </Btn>
                  <div style={{ fontSize: 11.5, color: "var(--color-text-secondary)",
                    textAlign: "center", lineHeight: 1.6 }}>
                    Пришлём код в SMS. Вход и регистрация — по одному номеру.
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 12.5, color: "var(--color-text-secondary)", marginBottom: 12 }}>
                    Код отправлен на {phone}
                  </div>
                  <Label>Код из SMS</Label>
                  <Field icon={Lock} type="text" placeholder="Введи код"
                    value={code} onChange={setCode} error={error && !code}/>
                  <ErrorMsg msg={error}/>
                  <Btn onClick={handleVerifyCode} loading={loading}>
                    Войти <ArrowRight size={16}/>
                  </Btn>
                  <button onClick={() => { setPhoneStep("enter"); setCode(""); reset(); }} style={{
                    width:"100%", padding:"10px 0", background:"none",
                    border:"1px solid var(--color-border-secondary)", borderRadius:10,
                    fontSize:13, cursor:"pointer", color:"var(--color-text-secondary)",
                  }}>
                    Изменить номер / отправить заново
                  </button>
                </>
              )
            ) : (
              <>
                <Label>Email</Label>
                <Field icon={Mail} type="email" placeholder="ivan@example.com"
                  value={email} onChange={setEmail} error={error && !email}/>

                <Label>Пароль</Label>
                <Field icon={Lock}
                  type={passShow ? "text" : "password"}
                  placeholder="Минимум 6 символов"
                  value={password} onChange={setPass}
                  right={
                    <button onClick={() => setPassShow(p=>!p)}
                      style={{ background:"none", border:"none", cursor:"pointer",
                        color:"var(--color-text-secondary)", display:"flex", padding:0 }}>
                      {passShow ? <EyeOff size={16}/> : <Eye size={16}/>}
                    </button>
                  }
                />

                <ErrorMsg msg={error}/>
                {success && (
                  <div style={{ display:"flex", alignItems:"center", gap:6,
                    fontSize:12, color:"#10b981", marginBottom:10 }}>
                    <CheckCircle size={13}/> {success}
                  </div>
                )}

                <Btn onClick={handleLogin} loading={loading}>
                  Войти <ArrowRight size={16}/>
                </Btn>

                <button onClick={() => { setMode("register"); reset(); }} style={{
                  width:"100%", padding:"11px 0",
                  background:"none", border:"1px solid var(--color-border-secondary)",
                  borderRadius:10, fontSize:13, cursor:"pointer",
                  color:"var(--color-text-secondary)",
                }}>
                  Создать аккаунт по email
                </button>
              </>
            )}
          </>
        )}

        {/* ════ РЕГИСТРАЦИЯ ════ */}
        {mode === "register" && (
          <>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
              <button onClick={() => setMode("login")} style={{
                background:"none", border:"none", cursor:"pointer",
                color:"var(--color-text-secondary)", display:"flex", padding:0,
              }}>
                ←
              </button>
              <div>
                <div style={{ fontSize:20, fontWeight:700 }}>Создать аккаунт</div>
                <div style={{ fontSize:12, color:"var(--color-text-secondary)" }}>
                  Аккаунт ученика
                </div>
              </div>
            </div>

            <Label>Имя и фамилия</Label>
            <Field icon={User}
              placeholder="Иван Петров"
              value={name} onChange={setName} error={error && !name}/>

            <Label>Email</Label>
            <Field icon={Mail} type="email" placeholder="ivan@example.com"
              value={email} onChange={setEmail} error={error && !email}/>

            <Label>Пароль</Label>
            <Field icon={Lock}
              type={passShow ? "text" : "password"}
              placeholder="Минимум 6 символов"
              value={password} onChange={setPass}
              right={
                <button onClick={() => setPassShow(p=>!p)}
                  style={{ background:"none", border:"none", cursor:"pointer",
                    color:"var(--color-text-secondary)", display:"flex", padding:0 }}>
                  {passShow ? <EyeOff size={16}/> : <Eye size={16}/>}
                </button>
              }
            />

            <ErrorMsg msg={error}/>
            {success && (
              <div style={{ display:"flex", alignItems:"center", gap:6,
                fontSize:12, color:"#10b981", marginBottom:10 }}>
                <CheckCircle size={13}/> {success}
              </div>
            )}

            <Btn onClick={handleRegister} loading={loading}>
              Создать аккаунт <ArrowRight size={16}/>
            </Btn>

            <div style={{ fontSize:12, color:"var(--color-text-secondary)",
              textAlign:"center", lineHeight:1.6 }}>
              Нажимая «Создать аккаунт», ты соглашаешься с{" "}
              <span style={{ color:"#6366f1", cursor:"pointer" }}>условиями использования</span>
            </div>
          </>
        )}
      </div>

      {/* Переключение в нижней части */}
      {mode === "login" && (
        <div style={{ marginTop:16, fontSize:13, color:"var(--color-text-secondary)" }}>
          Нет аккаунта?{" "}
          <span onClick={() => { setMode("register"); reset(); }}
            style={{ color:"#f59e0b", fontWeight:600, cursor:"pointer" }}>
            Зарегистрироваться
          </span>
        </div>
      )}
    </div>
  );
}
