/**
 * Tema completo a partir de UN color primario.
 *
 * Lenguaje visual: el sistema de Qratia (`qratia-ui/src/theme.css` +
 * `DESIGN.md`), generalizado a cualquier marca:
 *  - Tres niveles de superficie (lienzo → tarjeta → incrustado) que se
 *    distinguen por su color, no por el borde. El lienzo NO es blanco puro.
 *  - El color de marca se usa con su PAPEL: acción sólida, tinte de
 *    superficie, enlace y foco son tokens distintos, y cada uno se ajusta
 *    hasta cumplir WCAG contra su superficie. Un amarillo de marca como texto
 *    sería ilegible: el enlace sale de su tono, no de su hex.
 *  - Estados con significado (crítico, aviso, correcto, info, sin dato) con
 *    color pleno + suave. Nunca se tiñen con la marca: un rojo es un rojo.
 *  - Series de gráficas: la primera es la marca; el resto, la paleta
 *    validada de Qratia, sin repetir el tono de la marca.
 *  - Oscuro: gris elevado (no negro), el mismo sistema leído al revés.
 *
 * Puro y sin E/S. Si la entrada no es válida, lanza `BrandError`.
 */
import {
  CONTRAST_TEXT,
  CONTRAST_UI,
  adjustForContrast,
  contrast,
  ensureContrast,
  hex,
  hueDistance,
  oklch,
  parseColor,
  quantize,
  readableOn,
  scale,
  type Oklch,
  type Scale,
} from './color';

export type Harmony = 'complementary' | 'analogous' | 'triadic' | 'split-complementary' | 'tetradic' | 'monochrome';
export type Mode = 'light' | 'dark';

export interface BrandInput {
  /** Color de marca (hex, rgb(), hsl() u oklch()). Es lo único obligatorio. */
  primary: string;
  /** Acento explícito; si falta, sale de la armonía. */
  accent?: string;
  /** Regla para derivar el acento y la paleta armónica. Por defecto, complementario. */
  harmony?: Harmony;
  /**
   * `brand` (por defecto): la acción sólida es el color de marca.
   * `ink`: la acción sólida es la tinta oscura y la marca actúa de acento
   * (el reparto de Qratia; útil con marcas muy claras o muy saturadas).
   */
  strategy?: 'brand' | 'ink';
  /** Neutros tintados con el tono de la marca (por defecto) o grises puros. */
  neutral?: 'tinted' | 'pure';
  /** Redondez: preset o radio base en px. Por defecto `md` (10 px). */
  radius?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | number;
  /** Densidad del espaciado. */
  density?: 'compact' | 'comfortable';
  /** Familia tipográfica principal (texto CSS, se valida). */
  font?: string;
}

export const ROLE_NAMES = [
  'background', 'foreground',
  'card', 'cardForeground',
  'inset', 'insetForeground',
  'popover', 'popoverForeground',
  'primary', 'primaryForeground', 'primaryHover', 'primaryActive',
  'primarySoft', 'primarySoftForeground',
  'secondary', 'secondaryForeground',
  'muted', 'mutedForeground',
  'accent', 'accentForeground',
  'highlight', 'highlightForeground', 'highlightSoft', 'highlightSoftForeground',
  'brand',
  'link', 'linkHover',
  'border', 'borderStrong', 'input', 'ring',
  'destructive', 'destructiveForeground',
  'critical', 'criticalSoft',
  'warning', 'warningSoft',
  'success', 'successSoft',
  'info', 'infoSoft',
  'noData', 'noDataSoft',
  'chart1', 'chart2', 'chart3', 'chart4', 'chart5', 'chart6', 'chart7', 'chart8',
  'shadow',
] as const;
export type RoleName = (typeof ROLE_NAMES)[number];
export type Roles = Record<RoleName, string>;

export interface Shape {
  radius: number;
  radii: { none: number; sm: number; md: number; lg: number; xl: number; '2xl': number; full: number };
  space: number;
}

export interface Typography {
  fontSans: string;
  fontMono: string;
  /** Escala en px (cuerpo = `base`). */
  size: { xs: number; sm: number; base: number; lg: number; xl: number; '2xl': number; '3xl': number };
  weight: { regular: number; medium: number; semibold: number; bold: number };
  leading: { tight: number; normal: number; relaxed: number };
}

export interface Motion {
  fast: string;
  base: string;
  slow: string;
  ease: string;
}

export interface Theme {
  input: Required<Omit<BrandInput, 'accent' | 'font'>> & { accent?: string; font?: string };
  /** Marca normalizada (`#rrggbb`). */
  brand: string;
  scales: { primary: Scale; neutral: Scale; highlight: Scale };
  harmony: { type: Harmony; colors: string[] };
  light: Roles;
  dark: Roles;
  shape: Shape;
  typography: Typography;
  motion: Motion;
  /** Ajustes hechos para cumplir contraste (para mostrar al usuario del panel). */
  warnings: string[];
}

export class BrandError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BrandError';
  }
}

const HARMONY_OFFSETS: Record<Harmony, number[]> = {
  complementary: [180],
  analogous: [30, -30],
  triadic: [120, 240],
  'split-complementary': [150, 210],
  tetradic: [90, 180, 270],
  monochrome: [],
};

const RADIUS_PRESETS = { none: 0, sm: 6, md: 10, lg: 14, xl: 18 } as const;

/**
 * Paleta categórica de Qratia (`theme.css`, validada para daltonismo,
 * croma y separación), en OKLCH, ampliada a 8 tonos. El ORDEN es estable.
 */
const CHART_BASE: Array<{ l: number; c: number; h: number }> = [
  { l: 0.58, c: 0.16, h: 255 }, // azul
  { l: 0.66, c: 0.18, h: 42 }, // naranja
  { l: 0.65, c: 0.14, h: 163 }, // verde agua
  { l: 0.76, c: 0.16, h: 75 }, // amarillo
  { l: 0.7, c: 0.14, h: 355 }, // magenta
  { l: 0.56, c: 0.17, h: 300 }, // violeta
  { l: 0.68, c: 0.11, h: 215 }, // cian
  { l: 0.56, c: 0.09, h: 105 }, // oliva
];

/** Estados (Qratia): tono fijo; la luminosidad la ajusta el contraste. */
const STATUS = {
  critical: { h: 27, light: { l: 0.5, c: 0.2, sl: 0.94, sc: 0.035 }, dark: { l: 0.7, c: 0.17, sl: 0.28, sc: 0.07 } },
  warning: { h: 65, light: { l: 0.52, c: 0.12, sl: 0.94, sc: 0.05 }, dark: { l: 0.78, c: 0.13, sl: 0.3, sc: 0.06 } },
  success: { h: 152, light: { l: 0.5, c: 0.13, sl: 0.93, sc: 0.04 }, dark: { l: 0.74, c: 0.14, sl: 0.28, sc: 0.06 } },
  info: { h: 231, light: { l: 0.49, c: 0.105, sl: 0.94, sc: 0.03 }, dark: { l: 0.82, c: 0.1, sl: 0.28, sc: 0.055 } },
} as const;

const FONT_SAFE = /^[\w\s'",.-]{1,200}$/;

export function createTheme(input: BrandInput): Theme {
  const parsed = parseColor(input?.primary);
  const base = parsed ? quantize(parsed) : null;
  if (!base) throw new BrandError('primary no es un color válido (usa #RGB, #RRGGBB, rgb(), hsl() u oklch())');

  const accentIn = input.accent ? parseColor(input.accent) : null;
  if (input.accent && !accentIn) throw new BrandError('accent no es un color válido');
  if (input.font && !FONT_SAFE.test(input.font)) throw new BrandError('font contiene caracteres no permitidos');

  const opts: Theme['input'] = {
    primary: hex(base),
    accent: accentIn ? hex(accentIn) : undefined,
    harmony: input.harmony ?? 'complementary',
    strategy: input.strategy ?? 'brand',
    neutral: input.neutral ?? 'tinted',
    radius: input.radius ?? 'md',
    density: input.density ?? 'comfortable',
    font: input.font,
  };
  if (!(opts.harmony in HARMONY_OFFSETS)) throw new BrandError(`harmony desconocida: ${opts.harmony}`);

  const warnings: string[] = [];
  const h = base.h ?? 0;
  const chromatic = base.c >= 0.02;

  // Armonía: tonos con la luminosidad/croma de la marca.
  const harmonyHues = HARMONY_OFFSETS[opts.harmony].map((o) => h + o);
  const harmonyColors = harmonyHues.map((hh) => hex(oklch(base.l, base.c, hh)));
  const highlightBase: Oklch = accentIn ?? (harmonyHues.length ? oklch(base.l, Math.max(base.c, 0.08), harmonyHues[0]) : base);

  const light = buildRoles('light', base, highlightBase, opts, warnings);
  const dark = buildRoles('dark', base, highlightBase, opts, warnings);

  const radius = typeof opts.radius === 'number' ? Math.max(0, Math.min(32, opts.radius)) : RADIUS_PRESETS[opts.radius];
  const space = opts.density === 'compact' ? 3.5 : 4;

  return {
    input: opts,
    brand: hex(base),
    scales: {
      primary: scale(base),
      neutral: scale(oklch(0.6, chromatic && opts.neutral === 'tinted' ? Math.min(base.c * 0.25, 0.03) : 0, h)),
      highlight: scale(highlightBase),
    },
    harmony: { type: opts.harmony, colors: harmonyColors },
    light,
    dark,
    shape: {
      radius,
      radii: {
        none: 0,
        sm: Math.max(0, radius - 4),
        md: Math.max(0, radius - 2),
        lg: radius,
        xl: radius + 6,
        '2xl': radius + 8,
        full: 9999,
      },
      space,
    },
    typography: {
      fontSans: opts.font
        ? `${opts.font}, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`
        : "'Instrument Sans', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      fontMono: "ui-monospace, 'SF Mono', 'Cascadia Code', Menlo, monospace",
      size: { xs: 12, sm: 13, base: 14, lg: 16, xl: 20, '2xl': 24, '3xl': 30 },
      weight: { regular: 400, medium: 500, semibold: 600, bold: 700 },
      leading: { tight: 1.2, normal: 1.5, relaxed: 1.65 },
    },
    motion: { fast: '120ms', base: '180ms', slow: '280ms', ease: 'cubic-bezier(0.2, 0, 0, 1)' },
    warnings: [...new Set(warnings)],
  };
}

function buildRoles(mode: Mode, base: Oklch, highlightBase: Oklch, opts: Theme['input'], warnings: string[]): Roles {
  const isLight = mode === 'light';
  const h = base.h ?? 0;
  const bc = base.c;
  const tint = opts.neutral === 'tinted' && bc >= 0.02;
  // Croma de los neutros: un susurro del tono de marca (Qratia ≈ 0.011–0.05).
  const n = (c: number) => (tint ? Math.min(c, bc * 0.6) : 0);
  /** Superficie tal como se pinta (hex). */
  const S = (l: number, c: number) => quantize(oklch(l, c, h));

  // ── Neutros y superficies ──
  const ink = S(0.186, n(0.045));
  const background = isLight ? S(0.967, n(0.011)) : S(0.186, n(0.04));
  const card = isLight ? oklch(1, 0, 0) : S(0.229, n(0.045));
  const inset = isLight ? S(0.98, n(0.007)) : S(0.205, n(0.042));
  const popover = isLight ? S(0.982, n(0.008)) : S(0.262, n(0.045));
  const foreground = isLight ? ink : S(0.952, n(0.013));
  const muted = isLight ? S(0.941, n(0.016)) : S(0.262, n(0.042));
  const secondary = isLight ? S(0.941, n(0.016)) : S(0.275, n(0.042));
  const secondaryForeground = isLight ? S(0.271, n(0.05)) : foreground;
  const surfaces = [background, card, inset, muted];
  const mutedForeground = ensureContrast(isLight ? S(0.524, n(0.044)) : S(0.711, n(0.041)), surfaces, CONTRAST_TEXT);
  const border = isLight ? S(0.92, n(0.017)) : S(0.32, n(0.04));
  const borderStrong = isLight ? S(0.86, n(0.022)) : S(0.38, n(0.045));
  // El límite de un CONTROL es información: WCAG le exige 3:1.
  const input = ensureContrast(isLight ? S(0.62, n(0.045)) : S(0.5, n(0.05)), [card, background], CONTRAST_UI);

  // ── Acción sólida (primary) ──
  const light = quantize(oklch(1, 0, 0));
  let primary: Oklch;
  let primaryForeground: Oklch;
  if (opts.strategy === 'ink') {
    primary = isLight ? ink : ensureContrast(oklch(Math.max(base.l, 0.78), bc, h), [background], CONTRAST_TEXT);
    primaryForeground = isLight ? light : background;
  } else if (isLight) {
    if (contrast(light, base) >= CONTRAST_TEXT) {
      primary = base;
      primaryForeground = light;
    } else if (base.l >= 0.7 && contrast(ink, base) >= CONTRAST_TEXT) {
      // Marca clara (amarillo, lima…): se respeta el color y lleva tinta encima.
      primary = base;
      primaryForeground = ink;
    } else {
      primary = adjustForContrast({ c: bc, h }, base.l, -0.005, [light], CONTRAST_TEXT) ?? ink;
      primaryForeground = light;
      warnings.push('primary: oscurecido para que el texto blanco del botón cumpla 4.5:1');
    }
  } else {
    // Oscuro: la acción es la marca CLARA con texto del color del lienzo.
    const start = quantize(oklch(Math.max(base.l, 0.7), bc, h));
    primary = contrast(background, start) >= CONTRAST_TEXT ? start : ensureContrast(start, [background], CONTRAST_TEXT);
    primaryForeground = background;
  }
  const hoverStep = isLight ? -0.05 : 0.05;
  const primaryHover = quantize(oklch(primary.l + hoverStep, primary.c, primary.h ?? h));
  const primaryActive = quantize(oklch(primary.l + hoverStep * 1.8, primary.c, primary.h ?? h));

  // ── Tinte de superficie (selección, activo, hover) ──
  const primarySoft = quantize(isLight ? oklch(0.945, Math.min(bc, 0.035), h) : oklch(0.3, Math.min(bc, 0.055), h));
  const primarySoftForeground =
    adjustForContrast({ c: bc, h }, isLight ? 0.45 : 0.88, isLight ? -0.01 : 0.01, [primarySoft], CONTRAST_TEXT) ??
    foreground;

  // ── Acento armónico (decoración, chips, segundo color de marca) ──
  const hh = highlightBase.h ?? h;
  const hc = Math.max(highlightBase.c, 0.06);
  const highlight = ensureContrast(oklch(isLight ? Math.min(highlightBase.l, 0.62) : Math.max(highlightBase.l, 0.72), hc, hh), [card], CONTRAST_UI);
  const highlightForeground = readableOn(highlight, light, ink);
  const highlightSoft = quantize(isLight ? oklch(0.945, Math.min(hc, 0.04), hh) : oklch(0.3, Math.min(hc, 0.06), hh));
  const highlightSoftForeground =
    adjustForContrast({ c: hc, h: hh }, isLight ? 0.45 : 0.86, isLight ? -0.01 : 0.01, [highlightSoft], CONTRAST_TEXT) ??
    foreground;

  // ── Enlace y foco: del TONO de la marca, con contraste de texto ──
  const linkTone = { c: Math.max(bc, chromaFloor(bc)), h };
  const link =
    adjustForContrast(linkTone, isLight ? 0.53 : 0.85, isLight ? -0.01 : 0.01, [card, background, inset], CONTRAST_TEXT) ??
    foreground;
  const linkHover = oklch(link.l + (isLight ? -0.08 : 0.05), link.c, link.h ?? h);
  const ring = ensureContrast(link, [card, background], CONTRAST_UI);

  // ── Estados ──
  const status = (k: keyof typeof STATUS) => {
    const s = STATUS[k];
    const v = isLight ? s.light : s.dark;
    const soft = quantize(oklch(v.sl, v.sc, s.h));
    const full = ensureContrast(oklch(v.l, v.c, s.h), [card, background, soft], CONTRAST_TEXT);
    return { full, soft };
  };
  const critical = status('critical');
  const warning = status('warning');
  const success = status('success');
  const info = status('info');
  const noDataSoft = isLight ? S(0.935, n(0.014)) : S(0.265, n(0.035));
  const noData = ensureContrast(isLight ? S(0.518, n(0.03)) : S(0.7, n(0.03)), [card, background, noDataSoft], CONTRAST_TEXT);
  const destructiveForeground = readableOn(critical.full, light, ink);

  // ── Series de gráficas ──
  const charts = chartPalette(base, card, isLight);

  // ── Sombra: tintada con la tinta (Qratia), no negra ──
  const shadow = isLight ? S(0.186, n(0.045)) : S(0.08, n(0.02));

  const r: Record<RoleName, Oklch> = {
    background, foreground,
    card, cardForeground: foreground,
    inset, insetForeground: foreground,
    popover, popoverForeground: foreground,
    primary, primaryForeground, primaryHover, primaryActive,
    primarySoft, primarySoftForeground,
    secondary, secondaryForeground,
    muted, mutedForeground,
    accent: primarySoft, accentForeground: primarySoftForeground,
    highlight, highlightForeground, highlightSoft, highlightSoftForeground,
    brand: base,
    link, linkHover,
    border, borderStrong, input, ring,
    destructive: critical.full, destructiveForeground,
    critical: critical.full, criticalSoft: critical.soft,
    warning: warning.full, warningSoft: warning.soft,
    success: success.full, successSoft: success.soft,
    info: info.full, infoSoft: info.soft,
    noData, noDataSoft,
    chart1: charts[0], chart2: charts[1], chart3: charts[2], chart4: charts[3],
    chart5: charts[4], chart6: charts[5], chart7: charts[6], chart8: charts[7],
    shadow,
  };
  const out = {} as Roles;
  for (const k of ROLE_NAMES) out[k] = hex(r[k]);
  return out;
}

/** Un gris de marca no tiene tono que dar a un enlace: se le da un mínimo de croma. */
function chromaFloor(bc: number): number {
  return bc < 0.02 ? 0 : 0.06;
}

/**
 * Serie 1 = la marca (ajustada a 3:1 contra la tarjeta). Series 2–8 = la
 * paleta Qratia SIN el tono que ya ocupa la marca, cada una con 3:1 contra la
 * tarjeta (WCAG 1.4.11: un gráfico es información).
 */
function chartPalette(base: Oklch, card: Oklch, isLight: boolean): Oklch[] {
  const h = base.h ?? 0;
  const chromatic = base.c >= 0.04;
  const first = chromatic
    ? ensureContrast(oklch(isLight ? Math.min(Math.max(base.l, 0.45), 0.66) : Math.max(base.l, 0.68), Math.max(base.c, 0.1), h), [card], CONTRAST_UI)
    : null;
  const rest = CHART_BASE.filter((c) => !chromatic || hueDistance(c.h, h) >= 28).map((c) =>
    ensureContrast(oklch(isLight ? c.l : Math.min(0.85, c.l + 0.06), c.c, c.h), [card], CONTRAST_UI),
  );
  const list = first ? [first, ...rest] : rest;
  while (list.length < 8) list.push(list[list.length % Math.max(1, rest.length)]);
  return list.slice(0, 8);
}
