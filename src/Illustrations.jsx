// ═══════════════════════════════════════════════════════════════════
//  Illustrations.jsx — встроенный SVG-арт для премиум-дизайна.
//  Без внешних файлов: герой-иллюстрация, мягкие свечения, паттерны, печать.
// ═══════════════════════════════════════════════════════════════════

/** Мягкое радиальное свечение — фон секций (декоративный, не кликабельный) */
export function GlowBg({ color = "#e11d48", opacity = 0.18, size = 520, style = {} }) {
  return (
    <div aria-hidden style={{
      position: "absolute", width: size, height: size, borderRadius: "50%",
      background: `radial-gradient(circle, ${color}${Math.round(opacity * 255).toString(16).padStart(2, "0")} 0%, transparent 70%)`,
      filter: "blur(8px)", pointerEvents: "none", zIndex: 0, ...style,
    }}/>
  );
}

/** Тонкая точечная сетка — премиум-текстура фона */
export function DotGrid({ color = "#14141b", opacity = 0.05, style = {} }) {
  return (
    <div aria-hidden style={{
      position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0,
      backgroundImage: `radial-gradient(${color} 1px, transparent 1px)`,
      backgroundSize: "22px 22px", opacity, ...style,
    }}/>
  );
}

/** Круглая «печать» — знак доверия (напр. «ФИПИ 2027») */
export function Seal({ top = "ПО КОДИФИКАТОРУ", bottom = "ФИПИ 2027", size = 92, color = "#b88a3e" }) {
  const id = "seal" + bottom.replace(/\W/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className="pf-float" style={{ display: "block" }}>
      <defs>
        <path id={id} d="M50,50 m-37,0 a37,37 0 1,1 74,0 a37,37 0 1,1 -74,0"/>
      </defs>
      <circle cx="50" cy="50" r="46" fill="none" stroke={color} strokeWidth="1.2" opacity=".5"/>
      <circle cx="50" cy="50" r="41" fill="none" stroke={color} strokeWidth="2.5"/>
      <text fill={color} fontSize="8.5" fontWeight="700" letterSpacing="1.5">
        <textPath href={`#${id}`} startOffset="2%">{top}</textPath>
      </text>
      <text fill={color} fontSize="8.5" fontWeight="700" letterSpacing="1.5">
        <textPath href={`#${id}`} startOffset="52%">{bottom}</textPath>
      </text>
      <path d="M40,50 l7,7 l14,-15" fill="none" stroke={color} strokeWidth="4"
        strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

/** Главная герой-иллюстрация: рост баллов до экзамена (премиум, абстракт) */
export function HeroArt({ style = {} }) {
  return (
    <svg viewBox="0 0 460 380" style={{ width: "100%", height: "auto", display: "block", ...style }}
      xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Рост баллов">
      <defs>
        <linearGradient id="hgCard" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1d1b3a"/>
          <stop offset="1" stopColor="#3b2c5e"/>
        </linearGradient>
        <linearGradient id="hgBar" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#e11d48"/>
          <stop offset="1" stopColor="#f59e0b"/>
        </linearGradient>
        <linearGradient id="hgLine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#f59e0b"/>
          <stop offset="1" stopColor="#e11d48"/>
        </linearGradient>
        <radialGradient id="hgGlow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#f59e0b" stopOpacity="0.55"/>
          <stop offset="1" stopColor="#f59e0b" stopOpacity="0"/>
        </radialGradient>
        <filter id="hgSoft" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="10" stdDeviation="14" floodColor="#1d1b3a" floodOpacity="0.18"/>
        </filter>
      </defs>

      {/* свечение */}
      <ellipse cx="320" cy="120" rx="150" ry="150" fill="url(#hgGlow)"/>

      {/* тёмная карточка-дашборд */}
      <g filter="url(#hgSoft)">
        <rect x="40" y="60" width="300" height="220" rx="22" fill="url(#hgCard)"/>
      </g>
      {/* сетка осей */}
      {[0, 1, 2, 3].map((i) => (
        <line key={i} x1="68" y1={110 + i * 40} x2="312" y2={110 + i * 40}
          stroke="#ffffff" strokeOpacity="0.08" strokeWidth="1"/>
      ))}
      {/* столбцы роста */}
      {[
        [86, 70], [126, 95], [166, 120], [206, 150], [246, 178],
      ].map(([x, h], i) => (
        <rect key={i} x={x} y={250 - h} width="22" height={h} rx="6" fill="url(#hgBar)"
          opacity={0.55 + i * 0.09}/>
      ))}
      {/* линия тренда вверх */}
      <polyline points="97,196 137,168 177,140 217,108 268,72"
        fill="none" stroke="url(#hgLine)" strokeWidth="3.5" strokeLinecap="round"/>
      {/* узел «100» */}
      <circle cx="268" cy="72" r="9" fill="#fff"/>
      <circle cx="268" cy="72" r="5" fill="#e11d48"/>

      {/* плашка с баллом */}
      <g className="pf-float">
        <rect x="250" y="28" width="92" height="48" rx="12" fill="#fff" filter="url(#hgSoft)"/>
        <text x="296" y="50" textAnchor="middle" fontFamily="'Playfair Display',serif"
          fontWeight="700" fontSize="22" fill="#14141b">100</text>
        <text x="296" y="66" textAnchor="middle" fontFamily="Manrope,sans-serif"
          fontWeight="700" fontSize="8" letterSpacing="1" fill="#73717c">ТЕСТОВЫХ</text>
      </g>

      {/* карточка-документ (сочинение) */}
      <g filter="url(#hgSoft)">
        <rect x="300" y="200" width="130" height="150" rx="16" fill="#ffffff"/>
        <rect x="300" y="200" width="130" height="150" rx="16" fill="none"
          stroke="#efece6" strokeWidth="1"/>
      </g>
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={i} x="318" y={224 + i * 17} width={i === 4 ? 60 : 94} height="5" rx="2.5"
          fill="#e6e1d8"/>
      ))}
      {/* галочка-печать на документе */}
      <circle cx="406" cy="220" r="16" fill="#10b981"/>
      <path d="M399,220 l5,5 l9,-10" fill="none" stroke="#fff" strokeWidth="3"
        strokeLinecap="round" strokeLinejoin="round"/>

      {/* искры */}
      <g fill="#f59e0b">
        <path d="M70,40 l2,5 l5,2 l-5,2 l-2,5 l-2,-5 l-5,-2 l5,-2 z"/>
        <path d="M360,320 l1.6,4 l4,1.6 l-4,1.6 l-1.6,4 l-1.6,-4 l-4,-1.6 l4,-1.6 z"/>
      </g>
    </svg>
  );
}
