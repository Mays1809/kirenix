// ═══════════════════════════════════════════════════════════════════
//  App.jsx — Корневой компонент платформы
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect } from "react";
import AuthScreen from "./AuthScreen";
import Platform   from "./Platform";
import Contacts   from "./Contacts";   // страница контактов и реквизитов
import Oferta     from "./Oferta";     // публичная оферта
import Access     from "./Access";     // как получить доступ
import {
  supabase,
  getProfile,
  onAuthChange,
  subscribeToNotifications,
} from "./supabase";

// — захват реферального кода из ссылки ?ref=… (один раз при загрузке) —
try {
  const _ref = new URLSearchParams(window.location.search).get("ref");
  if (_ref) localStorage.setItem("kirenix_ref", _ref.trim().slice(0, 32));
} catch { /* ignore */ }

export default function App() {
  /* ── Страницы без авторизации ── */
  if (window.location.pathname === "/contacts") {
    return <Contacts />;
  }
  if (window.location.pathname === "/oferta") {
    return <Oferta />;
  }
  if (window.location.pathname === "/access") {
    return <Access />;
  }

  const [session,       setSession]  = useState(undefined);
  const [profile,       setProfile]  = useState(null);
  const [notifications, setNotifs]   = useState([]);
  const [loading,       setLoading]  = useState(true);

  /* ── При старте: восстанавливаем сессию ── */
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) loadProfile(session.user.id);
      else setLoading(false);
    });

    const sub = onAuthChange((event, session) => {
      setSession(session);
      if (session) loadProfile(session.user.id);
      else { setProfile(null); setLoading(false); }
    });

    return () => sub.unsubscribe();
  }, []);

  /* ── Загрузить профиль ── */
  const loadProfile = async (userId) => {
    setLoading(true);
    const { data, error } = await getProfile(userId);
    if (!error && data) setProfile(data);
    setLoading(false);
  };

  /* ── Realtime-уведомления ── */
  useEffect(() => {
    if (!session?.user) return;

    const channel = subscribeToNotifications(session.user.id, (newNotif) => {
      setNotifs(prev => [newNotif, ...prev]);
    });

    return () => supabase.removeChannel(channel);
  }, [session?.user?.id]);

  /* ── Экран загрузки ── */
  if (session === undefined || loading) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex",
        alignItems: "center", justifyContent: "center",
        fontFamily: "var(--font-sans)",
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🏅</div>
          <div style={{ fontSize: 14, color: "var(--color-text-secondary)" }}>
            Загружаем платформу...
          </div>
        </div>
      </div>
    );
  }

  /* ── Не залогинен ── */
  if (!session) {
    return <AuthScreen onAuth={(user) => setSession({ user })}/>;
  }

  /* ── Выход из аккаунта ── */
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setNotifs([]);
  };

  /* ── Главная платформа ── */
  return (
    <Platform
      user={session.user}
      profile={profile}
      notifications={notifications}
      onProfileUpdate={setProfile}
      onNotificationRead={(id) =>
        setNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
      }
      onLogout={handleLogout}
    />
  );
}