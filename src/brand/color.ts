/**
 * Núcleo de color en OKLCH (perceptual): parseo seguro, escalas 50–950,
 * variaciones de tono y ajuste por contraste WCAG.
 *
 * Origen: `orbital-documents/src/v2/componentes/color/escala.ts` (escala y
 * variar) y `qratia-portal-partner/src/lib/marca/tema.ts` (ajuste de la
 * luminosidad hasta cumplir contraste contra varias superficies). Se unifican
 * aquí para que backend y frontales calculen con la MISMA fórmula.
 *
 * Todo es puro y sin E/S. La salida es siempre un hex `#rrggbb` normalizado:
 * un valor de entrada nunca llega crudo a CSS, SVG ni OOXML.
 */
import { clampChroma, converter, formatHex, parse, wcagContrast, type Oklch } from 'culori';

const toOklch = converter('oklch');

export type { Oklch };

/** Pasos de la escala (convención Tailwind v4). */
export const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
export type Step = (typeof STEPS)[number];
export type Scale = Record<Step, string>;

/** Luminosidad OKLCH objetivo por paso (curva tipo Tailwind v4). */
const STEP_L: Record<Step, number> = {
  50: 0.975, 100: 0.94, 200: 0.885, 300: 0.81, 400: 0.71, 500: 0.62,
  600: 0.54, 700: 0.465, 800: 0.39, 900: 0.32, 950: 0.24,
};
/** Factor de croma por paso: los extremos pierden saturación. */
const STEP_C: Record<Step, number> = {
  50: 0.12, 100: 0.25, 200: 0.45, 300: 0.7, 400: 0.9, 500: 1,
  600: 1, 700: 0.92, 800: 0.8, 900: 0.68, 950: 0.55,
};

const HEX = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/** WCAG 2.1: texto corriente (AA) y elementos de interfaz o gráficos. */
export const CONTRAST_TEXT = 4.5;
export const CONTRAST_UI = 3;

/**
 * Color de entrada → OKLCH dentro de sRGB, o `null` si no es válido.
 * Acepta hex (#rgb, #rrggbb, con o sin alfa, que se ignora) y, por comodidad,
 * `rgb()`, `hsl()` y `oklch()`. Nunca nombres CSS arbitrarios ni `url()`.
 */
export function parseColor(value: unknown): Oklch | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (!v || v.length > 64) return null;
  if (!HEX.test(v) && !/^(rgb|rgba|hsl|hsla|oklch)\([\d\s.,%/+-]+\)$/i.test(v)) return null;
  const c = toOklch(parse(v));
  if (!c || Number.isNaN(c.l)) return null;
  // Un gris no tiene tono: croma 0 y tono 0 (evita tonos aleatorios por redondeo).
  return c.c < 0.012 ? { mode: 'oklch', l: c.l, c: 0, h: 0 } : { mode: 'oklch', l: c.l, c: c.c, h: c.h ?? 0 };
}

/** Normaliza a `#rrggbb` o devuelve `null`. */
export function normalizeHex(value: unknown): string | null {
  const c = parseColor(value);
  return c ? hex(c) : null;
}

/** OKLCH → `#rrggbb`, recortando la croma al gamut sRGB (conserva L y H). */
export function hex(c: Oklch): string {
  return formatHex(clampChroma(c, 'oklch'))!;
}

/**
 * El color tal como se va a PINTAR: redondeado a hex y vuelto a OKLCH.
 * Toda comprobación de contraste se hace sobre esto; medir sobre el valor
 * continuo da 4.50 y el hex final 4.48 (el redondeo a 8 bits resta).
 */
export function quantize(c: Oklch): Oklch {
  return (toOklch(parse(hex(c))) as Oklch) ?? c;
}

const q = (b: string | Oklch): string | Oklch => (typeof b === 'string' ? b : quantize(b));

/** Construye un color OKLCH acotado. */
export function oklch(l: number, c: number, h: number): Oklch {
  return { mode: 'oklch', l: clamp01(l), c: Math.max(0, c), h: ((h % 360) + 360) % 360 };
}

export function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/** Contraste WCAG entre dos colores (hex u OKLCH). */
export function contrast(a: string | Oklch, b: string | Oklch): number {
  return wcagContrast(a, b);
}

/** Distancia angular entre dos tonos (0–180). */
export function hueDistance(a: number, b: number): number {
  const d = Math.abs((((a - b) % 360) + 360) % 360);
  return d > 180 ? 360 - d : d;
}

/** Escala 50–950 conservando el tono y la croma del color base. */
export function scale(base: Oklch, chromaBoost = 1): Scale {
  const out = {} as Scale;
  for (const s of STEPS) out[s] = hex(oklch(STEP_L[s], base.c * STEP_C[s] * chromaBoost, base.h ?? 0));
  return out;
}

/** Variante del mismo color con otra luminosidad, croma o tono. */
export function vary(base: Oklch, d: { l?: number; c?: number; dh?: number }): Oklch {
  return oklch(d.l ?? base.l, d.c ?? base.c, (base.h ?? 0) + (d.dh ?? 0));
}

/**
 * Desde la luminosidad `l0`, avanza en pasos de `step` hasta que el color
 * contrasta al menos `min` contra TODOS los fondos. Si se sale de [0, 1] sin
 * conseguirlo devuelve `null` (quien llama decide el plan B).
 */
export function adjustForContrast(
  base: { c: number; h: number },
  l0: number,
  step: number,
  backgrounds: Array<string | Oklch>,
  min: number,
): Oklch | null {
  const bgs = backgrounds.map(q);
  for (let l = l0; l >= 0 && l <= 1; l += step) {
    const candidate = quantize(oklch(l, base.c, base.h));
    if (bgs.every((b) => contrast(candidate, b) >= min)) return candidate;
  }
  return null;
}

/**
 * Lleva el color hacia el extremo que dé contraste (oscurecer en fondos
 * claros, aclarar en oscuros) SOLO lo necesario. Siempre devuelve algo: en el
 * peor caso, negro o blanco.
 */
export function ensureContrast(color: Oklch, backgrounds: Array<string | Oklch>, min: number): Oklch {
  const painted = quantize(color);
  if (backgrounds.map(q).every((b) => contrast(painted, b) >= min)) return painted;
  const bgL = average(backgrounds.map((b) => (typeof b === 'string' ? parseColor(b)?.l ?? 0.5 : b.l)));
  const dir = bgL > 0.5 ? -0.005 : 0.005;
  const found = adjustForContrast({ c: color.c, h: color.h ?? 0 }, color.l, dir, backgrounds, min);
  if (found) return found;
  return bgL > 0.5 ? oklch(0, 0, 0) : oklch(1, 0, 0);
}

/** Texto legible sobre un fondo: el de la familia indicada que dé contraste, o blanco/negro. */
export function readableOn(background: Oklch, preferLight: Oklch, preferDark: Oklch, min = CONTRAST_TEXT): Oklch {
  background = quantize(background);
  preferLight = quantize(preferLight);
  preferDark = quantize(preferDark);
  const light = contrast(preferLight, background);
  const dark = contrast(preferDark, background);
  if (light >= min && light >= dark) return preferLight;
  if (dark >= min) return preferDark;
  if (light >= min) return preferLight;
  return contrast('#ffffff', background) >= contrast('#000000', background) ? oklch(1, 0, 0) : oklch(0, 0, 0);
}

function average(ns: number[]): number {
  return ns.reduce((a, n) => a + n, 0) / (ns.length || 1);
}

/** OKLCH redondeado para CSS (`oklch(L C H)`), estable entre plataformas. */
export function toOklchCss(color: string | Oklch): string {
  const c = typeof color === 'string' ? parseColor(color) : color;
  if (!c) return 'oklch(0 0 0)';
  const k = clampChroma(c, 'oklch') as Oklch;
  return `oklch(${round(k.l, 3)} ${round(k.c, 3)} ${round(k.h ?? 0, 1)})`;
}

function round(n: number, d: number): number {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}
