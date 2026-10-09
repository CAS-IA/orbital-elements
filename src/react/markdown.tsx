/**
 * Markdown seguro → elementos React (nunca HTML crudo ni
 * dangerouslySetInnerHTML). Soporta lo que de verdad escribe un modelo:
 * títulos (#, ##, ###), párrafos, listas (- * + y 1.), tareas ([ ] / [x]),
 * citas (>), bloques de código (```), negrita, cursiva, tachado, código en
 * línea y enlaces [texto](url) SOLO http(s) y mailto.
 */
import React from 'react';

const SAFE_URL = /^(https?:\/\/|mailto:)/i;

export function isSafeUrl(href: string): boolean {
  return SAFE_URL.test(href.trim());
}

type Block =
  | { k: 'h'; level: number; text: string }
  | { k: 'p'; text: string }
  | { k: 'ul' | 'ol'; items: Array<{ text: string; checked?: boolean }> }
  | { k: 'quote'; text: string }
  | { k: 'code'; text: string; lang?: string }
  | { k: 'hr' };

function parseBlocks(src: string): Block[] {
  const lines = src.replace(/\r\n?/g, '\n').split('\n');
  const out: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const fence = line.match(/^\s*```(\w*)\s*$/);
    if (fence) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) buf.push(lines[i++]);
      i++;
      out.push({ k: 'code', text: buf.join('\n'), lang: fence[1] || undefined });
      continue;
    }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      out.push({ k: 'h', level: Math.min(3, h[1].length), text: h[2] });
      i++;
      continue;
    }
    if (/^\s*([-*_])\s*\1\s*\1[\s\-*_]*$/.test(line)) {
      out.push({ k: 'hr' });
      i++;
      continue;
    }
    if (/^\s*>/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, ''));
      out.push({ k: 'quote', text: buf.join(' ') });
      continue;
    }
    const ulRe = /^\s*[-*+]\s+(.*)$/;
    const olRe = /^\s*\d+[.)]\s+(.*)$/;
    if (ulRe.test(line) || olRe.test(line)) {
      const ordered = olRe.test(line) && !ulRe.test(line);
      const re = ordered ? olRe : ulRe;
      const items: Array<{ text: string; checked?: boolean }> = [];
      while (i < lines.length && re.test(lines[i])) {
        const t = lines[i].match(re)![1];
        const task = t.match(/^\[([ xX])\]\s+(.*)$/);
        items.push(task ? { text: task[2], checked: task[1] !== ' ' } : { text: t });
        i++;
      }
      out.push({ k: ordered ? 'ol' : 'ul', items });
      continue;
    }
    const buf: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|\s*```|\s*>|\s*[-*+]\s|\s*\d+[.)]\s)/.test(lines[i])) buf.push(lines[i++]);
    out.push({ k: 'p', text: buf.join('\n') });
  }
  return out;
}

/** Inline: `código`, **negrita**, *cursiva*, ~~tachado~~, [enlace](url). */
export function inline(text: string, keyBase = 'i'): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*|__[^_]+__)|(~~[^~]+~~)|(\*[^*\s][^*]*\*|_[^_\s][^_]*_)|(\[[^\]]+\]\([^)\s]+\))|(\n)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let n = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const k = `${keyBase}-${n++}`;
    const tok = m[0];
    if (m[1]) nodes.push(<code key={k} className="oe-code-inline">{tok.slice(1, -1)}</code>);
    else if (m[2]) nodes.push(<strong key={k}>{inline(tok.slice(2, -2), k)}</strong>);
    else if (m[3]) nodes.push(<del key={k}>{inline(tok.slice(2, -2), k)}</del>);
    else if (m[4]) nodes.push(<em key={k}>{inline(tok.slice(1, -1), k)}</em>);
    else if (m[5]) {
      const lm = tok.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/)!;
      nodes.push(
        isSafeUrl(lm[2]) ? (
          <a key={k} className="oe-link" href={lm[2]} target="_blank" rel="noopener noreferrer">
            {inline(lm[1], k)}
          </a>
        ) : (
          lm[1]
        ),
      );
    } else if (m[6]) nodes.push(<br key={k} />);
    last = m.index + tok.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function Markdown({ text, className }: { text: string; className?: string }) {
  const blocks = parseBlocks(text);
  return (
    <div className={`oe-md${className ? ` ${className}` : ''}`}>
      {blocks.map((b, i) => {
        const k = `b${i}`;
        switch (b.k) {
          case 'h': {
            const Tag = (`h${b.level + 2}` as unknown) as 'h3';
            return <Tag key={k} className={`oe-md-h oe-md-h${b.level}`}>{inline(b.text, k)}</Tag>;
          }
          case 'p':
            return <p key={k}>{inline(b.text, k)}</p>;
          case 'quote':
            return <blockquote key={k}>{inline(b.text, k)}</blockquote>;
          case 'code':
            return (
              <pre key={k} className="oe-pre">
                <code>{b.text}</code>
              </pre>
            );
          case 'hr':
            return <hr key={k} className="oe-divider-line" />;
          default: {
            const Tag = b.k;
            const task = b.items.some((it) => it.checked !== undefined);
            return (
              <Tag key={k} className={task ? 'oe-md-tasks' : undefined}>
                {b.items.map((it, j) => (
                  <li key={j} data-checked={it.checked === undefined ? undefined : String(it.checked)}>
                    {it.checked !== undefined && <span className="oe-md-box" aria-hidden="true">{it.checked ? '✓' : ''}</span>}
                    {inline(it.text, `${k}-${j}`)}
                  </li>
                ))}
              </Tag>
            );
          }
        }
      })}
    </div>
  );
}
