import React, { useState } from 'react';
import type { ElementProps } from '../registry';
import type { PropsOf } from '../../catalog';
import { useOrbital } from '../context';
import { formatAxis, formatValue, niceTicks, type NumberFormat } from '../format';
import { SparkLine, TONE_COLOR, seriesColor, textWidth, truncate, useWidth } from '../chart-utils';

type ChartProps = PropsOf<'Chart'>;
type Fmt = { format?: NumberFormat; currency?: string; locale: string };

function Legend({ series }: { series: Array<{ name: string }> }) {
  return (
    <ul className="oe-legend">
      {series.map((s, i) => (
        <li key={i}>
          <span className="oe-swatch" style={{ background: seriesColor(i) }} aria-hidden="true" />
          {s.name}
        </li>
      ))}
    </ul>
  );
}

/** Tabla oculta con los datos: el gráfico es accesible para lectores de pantalla. */
function SrTable({ labels, series, f }: { labels: string[]; series: ChartProps['series']; f: Fmt }) {
  return (
    <table className="oe-sr-only">
      <thead>
        <tr>
          <th scope="col" />
          {series.map((s, i) => (
            <th key={i} scope="col">{s.name}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {labels.map((l, i) => (
          <tr key={i}>
            <th scope="row">{l}</th>
            {series.map((s, j) => (
              <td key={j}>{formatValue(s.data[i], f.format, f)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Tooltip({ x, width, label, rows }: { x: number; width: number; label: string; rows: Array<{ name: string; value: string; color: string }> }) {
  const left = Math.min(Math.max(8, x + 12), Math.max(8, width - 180));
  return (
    <div className="oe-tooltip" style={{ left }}>
      <div className="oe-tooltip-title">{label}</div>
      {rows.map((r, i) => (
        <div key={i} className="oe-tooltip-row">
          <span className="oe-swatch" style={{ background: r.color }} />
          <span className="oe-tooltip-name">{r.name}</span>
          <span className="oe-num">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

function Cartesian({ p, f }: { p: ChartProps; f: Fmt }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const H = p.height ?? 220;
  const n = p.labels.length;
  const series = p.series.map((s) => ({ ...s, data: p.labels.map((_, i) => s.data[i] ?? null) }));
  const stacked = p.kind === 'stacked-bar';
  const isBar = p.kind === 'bar' || stacked;
  const vals = stacked
    ? p.labels.map((_, i) => series.reduce((a, s) => a + Math.max(0, s.data[i] ?? 0), 0))
    : series.flatMap((s) => s.data.filter((v): v is number => typeof v === 'number'));
  const minV = Math.min(0, ...vals);
  const maxV = Math.max(0, ...vals);
  const ticks = niceTicks(minV, maxV, H < 180 ? 3 : 4);
  const lo = ticks[0];
  const hi = ticks[ticks.length - 1];
  const tickLabels = ticks.map((t) => formatAxis(t, f.format, f));
  const left = Math.max(28, ...tickLabels.map((t) => textWidth(t, 11) + 10));
  const pad = { top: 18, right: 12, bottom: 28, left };
  const innerW = Math.max(40, width - pad.left - pad.right);
  const innerH = H - pad.top - pad.bottom;
  const y = (v: number) => pad.top + (1 - (v - lo) / (hi - lo || 1)) * innerH;
  const band = innerW / Math.max(1, n);
  const xBand = (i: number) => pad.left + i * band;
  const xPoint = (i: number) => (n === 1 ? pad.left + innerW / 2 : pad.left + (i / (n - 1)) * innerW);
  const maxLabels = Math.max(1, Math.floor(innerW / 64));
  const every = Math.ceil(n / maxLabels);
  const labelChars = (band * every) / 6.4;
  const showValues = p.showValues ?? (isBar ? n * (stacked ? 1 : series.length) <= 12 && band >= 28 : n <= 12 && series.length === 1);
  const groupW = Math.min(band * 0.72, stacked ? 56 : 40 * series.length + 6 * (series.length - 1));
  const barW = stacked ? groupW : (groupW - 4 * (series.length - 1)) / series.length;

  const onMove = (e: React.MouseEvent<SVGRectElement>) => {
    const r = (e.currentTarget as SVGRectElement).getBoundingClientRect();
    const x = e.clientX - r.left;
    const i = isBar ? Math.floor(x / band) : Math.round((x / innerW) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };

  const hoverX = hover === null ? 0 : isBar ? xBand(hover) + band / 2 : xPoint(hover);

  return (
    <div ref={ref} className="oe-chart-canvas">
      <svg width={width} height={H} viewBox={`0 0 ${width} ${H}`} role="img" aria-label={p.title ?? series.map((s) => s.name).join(', ')}>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} className={t === 0 ? 'oe-axis-zero' : 'oe-grid-line'} />
            <text x={pad.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="oe-axis-label">
              {tickLabels[i]}
            </text>
          </g>
        ))}
        {hover !== null && isBar && <rect x={xBand(hover)} y={pad.top} width={band} height={innerH} className="oe-hover-band" />}
        {hover !== null && !isBar && <line x1={hoverX} x2={hoverX} y1={pad.top} y2={pad.top + innerH} className="oe-hover-line" />}

        {isBar &&
          p.labels.map((_, i) => {
            let acc = 0;
            const gx = xBand(i) + (band - groupW) / 2;
            return (
              <g key={i}>
                {series.map((s, j) => {
                  const v = s.data[i];
                  if (typeof v !== 'number') return null;
                  const base = stacked ? acc : 0;
                  const top = base + (stacked ? Math.max(0, v) : v);
                  if (stacked) acc = top;
                  const y0 = y(Math.max(base, top));
                  const h = Math.max(1, Math.abs(y(base) - y(top)));
                  const x = stacked ? gx : gx + j * (barW + 4);
                  const r = Math.min(4, barW / 3);
                  return (
                    <g key={j}>
                      <path d={roundedTop(x, y0, barW, h, stacked && j < series.length - 1 ? 0 : r, v < 0)} fill={seriesColor(j)} className="oe-bar" />
                      {showValues && !stacked && (
                        <text x={x + barW / 2} y={v >= 0 ? y0 - 5 : y0 + h + 12} textAnchor="middle" className="oe-value-label">
                          {formatValue(v, f.format, f)}
                        </text>
                      )}
                    </g>
                  );
                })}
                {showValues && stacked && (
                  <text x={gx + groupW / 2} y={y(acc) - 5} textAnchor="middle" className="oe-value-label">
                    {formatValue(acc, f.format, f)}
                  </text>
                )}
              </g>
            );
          })}

        {!isBar &&
          series.map((s, j) => {
            const pts = s.data.map((v, i) => (typeof v === 'number' ? ([xPoint(i), y(v)] as const) : null));
            const segs: string[] = [];
            let cur = '';
            pts.forEach((pt) => {
              if (!pt) {
                if (cur) segs.push(cur);
                cur = '';
                return;
              }
              cur += `${cur ? 'L' : 'M'}${pt[0].toFixed(1)},${pt[1].toFixed(1)}`;
            });
            if (cur) segs.push(cur);
            const valid = pts.filter((x): x is readonly [number, number] => !!x);
            const area =
              p.kind === 'area' && valid.length > 1
                ? `M${valid[0][0]},${y(Math.max(lo, 0))} ${valid.map(([a, b]) => `L${a.toFixed(1)},${b.toFixed(1)}`).join(' ')} L${valid[valid.length - 1][0]},${y(Math.max(lo, 0))} Z`
                : null;
            return (
              <g key={j} style={{ color: seriesColor(j) }}>
                {area && <path d={area} className="oe-area" />}
                {segs.map((d, k) => (
                  <path key={k} d={d} className="oe-line" />
                ))}
                {valid.length <= 24 &&
                  pts.map((pt, i) =>
                    pt ? <circle key={i} cx={pt[0]} cy={pt[1]} r={hover === i ? 4.5 : 3} className="oe-dot" /> : null,
                  )}
                {showValues &&
                  pts.map((pt, i) =>
                    pt ? (
                      <text key={`v${i}`} x={pt[0]} y={pt[1] - 9} textAnchor="middle" className="oe-value-label">
                        {formatValue(s.data[i], f.format, f)}
                      </text>
                    ) : null,
                  )}
              </g>
            );
          })}

        {p.labels.map((l, i) =>
          i % every === 0 || i === n - 1 ? (
            <text key={i} x={isBar ? xBand(i) + band / 2 : xPoint(i)} y={H - 8} textAnchor="middle" className="oe-axis-label">
              {truncate(l, labelChars)}
            </text>
          ) : null,
        )}
        <rect
          x={pad.left}
          y={pad.top}
          width={innerW}
          height={innerH}
          fill="transparent"
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        />
      </svg>
      {hover !== null && (
        <Tooltip
          x={hoverX}
          width={width}
          label={p.labels[hover]}
          rows={series.map((s, j) => ({ name: s.name, value: formatValue(s.data[hover], f.format, f), color: seriesColor(j) }))}
        />
      )}
    </div>
  );
}

/** Barra con las esquinas superiores (o inferiores si es negativa) redondeadas. */
function roundedTop(x: number, y: number, w: number, h: number, r: number, negative: boolean): string {
  r = Math.max(0, Math.min(r, w / 2, h));
  if (!negative)
    return `M${x},${y + h} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${y + h} Z`;
  return `M${x},${y} L${x + w},${y} L${x + w},${y + h - r} Q${x + w},${y + h} ${x + w - r},${y + h} L${x + r},${y + h} Q${x},${y + h} ${x},${y + h - r} Z`;
}

function HBar({ p, f }: { p: ChartProps; f: Fmt }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const series = p.series;
  const n = p.labels.length;
  const rowH = 14 * series.length + 4 * (series.length - 1);
  const gap = 14;
  const labelW = Math.min(width * 0.38, Math.max(...p.labels.map((l) => textWidth(l, 12))) + 12);
  const valueW = 56;
  const innerW = Math.max(40, width - labelW - valueW - 8);
  const all = series.flatMap((s) => s.data.filter((v): v is number => typeof v === 'number'));
  const max = Math.max(0, ...all) || 1;
  const H = n * (rowH + gap) + 4;
  return (
    <div ref={ref} className="oe-chart-canvas">
      <svg width={width} height={H} viewBox={`0 0 ${width} ${H}`} role="img" aria-label={p.title ?? 'Gráfico de barras'}>
        {p.labels.map((l, i) => {
          const top = i * (rowH + gap) + 2;
          return (
            <g key={i}>
              <text x={labelW - 10} y={top + rowH / 2} dy="0.32em" textAnchor="end" className="oe-axis-label oe-axis-label--strong">
                {truncate(l, (labelW - 10) / 6.4)}
              </text>
              {series.map((s, j) => {
                const v = s.data[i];
                if (typeof v !== 'number') return null;
                const w = Math.max(2, (Math.max(0, v) / max) * innerW);
                const yy = top + j * 18;
                return (
                  <g key={j}>
                    <rect x={labelW} y={yy} width={innerW} height={14} rx={4} className="oe-track" />
                    <rect x={labelW} y={yy} width={w} height={14} rx={4} fill={seriesColor(j)} className="oe-bar" />
                    <text x={labelW + w + 6} y={yy + 7} dy="0.32em" className="oe-value-label">
                      {formatValue(v, f.format, f)}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function Donut({ p, f }: { p: ChartProps; f: Fmt }) {
  const [hover, setHover] = useState<number | null>(null);
  const data = p.labels.map((l, i) => ({ label: l, value: Math.max(0, p.series[0]?.data[i] ?? 0) })).filter((d) => d.value > 0);
  const total = data.reduce((a, d) => a + d.value, 0) || 1;
  const R = 70;
  const r = p.kind === 'donut' ? 46 : 0;
  let angle = -Math.PI / 2;
  const arcs = data.map((d, i) => {
    const a0 = angle;
    const a1 = angle + (d.value / total) * Math.PI * 2;
    angle = a1;
    return { ...d, i, path: arc(80, 80, R + (hover === i ? 4 : 0), r, a0, a1) };
  });
  const focus = hover !== null ? data[hover] : null;
  return (
    <div className="oe-donut">
      <svg viewBox="0 0 160 160" className="oe-donut-svg" role="img" aria-label={p.title ?? 'Reparto'}>
        {arcs.map((a) => (
          <path
            key={a.i}
            d={a.path}
            fill={seriesColor(a.i)}
            className="oe-slice"
            onMouseEnter={() => setHover(a.i)}
            onMouseLeave={() => setHover(null)}
          />
        ))}
        {p.kind === 'donut' && (
          <>
            <text x="80" y="76" textAnchor="middle" className="oe-donut-total">
              {formatValue(focus ? focus.value : total, f.format === 'percent' ? undefined : f.format, f)}
            </text>
            <text x="80" y="94" textAnchor="middle" className="oe-donut-caption">
              {focus ? truncate(focus.label, 14) : 'Total'}
            </text>
          </>
        )}
      </svg>
      <ul className="oe-donut-legend">
        {data.map((d, i) => (
          <li key={i} data-active={hover === i ? 'true' : undefined} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <span className="oe-swatch" style={{ background: seriesColor(i) }} aria-hidden="true" />
            <span className="oe-donut-label">{d.label}</span>
            <span className="oe-donut-value oe-num">{formatValue(d.value, f.format, f)}</span>
            <span className="oe-donut-pct oe-num">{Math.round((d.value / total) * 100)} %</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function arc(cx: number, cy: number, R: number, r: number, a0: number, a1: number): string {
  const full = a1 - a0 >= Math.PI * 2 - 1e-6;
  if (full) a1 = a0 + Math.PI * 2 - 1e-4;
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const p = (rad: number, a: number) => `${(cx + rad * Math.cos(a)).toFixed(2)},${(cy + rad * Math.sin(a)).toFixed(2)}`;
  if (r <= 0) return `M${cx},${cy} L${p(R, a0)} A${R},${R} 0 ${large} 1 ${p(R, a1)} Z`;
  return `M${p(R, a0)} A${R},${R} 0 ${large} 1 ${p(R, a1)} L${p(r, a1)} A${r},${r} 0 ${large} 0 ${p(r, a0)} Z`;
}

export function Chart({ props }: ElementProps<ChartProps>) {
  const { locale } = useOrbital();
  const f: Fmt = { format: props.format, currency: props.currency, locale };
  const radial = props.kind === 'donut' || props.kind === 'pie';
  return (
    <figure className="oe-chart" data-kind={props.kind}>
      {props.title && <figcaption className="oe-chart-title">{props.title}</figcaption>}
      {radial ? <Donut p={props} f={f} /> : props.kind === 'hbar' ? <HBar p={props} f={f} /> : <Cartesian p={props} f={f} />}
      {!radial && props.series.length > 1 && <Legend series={props.series} />}
      <SrTable labels={props.labels} series={props.series} f={f} />
    </figure>
  );
}

export function Sparkline({ props }: ElementProps<PropsOf<'Sparkline'>>) {
  const first = props.data[0];
  const last = props.data[props.data.length - 1];
  const color = props.tone ? TONE_COLOR[props.tone] : last >= first ? 'var(--oe-chart-1)' : TONE_COLOR.critical;
  return (
    <span className="oe-sparkline">
      <SparkLine data={props.data} color={color} label={props.label} />
    </span>
  );
}

export function Heatmap({ props }: ElementProps<PropsOf<'Heatmap'>>) {
  const { locale } = useOrbital();
  const all = props.values.flat().filter((v): v is number => typeof v === 'number');
  const min = Math.min(...all);
  const max = Math.max(...all);
  const diverging = props.scale === 'diverging';
  const mid = diverging ? Math.max(Math.abs(min), Math.abs(max)) || 1 : 0;
  const cell = (v: number | null | undefined) => {
    if (typeof v !== 'number') return { background: 'var(--oe-no-data-soft)', color: 'var(--oe-no-data)' };
    if (diverging) {
      const t = Math.min(1, Math.abs(v) / mid);
      const c = v >= 0 ? 'var(--oe-success)' : 'var(--oe-critical)';
      return { background: `color-mix(in oklch, ${c} ${Math.round(t * 85)}%, var(--oe-card))`, color: t > 0.55 ? 'var(--oe-card)' : 'var(--oe-foreground)' };
    }
    const t = (v - min) / (max - min || 1);
    return { background: `color-mix(in oklch, var(--oe-chart-1) ${Math.round(8 + t * 87)}%, var(--oe-card))`, color: t > 0.55 ? 'var(--oe-card)' : 'var(--oe-foreground)' };
  };
  return (
    <div className="oe-table-wrap">
      <table className="oe-heatmap">
        <thead>
          <tr>
            <th />
            {props.columns.map((c, i) => (
              <th key={i} scope="col">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {props.rows.map((r, i) => (
            <tr key={i}>
              <th scope="row">{r}</th>
              {props.columns.map((_, j) => {
                const v = props.values[i]?.[j];
                return (
                  <td key={j} style={cell(v)} className="oe-num">
                    {formatValue(v ?? null, props.format, { locale })}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
