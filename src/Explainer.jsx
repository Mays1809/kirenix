// ═══════════════════════════════════════════════════════════════════
//  Explainer.jsx — видео-обзор темы: анимированные слайды + озвучка.
//  Сценарий пишет ИИ (см. explainers/bank.js), озвучка — Web Speech (TTS,
//  локально, бесплатно). Без рендера MP4 — смотрится как видео, грузится
//  с приложением. Озвучку можно выключить (читаешь субтитры).
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import {
  ArrowLeft, Play, Pause, SkipBack, SkipForward,
  Volume2, VolumeX, RotateCcw, Film, ChevronRight,
} from "lucide-react";
import { EXPLAINERS } from "./explainers/bank";

const TTS = typeof window !== "undefined" && "speechSynthesis" in window;

const card = (extra = {}) => ({
  background: "var(--color-background-primary)",
  borderRadius: "var(--border-radius-lg)",
  border: "0.5px solid var(--color-border-tertiary)",
  boxShadow: "var(--shadow-sm)", ...extra,
});

export default function Explainer({ contentId, modules = [], onClose, accent = "#3b82f6" }) {
  const list = EXPLAINERS[contentId] || [];
  const [picked, setPicked] = useState(null);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);

  const exp = list.find((e) => e.id === picked) || null;
  const scenes = exp?.scenes || [];

  // Озвучка/таймер ведут показ: по окончании сцены — следующая.
  useEffect(() => {
    if (!exp || !playing) return;
    const scene = scenes[idx];
    if (!scene) return;
    let cancelled = false;
    const advance = () => {
      if (cancelled) return;
      if (idx < scenes.length - 1) setIdx(idx + 1);
      else setPlaying(false);
    };
    if (TTS && !muted) {
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(scene.t);
        u.lang = "ru-RU";
        const ru = window.speechSynthesis.getVoices().find((v) => (v.lang || "").toLowerCase().startsWith("ru"));
        if (ru) u.voice = ru;
        u.onend = advance;
        window.speechSynthesis.speak(u);
        return () => { cancelled = true; try { window.speechSynthesis.cancel(); } catch { /* ignore */ } };
      } catch { /* упадём на таймер ниже */ }
    }
    const ms = Math.max(3800, scene.t.split(" ").length * 360);
    const tm = setTimeout(advance, ms);
    return () => { cancelled = true; clearTimeout(tm); };
  }, [picked, playing, idx, muted]); // eslint-disable-line react-hooks/exhaustive-deps

  // чистим речь при выходе
  useEffect(() => () => { try { window.speechSynthesis?.cancel(); } catch { /* ignore */ } }, []);

  const open = (id) => { setPicked(id); setIdx(0); setPlaying(true); };
  const stop = () => { try { window.speechSynthesis?.cancel(); } catch { /* ignore */ } setPlaying(false); };
  const back = () => { stop(); setPicked(null); setIdx(0); };

  const backBtn = (onClick, label) => (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 6, background: "none",
      border: "none", cursor: "pointer", fontSize: 13,
      color: "var(--color-text-secondary)", padding: "0 0 14px 0",
    }}>
      <ArrowLeft size={14}/> {label}
    </button>
  );

  /* ─────────── СПИСОК ОБЗОРОВ ─────────── */
  if (!exp) {
    return (
      <div>{backBtn(onClose, "К оглавлению курса")}
        <div className="pf-serif" style={{ fontSize: 21, marginBottom: 4 }}>Видео-обзоры тем</div>
        <div style={{ fontSize: 12.5, color: "var(--color-text-secondary)", marginBottom: 16 }}>
          Короткий разбор темы с озвучкой — посмотри за пару минут, потом закрепи практикой.
        </div>
        {list.length ? list.map((e) => (
          <button key={e.id} onClick={() => open(e.id)} style={{
            ...card(), width: "100%", display: "flex", alignItems: "center", gap: 12,
            padding: "14px 16px", cursor: "pointer", marginBottom: 10, textAlign: "left",
          }}>
            <span style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0,
              background: `linear-gradient(135deg, ${accent}, ${accent}aa)`, color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Play size={18}/>
            </span>
            <span style={{ flex: 1 }}>
              <span style={{ display: "block", fontSize: 14, fontWeight: 700 }}>{e.title}</span>
              <span style={{ display: "block", fontSize: 11.5, color: "var(--color-text-secondary)" }}>
                Модуль {e.m}{modules.find((m) => m.num === e.m) ? `. ${modules.find((m) => m.num === e.m).title}` : ""} · {e.scenes.length} сцен
              </span>
            </span>
            <ChevronRight size={16} style={{ color: "var(--color-text-secondary)" }}/>
          </button>
        )) : (
          <div style={{ ...card(), padding: 24, textAlign: "center", fontSize: 13,
            color: "var(--color-text-secondary)" }}>
            Обзоры для этого курса скоро появятся.
          </div>
        )}
        <div style={{ fontSize: 11, color: "var(--color-text-secondary)", textAlign: "center", marginTop: 6 }}>
          <Film size={11} style={{ verticalAlign: -1, marginRight: 4 }}/>
          Озвучка — в браузере. Нет звука? Выключи динамик и читай субтитры.
        </div>
      </div>
    );
  }

  /* ─────────── ПЛЕЕР ─────────── */
  const scene = scenes[idx];
  const last = idx === scenes.length - 1;
  return (
    <div>{backBtn(back, "Все обзоры")}

      {/* «экран» */}
      <div style={{ position: "relative", overflow: "hidden", borderRadius: 18, padding: "30px 24px",
        minHeight: 220, display: "flex", flexDirection: "column", justifyContent: "center",
        color: "#fff", background: `linear-gradient(135deg, #1d1b3a, ${accent})`,
        boxShadow: "0 22px 60px -18px rgba(20,16,45,.5)" }}>
        <div style={{ position: "absolute", top: 12, left: 16, fontSize: 11, opacity: .7,
          display: "flex", alignItems: "center", gap: 5 }}>
          <Film size={12}/> {exp.title}
        </div>
        <div key={idx} className="pf-fade">
          <div className="pf-serif" style={{ fontSize: 26, lineHeight: 1.2, marginBottom: 10 }}>{scene.h}</div>
          <div style={{ fontSize: 14.5, lineHeight: 1.6, color: "rgba(255,255,255,.9)", maxWidth: 560 }}>{scene.t}</div>
        </div>
        <div style={{ position: "absolute", bottom: 12, right: 16, fontSize: 11, opacity: .7 }}>
          {idx + 1} / {scenes.length}
        </div>
      </div>

      {/* точки-сцены */}
      <div style={{ display: "flex", gap: 6, justifyContent: "center", margin: "14px 0" }}>
        {scenes.map((_, i) => (
          <button key={i} aria-label={`Сцена ${i + 1}`} onClick={() => setIdx(i)} style={{
            width: i === idx ? 22 : 8, height: 8, borderRadius: 99, border: "none", cursor: "pointer",
            background: i === idx ? accent : "var(--color-border-secondary)", transition: "width .2s, background .2s",
          }}/>
        ))}
      </div>

      {/* управление */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
        <button onClick={() => { stop(); setIdx(Math.max(0, idx - 1)); }} disabled={idx === 0}
          aria-label="Назад" style={ctl(idx === 0)}>
          <SkipBack size={17}/>
        </button>
        <button onClick={() => (playing ? stop() : setPlaying(true))} aria-label={playing ? "Пауза" : "Смотреть"}
          style={{ width: 54, height: 54, borderRadius: "50%", border: "none", cursor: "pointer", color: "#fff",
            background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 8px 22px ${accent}66` }}>
          {playing ? <Pause size={22}/> : <Play size={22}/>}
        </button>
        <button onClick={() => { stop(); setIdx(Math.min(scenes.length - 1, idx + 1)); }} disabled={last}
          aria-label="Вперёд" style={ctl(last)}>
          <SkipForward size={17}/>
        </button>
        {TTS && (
          <button onClick={() => setMuted((m) => !m)} aria-label={muted ? "Включить звук" : "Выключить звук"}
            title={muted ? "Звук выключен" : "Озвучка включена"}
            style={{ ...ctl(false), marginLeft: 6 }}>
            {muted ? <VolumeX size={17}/> : <Volume2 size={17}/>}
          </button>
        )}
      </div>

      {last && !playing && (
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <button onClick={() => { setIdx(0); setPlaying(true); }} style={{
            display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 18px",
            borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)",
            background: "var(--color-background-primary)", color: "var(--color-text-primary)",
            fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            <RotateCcw size={14}/> Посмотреть заново
          </button>
        </div>
      )}
    </div>
  );
}

function ctl(disabled) {
  return {
    width: 42, height: 42, borderRadius: "50%", cursor: disabled ? "default" : "pointer",
    border: "0.5px solid var(--color-border-secondary)",
    background: "var(--color-background-primary)",
    color: disabled ? "var(--color-border-secondary)" : "var(--color-text-primary)",
    display: "flex", alignItems: "center", justifyContent: "center", opacity: disabled ? 0.5 : 1,
  };
}
