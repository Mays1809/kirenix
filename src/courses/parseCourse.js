// ═══════════════════════════════════════════════════════════════════
//  parseCourse.js — разбор md-модулей курса на уроки
//  Формат модуля:
//    # 📚 МОДУЛЬ N. НАЗВАНИЕ
//    ## УРОК N.M. Название (задание X)   ← урок
//    ### 🎯 / 📖 / 💡 ...                ← секции внутри урока
//    ## ✅ ИТОГ МОДУЛЯ N                 ← итог модуля
//  Деление выполняется с учётом ```-блоков кода (внутри них "##" не заголовок).
// ═══════════════════════════════════════════════════════════════════

/** Разбивает сырой markdown модуля на { title, intro, lessons[], summary } */
export function parseModule(raw) {
  const lines = raw.split("\n");
  const segments = [];           // { heading, body: [] }
  let current = { heading: null, body: [] };
  let inFence = false;

  for (const line of lines) {
    if (/^\s*```/.test(line)) inFence = !inFence;
    if (!inFence && /^## /.test(line)) {
      segments.push(current);
      current = { heading: line.replace(/^## /, "").trim(), body: [] };
    } else {
      current.body.push(line);
    }
  }
  segments.push(current);

  // Первый сегмент (heading === null) — шапка модуля
  const head = segments.shift();
  let title = "";
  const introLines = [];
  for (const l of head.body) {
    if (!title && /^# /.test(l)) { title = l.replace(/^# /, "").trim(); continue; }
    introLines.push(l);
  }

  const lessons = [];
  let summary = null;

  for (const seg of segments) {
    const h = seg.heading || "";
    const body = seg.body.join("\n").trim();
    if (/^УРОК/i.test(h)) {
      // "УРОК 1.2. Кодирование. Условие Фано (задание 4)"
      const m = h.match(/^УРОК\s+([\d.]+)\.?\s*(.*)$/i);
      let num = m ? m[1].replace(/\.$/, "") : "";
      let rest = m ? m[2].trim() : h;
      let tag = null;
      const tm = rest.match(/\((задани[ея][^)]*)\)\s*$/i);
      if (tm) {
        tag = tm[1];
        rest = rest.slice(0, tm.index).trim();
      }
      lessons.push({ num, title: rest, tag, body });
    } else if (/ИТОГ/i.test(h)) {
      summary = { title: h, body };
    } else {
      // Прочие ##-секции модуля — прицепляем к последнему уроку либо во intro
      const chunk = `\n\n### ${h}\n\n${body}`;
      if (lessons.length) lessons[lessons.length - 1].body += chunk;
      else introLines.push(chunk);
    }
  }

  return { title, intro: introLines.join("\n").trim(), lessons, summary };
}

/** Готовит весь курс: модули → уроки со сквозными id */
export function buildCourse(courseDef) {
  const modules = courseDef.modules.map((m) => {
    const parsed = parseModule(m.raw);
    const items = parsed.lessons.map((l) => ({
      ...l,
      id: `m${m.num}-l${l.num}`,
      moduleNum: m.num,
    }));
    if (parsed.summary) {
      items.push({
        id: `m${m.num}-final`,
        num: null,
        moduleNum: m.num,
        title: parsed.summary.title.replace(/^[✅🎓]\s*/u, ""),
        tag: null,
        body: parsed.summary.body,
        isSummary: true,
      });
    }
    return {
      num: m.num,
      icon: m.icon,
      title: m.title || parsed.title,
      fullTitle: parsed.title,
      intro: parsed.intro,
      lessons: items,
    };
  });

  const lessonCount = modules.reduce(
    (s, m) => s + m.lessons.filter((l) => !l.isSummary).length, 0
  );

  return { ...courseDef, modules, lessonCount };
}
