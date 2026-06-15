// ═══════════════════════════════════════════════════════════════════
//  CourseMarkdown.jsx — лёгкий рендер markdown-контента курса
//  Поддержка: заголовки, абзацы, **жирный**, *курсив*, `код`,
//  ```блоки кода``` (с кнопкой копирования), таблицы, списки (ul/ol,
//  вложенность), цитаты-подсказки, $$формулы$$ (KaTeX с CDN, иначе
//  встроенный упрощённый рендер), разделители.
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect } from "react";
import { Copy, Check } from "lucide-react";

/* ── Инлайн-разметка: `код`, **жирный**, *курсив* ── */
const INLINE_RE = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*\n]+\*)/g;

function renderInline(text, keyPrefix = "i") {
  if (!text) return null;
  const parts = text.split(INLINE_RE);
  return parts.map((p, i) => {
    if (!p) return null;
    const key = `${keyPrefix}-${i}`;
    if (p.startsWith("`") && p.endsWith("`")) {
      return (
        <code key={key} style={{
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: "0.9em",
          background: "var(--color-background-secondary)",
          border: "0.5px solid var(--color-border-tertiary)",
          borderRadius: 4, padding: "1px 5px",
        }}>{p.slice(1, -1)}</code>
      );
    }
    if (p.startsWith("**") && p.endsWith("**")) {
      return <strong key={key}>{renderInline(p.slice(2, -2), key)}</strong>;
    }
    if (p.startsWith("*") && p.endsWith("*")) {
      return <em key={key}>{renderInline(p.slice(1, -1), key)}</em>;
    }
    return p;
  });
}

/* ── Упрощённый рендер LaTeX (фолбэк, если KaTeX не загрузился) ── */
const TEX_MAP = [
  [/\\cdot/g, " · "], [/\\times/g, "×"], [/\\le\b/g, "≤"], [/\\ge\b/g, "≥"],
  [/\\ne\b/g, "≠"], [/\\approx/g, "≈"], [/\\equiv/g, "≡"], [/\\infty/g, "∞"],
  [/\\in\b/g, "∈"], [/\\notin\b/g, "∉"], [/\\subseteq/g, "⊆"],
  [/\\rightarrow|\\to\b/g, "→"], [/\\Rightarrow/g, "⇒"], [/\\leftrightarrow/g, "↔"],
  [/\\lor\b|\\vee\b/g, "∨"], [/\\land\b|\\wedge\b/g, "∧"], [/\\lnot|\\neg/g, "¬"],
  [/\\oplus/g, "⊕"], [/\\min\b/g, "min"], [/\\max\b/g, "max"], [/\\log\b/g, "log"],
  [/\\lceil/g, "⌈"], [/\\rceil/g, "⌉"], [/\\lfloor/g, "⌊"], [/\\rfloor/g, "⌋"],
  [/\\ldots|\\dots/g, "…"], [/\\bmod\b|\\mod\b/g, " mod "],
  [/\\quad|\\qquad/g, "  "], [/\\,|\\;|\\:|\\!/g, " "],
  [/\\big[lr]?|\\Big[lr]?|\\left|\\right/g, ""],
  [/\\#/g, "#"], [/\\\{/g, "{"], [/\\\}/g, "}"], [/\\ /g, " "],
];

function texFallbackHtml(tex) {
  let s = tex
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  // \text{...}, \underbrace{x}_{y}, \frac{a}{b}
  for (let i = 0; i < 5; i++) {
    s = s
      .replace(/\\text\{([^{}]*)\}/g, "$1")
      .replace(/\\underbrace\{([^{}]*)\}_\{([^{}]*)\}/g, "$1 [$2]")
      .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, "($1)/($2)");
  }
  for (const [re, to] of TEX_MAP) s = s.replace(re, to);
  // Степени и индексы
  for (let i = 0; i < 5; i++) {
    s = s
      .replace(/\^\{([^{}]*)\}/g, "<sup>$1</sup>")
      .replace(/_\{([^{}]*)\}/g, "<sub>$1</sub>")
      .replace(/\^([0-9a-zA-Zа-яА-Я])/g, "<sup>$1</sup>")
      .replace(/_([0-9a-zA-Zа-яА-Я])/g, "<sub>$1</sub>");
  }
  return s.replace(/\\[a-zA-Z]+/g, "").trim();
}

function MathBlock({ tex }) {
  const [, force] = useState(0);
  useEffect(() => {
    if (window.katex) return;
    const t = setInterval(() => {
      if (window.katex) { force((x) => x + 1); clearInterval(t); }
    }, 400);
    const stop = setTimeout(() => clearInterval(t), 8000);
    return () => { clearInterval(t); clearTimeout(stop); };
  }, []);

  let html;
  if (window.katex) {
    try {
      html = window.katex.renderToString(tex, { displayMode: true, throwOnError: false });
    } catch { html = null; }
  }
  if (!html) {
    html = `<div style="text-align:center;font-size:15px">${texFallbackHtml(tex)}</div>`;
  }
  return (
    <div
      style={{ margin: "10px 0", overflowX: "auto", padding: "4px 0" }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/* ── Блок кода с копированием ── */
function CodeBlock({ code, lang }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };
  return (
    <div style={{
      position: "relative", margin: "10px 0",
      background: "#0f172a", borderRadius: "var(--border-radius-md)",
      border: "0.5px solid var(--color-border-tertiary)", overflow: "hidden",
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "5px 12px", background: "#1e293b",
      }}>
        <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600,
          textTransform: "uppercase", letterSpacing: ".06em" }}>
          {lang || "код"}
        </span>
        <button onClick={copy} style={{
          display: "flex", alignItems: "center", gap: 4, background: "none",
          border: "none", cursor: "pointer", color: copied ? "#34d399" : "#94a3b8",
          fontSize: 10, padding: 2,
        }}>
          {copied ? <Check size={11}/> : <Copy size={11}/>}
          {copied ? "Скопировано" : "Копировать"}
        </button>
      </div>
      <pre style={{
        margin: 0, padding: "12px 14px", overflowX: "auto",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 12.5, lineHeight: 1.6, color: "#e2e8f0",
      }}>{code}</pre>
    </div>
  );
}

/* ── Таблица ── */
function Table({ rows, aligns, accent }) {
  const [head, ...body] = rows;
  return (
    <div style={{ overflowX: "auto", margin: "10px 0" }}>
      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12.5 }}>
        <thead>
          <tr>
            {head.map((c, i) => (
              <th key={i} style={{
                textAlign: aligns[i] || "left", padding: "7px 10px",
                background: `${accent}14`, color: "var(--color-text-primary)",
                borderBottom: `2px solid ${accent}55`, fontWeight: 600,
                whiteSpace: "nowrap",
              }}>{renderInline(c, `th${i}`)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((r, ri) => (
            <tr key={ri}>
              {r.map((c, ci) => (
                <td key={ci} style={{
                  textAlign: aligns[ci] || "left", padding: "6px 10px",
                  borderBottom: "0.5px solid var(--color-border-tertiary)",
                }}>{renderInline(c, `td${ri}-${ci}`)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function splitTableRow(line) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "")
    .split("|").map((c) => c.trim());
}

/* ── Основной разбор на блоки ── */
export default function CourseMarkdown({ text, accent = "#3b82f6" }) {
  if (!text) return null;
  const lines = text.split("\n");
  const out = [];
  let i = 0;
  let key = 0;

  const pStyle = {
    fontSize: 13.5, lineHeight: 1.75, margin: "8px 0",
    color: "var(--color-text-primary)",
  };

  while (i < lines.length) {
    const line = lines[i];
    const t = line.trim();

    /* пустая строка */
    if (t === "") { i++; continue; }

    /* блок кода */
    if (t.startsWith("```")) {
      const lang = t.slice(3).trim();
      const buf = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        buf.push(lines[i]); i++;
      }
      i++; // закрывающая ```
      out.push(<CodeBlock key={key++} code={buf.join("\n")} lang={lang}/>);
      continue;
    }

    /* формула $$...$$ */
    if (t.startsWith("$$")) {
      let tex;
      if (t.length > 4 && t.endsWith("$$")) {
        tex = t.slice(2, -2);
        i++;
      } else {
        const buf = [t.slice(2)];
        i++;
        while (i < lines.length && !lines[i].trim().endsWith("$$")) {
          buf.push(lines[i]); i++;
        }
        if (i < lines.length) {
          buf.push(lines[i].trim().slice(0, -2)); i++;
        }
        tex = buf.join(" ");
      }
      out.push(<MathBlock key={key++} tex={tex.trim()}/>);
      continue;
    }

    /* разделитель */
    if (/^-{3,}$/.test(t) || /^\*{3,}$/.test(t)) {
      out.push(<div key={key++} style={{
        height: 1, background: "var(--color-border-tertiary)", margin: "18px 0",
      }}/>);
      i++;
      continue;
    }

    /* заголовки */
    const hm = line.match(/^(#{1,4})\s+(.*)$/);
    if (hm) {
      const level = hm[1].length;
      let txt = hm[2].trim();
      if (level <= 2) {
        out.push(
          <div key={key++} style={{
            fontSize: level === 1 ? 18 : 16, fontWeight: 700,
            margin: "20px 0 8px", lineHeight: 1.35,
          }}>{renderInline(txt, `h${key}`)}</div>
        );
      } else if (level === 3) {
        // секция урока: 🎯 / 📖 / 💡 / 🧩 / ✍️ / 📝 / ⚠️ / 💻 / ✅
        const em = txt.match(/^(\p{Extended_Pictographic}️?|✍️|✅)\s*(.*)$/u);
        const emoji = em ? em[1] : null;
        const label = em ? em[2] : txt;
        out.push(
          <div key={key++} style={{
            display: "flex", alignItems: "center", gap: 8,
            margin: "22px 0 10px",
          }}>
            {emoji && (
              <span style={{
                width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                background: `${accent}18`, display: "flex",
                alignItems: "center", justifyContent: "center", fontSize: 14,
              }}>{emoji}</span>
            )}
            <span style={{
              fontSize: 13.5, fontWeight: 700, letterSpacing: ".02em",
              color: "var(--color-text-primary)",
            }}>{renderInline(label, `h3${key}`)}</span>
            <div style={{ flex: 1, height: 1, background: `${accent}33` }}/>
          </div>
        );
      } else {
        out.push(
          <div key={key++} style={{
            fontSize: 13.5, fontWeight: 700, margin: "16px 0 6px",
          }}>{renderInline(txt, `h4${key}`)}</div>
        );
      }
      i++;
      continue;
    }

    /* цитата-подсказка */
    if (t.startsWith(">")) {
      const buf = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        buf.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      out.push(
        <div key={key++} style={{
          margin: "10px 0", padding: "10px 14px",
          background: `${accent}0d`, borderLeft: `3px solid ${accent}`,
          borderRadius: "0 8px 8px 0", fontSize: 13, lineHeight: 1.7,
        }}>{renderInline(buf.join(" "), `q${key}`)}</div>
      );
      continue;
    }

    /* таблица */
    if (t.startsWith("|") && i + 1 < lines.length &&
        /^\|?[\s:|-]+\|?$/.test(lines[i + 1].trim()) &&
        lines[i + 1].includes("-")) {
      const header = splitTableRow(lines[i]);
      const aligns = splitTableRow(lines[i + 1]).map((c) =>
        c.startsWith(":") && c.endsWith(":") ? "center"
        : c.endsWith(":") ? "right" : "left");
      const rows = [header];
      i += 2;
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        rows.push(splitTableRow(lines[i])); i++;
      }
      out.push(<Table key={key++} rows={rows} aligns={aligns} accent={accent}/>);
      continue;
    }

    /* списки (с одним уровнем вложенности) */
    const isListLine = (s) => /^(\s*)([-*]|\d+\.)\s+/.test(s);
    if (isListLine(line)) {
      const items = [];
      while (i < lines.length && isListLine(lines[i])) {
        const m = lines[i].match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
        const depth = m[1].length >= 2 ? 1 : 0;
        const ordered = /^\d+\.$/.test(m[2]);
        const num = ordered ? parseInt(m[2]) : null;
        if (depth === 1 && items.length) {
          items[items.length - 1].children.push({ text: m[3], ordered, num });
        } else {
          items.push({ text: m[3], ordered, num, children: [] });
        }
        i++;
      }
      out.push(
        <div key={key++} style={{ margin: "8px 0", display: "flex",
          flexDirection: "column", gap: 5 }}>
          {items.map((it, ii) => (
            <div key={ii}>
              <div style={{ display: "flex", gap: 8, fontSize: 13.5, lineHeight: 1.65 }}>
                <span style={{
                  color: accent, fontWeight: 700, flexShrink: 0,
                  minWidth: it.ordered ? 18 : 8, textAlign: "right",
                }}>{it.ordered ? `${it.num}.` : "•"}</span>
                <span>{renderInline(it.text, `li${key}-${ii}`)}</span>
              </div>
              {it.children.map((ch, ci) => (
                <div key={ci} style={{ display: "flex", gap: 8, fontSize: 13,
                  lineHeight: 1.6, paddingLeft: 26, marginTop: 3,
                  color: "var(--color-text-secondary)" }}>
                  <span style={{ flexShrink: 0 }}>{ch.ordered ? `${ch.num}.` : "◦"}</span>
                  <span>{renderInline(ch.text, `lc${key}-${ii}-${ci}`)}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      );
      continue;
    }

    /* обычный абзац — собираем до пустой строки / спец-блока */
    {
      const buf = [t];
      i++;
      while (
        i < lines.length &&
        lines[i].trim() !== "" &&
        !lines[i].trim().startsWith("```") &&
        !lines[i].trim().startsWith("$$") &&
        !lines[i].trim().startsWith(">") &&
        !lines[i].trim().startsWith("|") &&
        !/^(#{1,4})\s/.test(lines[i]) &&
        !/^(\s*)([-*]|\d+\.)\s+/.test(lines[i]) &&
        !/^-{3,}$/.test(lines[i].trim())
      ) {
        buf.push(lines[i].trim());
        i++;
      }
      out.push(<p key={key++} style={pStyle}>{renderInline(buf.join(" "), `p${key}`)}</p>);
    }
  }

  return <div>{out}</div>;
}
