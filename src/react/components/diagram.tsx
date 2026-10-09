import React, { useId, useMemo } from 'react';
import type { ElementProps } from '../registry';
import type { PropsOf } from '../../catalog';
import { IconCheck, IconX } from '../icons';

type FlowProps = PropsOf<'Flow'>;
type FlowNode = FlowProps['nodes'][number];

interface Placed {
  node: FlowNode;
  x: number;
  y: number;
  w: number;
  h: number;
  lines: string[];
  rank: number;
}

const CHAR = 7.1;
const LINE_MAX = 22;

/** Parte la etiqueta en ≤ 2 líneas por palabras (lo que sobra, con elipsis). */
function wrap(label: string): string[] {
  const words = label.split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur ? cur.length + 1 : 0) + w.length <= LINE_MAX || !cur) cur = cur ? `${cur} ${w}` : w;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length > 2) lines.splice(1, lines.length - 1, `${lines.slice(1).join(' ').slice(0, LINE_MAX - 1)}…`);
  return lines.map((l) => (l.length > LINE_MAX + 4 ? `${l.slice(0, LINE_MAX)}…` : l));
}

/**
 * Maquetación por capas (Sugiyama simplificado):
 *  1. aristas de retroceso (ciclos) detectadas por DFS y apartadas;
 *  2. rango = camino más largo desde las fuentes;
 *  3. orden dentro de cada capa por baricentro de los predecesores (2 pasadas);
 *  4. coordenadas por capa, centradas.
 */
export function layoutFlow(props: FlowProps) {
  const lr = (props.direction ?? 'LR') === 'LR';
  const ids = new Map(props.nodes.map((n, i) => [n.id, i]));
  const edges = props.edges.filter((e) => ids.has(e.from) && ids.has(e.to) && e.from !== e.to);
  const out = new Map<string, string[]>();
  for (const n of props.nodes) out.set(n.id, []);
  for (const e of edges) out.get(e.from)!.push(e.to);

  // 1. Retrocesos por DFS (gris = en la pila).
  const state = new Map<string, 0 | 1 | 2>();
  const back = new Set<string>();
  const dfs = (u: string) => {
    state.set(u, 1);
    for (const v of out.get(u)!) {
      const s = state.get(v) ?? 0;
      if (s === 1) back.add(`${u}->${v}`);
      else if (s === 0) dfs(v);
    }
    state.set(u, 2);
  };
  for (const n of props.nodes) if (!state.get(n.id)) dfs(n.id);
  const forward = edges.filter((e) => !back.has(`${e.from}->${e.to}`));

  // 2. Rangos (Kahn sobre las aristas hacia delante).
  const indeg = new Map(props.nodes.map((n) => [n.id, 0]));
  for (const e of forward) indeg.set(e.to, indeg.get(e.to)! + 1);
  const rank = new Map(props.nodes.map((n) => [n.id, 0]));
  const queue = props.nodes.filter((n) => indeg.get(n.id) === 0).map((n) => n.id);
  while (queue.length) {
    const u = queue.shift()!;
    for (const e of forward) {
      if (e.from !== u) continue;
      rank.set(e.to, Math.max(rank.get(e.to)!, rank.get(u)! + 1));
      indeg.set(e.to, indeg.get(e.to)! - 1);
      if (indeg.get(e.to) === 0) queue.push(e.to);
    }
  }

  // 3. Capas y orden por baricentro.
  const maxRank = Math.max(0, ...rank.values());
  const layers: string[][] = Array.from({ length: maxRank + 1 }, () => []);
  for (const n of props.nodes) layers[rank.get(n.id)!].push(n.id);
  const pos = new Map<string, number>();
  const index = () => layers.forEach((l) => l.forEach((id, i) => pos.set(id, i)));
  index();
  for (let pass = 0; pass < 2; pass++) {
    for (let r = 1; r <= maxRank; r++) {
      const bary = (id: string) => {
        const preds = forward.filter((e) => e.to === id).map((e) => pos.get(e.from)!);
        return preds.length ? preds.reduce((a, b) => a + b, 0) / preds.length : pos.get(id)!;
      };
      layers[r].sort((a, b) => bary(a) - bary(b) || ids.get(a)! - ids.get(b)!);
      index();
    }
  }

  // 4. Tamaños y coordenadas.
  const size = (n: FlowNode) => {
    const lines = wrap(n.label);
    const len = Math.max(...lines.map((l) => l.length));
    let w = Math.min(196, Math.max(96, len * CHAR + 32));
    let h = lines.length > 1 ? 58 : 42;
    if (n.kind === 'decision') {
      w += 36;
      h += 22;
    }
    return { w, h, lines };
  };
  const sized = new Map(props.nodes.map((n) => [n.id, { node: n, ...size(n) }]));
  const RANK_GAP = lr ? 72 : 56;
  const NODE_GAP = lr ? 22 : 28;
  const placed = new Map<string, Placed>();
  const extent = layers.map((l) => l.reduce((a, id) => a + (lr ? sized.get(id)!.h : sized.get(id)!.w), 0) + NODE_GAP * Math.max(0, l.length - 1));
  const thick = layers.map((l) => Math.max(...l.map((id) => (lr ? sized.get(id)!.w : sized.get(id)!.h))));
  const cross = Math.max(...extent);
  let along = 8;
  layers.forEach((layer, r) => {
    let c = 8 + (cross - extent[r]) / 2;
    for (const id of layer) {
      const s = sized.get(id)!;
      const x = lr ? along + (thick[r] - s.w) / 2 : c;
      const y = lr ? c : along + (thick[r] - s.h) / 2;
      placed.set(id, { node: s.node, x, y, w: s.w, h: s.h, lines: s.lines, rank: r });
      c += (lr ? s.h : s.w) + NODE_GAP;
    }
    along += thick[r] + RANK_GAP;
  });
  const width = (lr ? along - RANK_GAP : cross) + 16;
  const height = (lr ? cross : along - RANK_GAP) + 16 + (back.size ? 44 : 0);
  return { placed, edges, back, width, height, lr };
}

function bezierMid(p0: number[], p1: number[], p2: number[], p3: number[]) {
  const t = 0.5;
  const m = (i: number) => (1 - t) ** 3 * p0[i] + 3 * (1 - t) ** 2 * t * p1[i] + 3 * (1 - t) * t ** 2 * p2[i] + t ** 3 * p3[i];
  return [m(0), m(1)];
}

function NodeShape({ p }: { p: Placed }) {
  const { x, y, w, h, node } = p;
  const kind = node.kind ?? 'process';
  const common = { className: 'oe-flow-shape', 'data-kind': kind, 'data-tone': node.tone } as const;
  if (kind === 'decision') {
    const cx = x + w / 2;
    const cy = y + h / 2;
    return <path {...common} d={`M${cx},${y} L${x + w},${cy} L${cx},${y + h} L${x},${cy} Z`} strokeLinejoin="round" />;
  }
  if (kind === 'data') {
    const k = 12;
    return <path {...common} d={`M${x + k},${y} L${x + w},${y} L${x + w - k},${y + h} L${x},${y + h} Z`} strokeLinejoin="round" />;
  }
  const rx = kind === 'start' || kind === 'end' ? h / 2 : 10;
  return <rect {...common} x={x} y={y} width={w} height={h} rx={rx} />;
}

export function Flow({ props }: ElementProps<FlowProps>) {
  const L = useMemo(() => layoutFlow(props), [props]);
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const arrow = `oe-arrow-${uid}`;
  const paths = L.edges.map((e, i) => {
    const a = L.placed.get(e.from)!;
    const b = L.placed.get(e.to)!;
    const isBack = L.back.has(`${e.from}->${e.to}`);
    let p0: number[], p1: number[], p2: number[], p3: number[];
    if (isBack) {
      // Vuelta atrás: por debajo (LR) o por la derecha (TB), siempre punteada.
      if (L.lr) {
        p0 = [a.x + a.w / 2, a.y + a.h];
        p3 = [b.x + b.w / 2, b.y + b.h + 6];
        const dip = Math.max(p0[1], p3[1]) + 40;
        p1 = [p0[0], dip];
        p2 = [p3[0], dip];
      } else {
        p0 = [a.x + a.w, a.y + a.h / 2];
        p3 = [b.x + b.w + 6, b.y + b.h / 2];
        const out = Math.max(p0[0], p3[0]) + 48;
        p1 = [out, p0[1]];
        p2 = [out, p3[1]];
      }
    } else if (L.lr) {
      p0 = [a.x + a.w, a.y + a.h / 2];
      p3 = [b.x - 6, b.y + b.h / 2];
      const dx = (p3[0] - p0[0]) / 2;
      p1 = [p0[0] + dx, p0[1]];
      p2 = [p3[0] - dx, p3[1]];
    } else {
      p0 = [a.x + a.w / 2, a.y + a.h];
      p3 = [b.x + b.w / 2, b.y - 6];
      const dy = (p3[1] - p0[1]) / 2;
      p1 = [p0[0], p0[1] + dy];
      p2 = [p3[0], p3[1] - dy];
    }
    const d = `M${p0[0]},${p0[1]} C${p1[0]},${p1[1]} ${p2[0]},${p2[1]} ${p3[0]},${p3[1]}`;
    return { d, mid: bezierMid(p0, p1, p2, p3), e, dashed: e.dashed || isBack, key: i };
  });

  return (
    <div className="oe-flow" role="img" aria-label={`Diagrama: ${props.nodes.map((n) => n.label).join(', ')}`}>
      <svg width={L.width} height={L.height} viewBox={`0 0 ${L.width} ${L.height}`}>
        <defs>
          <marker id={arrow} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M1,1 L9,5 L1,9" className="oe-flow-arrow" />
          </marker>
        </defs>
        {paths.map((p) => (
          <path key={p.key} d={p.d} className={`oe-flow-edge${p.dashed ? ' oe-flow-edge--dashed' : ''}`} markerEnd={`url(#${arrow})`} />
        ))}
        {[...L.placed.values()].map((p) => (
          <g key={p.node.id}>
            <NodeShape p={p} />
            <text x={p.x + p.w / 2} y={p.y + p.h / 2} textAnchor="middle" className="oe-flow-label" data-kind={p.node.kind ?? 'process'}>
              {p.lines.map((l, i) => (
                <tspan key={i} x={p.x + p.w / 2} dy={i === 0 ? `${0.35 - (p.lines.length - 1) * 0.6}em` : '1.2em'}>
                  {l}
                </tspan>
              ))}
            </text>
          </g>
        ))}
        {paths
          .filter((p) => p.e.label)
          .map((p) => {
            const w = p.e.label!.length * 6.4 + 12;
            return (
              <g key={`l${p.key}`} className="oe-flow-edge-label">
                <rect x={p.mid[0] - w / 2} y={p.mid[1] - 10} width={w} height={20} rx={10} />
                <text x={p.mid[0]} y={p.mid[1]} dy="0.34em" textAnchor="middle">
                  {p.e.label}
                </text>
              </g>
            );
          })}
      </svg>
    </div>
  );
}

export function Timeline({ props }: ElementProps<PropsOf<'Timeline'>>) {
  return (
    <ol className="oe-timeline">
      {props.items.map((it, i) => (
        <li key={i} data-tone={it.tone ?? 'neutral'}>
          <span className="oe-timeline-dot" aria-hidden="true" />
          <div className="oe-timeline-body">
            {it.date && <time className="oe-timeline-date">{it.date}</time>}
            <span className="oe-timeline-title">{it.title}</span>
            {it.description && <span className="oe-timeline-desc">{it.description}</span>}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function Steps({ props }: ElementProps<PropsOf<'Steps'>>) {
  return (
    <ol className={`oe-steps oe-steps--${props.orientation ?? 'vertical'}`}>
      {props.steps.map((s, i) => {
        const st = s.status ?? 'pending';
        return (
          <li key={i} data-status={st} aria-current={st === 'active' ? 'step' : undefined}>
            <span className="oe-step-mark" aria-hidden="true">
              {st === 'done' ? <IconCheck size={14} /> : st === 'error' ? <IconX size={14} /> : i + 1}
            </span>
            <div className="oe-step-body">
              <span className="oe-step-title">{s.title}</span>
              {s.description && <span className="oe-step-desc">{s.description}</span>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
