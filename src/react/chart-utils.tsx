/**
 * Utilidades compartidas de gráficos.
 *
 * Regla de oro (issue #17 del widget): un SVG con texto se dibuja al ancho
 * REAL de su contenedor — el viewBox coincide con los píxeles —, así ni el
 * texto ni las barras se estiran nunca. Solo el sparkline (sin texto) se
 * estira, y su trazo no se deforma (`vector-effect: non-scaling-stroke`).
 */
import React, { useEffect, useRef, useState } from 'react';

/** Ancho del contenedor; `fallback` hasta poder medir (SSR, tests). */
export function useWidth<T extends HTMLElement>(fallback = 480): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const update = () => {
      const next = Math.round(el.clientWidth);
      if (next > 0) setW(next);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

/** Variable CSS de la serie i (1..8, cíclica). */
export const seriesColor = (i: number) => `var(--oe-chart-${(i % 8) + 1})`;

export const TONE_COLOR: Record<string, string> = {
  neutral: 'var(--oe-muted-foreground)',
  brand: 'var(--oe-primary)',
  info: 'var(--oe-info)',
  success: 'var(--oe-success)',
  warning: 'var(--oe-warning)',
  critical: 'var(--oe-critical)',
  noData: 'var(--oe-no-data)',
};

/** Ruta de una línea normalizada a un rectángulo. */
export function linePath(data: Array<number | null>, w: number, h: number, pad = 2): string {
  const vals = data.filter((v): v is number => typeof v === 'number');
  if (!vals.length) return '';
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const step = data.length > 1 ? (w - pad * 2) / (data.length - 1) : 0;
  let d = '';
  let pen = false;
  data.forEach((v, i) => {
    if (typeof v !== 'number') {
      pen = false;
      return;
    }
    const x = pad + i * step;
    const y = pad + (1 - (v - min) / range) * (h - pad * 2);
    d += `${pen ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
    pen = true;
  });
  return d;
}

/** Mini línea para Kpi y Sparkline. */
export function SparkLine({ data, color = 'currentColor', label }: { data: Array<number | null>; color?: string; label?: string }) {
  const d = linePath(data, 100, 28);
  return (
    <svg className="oe-spark" viewBox="0 0 100 28" preserveAspectRatio="none" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <path d={d} fill="none" stroke={color} className="oe-spark-line" />
    </svg>
  );
}

/** Recorta un texto a un número de caracteres con elipsis. */
export function truncate(text: string, max: number): string {
  const m = Math.max(3, Math.floor(max));
  return text.length > m ? `${text.slice(0, m - 1)}…` : text;
}

/** Ancho aproximado de un texto (px) para maquetar en SVG sin medir el DOM. */
export function textWidth(text: string, size = 12): number {
  return text.length * size * 0.56;
}
