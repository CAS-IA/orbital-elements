/**
 * Emisores: el mismo tema en los formatos que consume cada app.
 *
 *  - `cssVariables` / `themeCss` → variables `--oe-*` (las usan los
 *    componentes de este paquete).
 *  - `shadcnCss`   → nombres shadcn (`--background`, `--primary`, `--chart-1`…)
 *    más los de Qratia (`--incrustado`, `--enlace`, `--estado-*`).
 *  - `tailwindTheme` → bloque `@theme inline` de Tailwind v4.
 *  - `widgetVariables` → variables `--widget-*` (widget de chat Orbital).
 *  - `designTokens` → JSON en formato W3C Design Tokens (DTCG).
 *
 * Todos los valores salen de `createTheme` (hex normalizados o números), así
 * que el CSS emitido nunca contiene datos de entrada sin validar.
 */
import { toOklchCss, parseColor } from './color';
import { ROLE_NAMES, type Mode, type RoleName, type Roles, type Theme } from './theme';

export interface EmitOptions {
  /** Prefijo de las variables (por defecto `--oe-`). */
  prefix?: string;
  /** Formato de color: `hex` (por defecto, válido en todas partes) u `oklch`. */
  format?: 'hex' | 'oklch';
}

export interface CssOptions extends EmitOptions {
  /** Selector del modo claro. Por defecto `:root`. */
  selector?: string;
  /**
   * Cómo se activa el oscuro:
   *  - `class` (por defecto): `.dark` (o `darkSelector`).
   *  - `media`: `@media (prefers-color-scheme: dark)`.
   *  - `both`: los dos (la clase manda si existe `.light` forzado).
   */
  dark?: 'class' | 'media' | 'both';
  darkSelector?: string;
}

const kebab = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/([a-z])(\d)/g, '$1-$2').toLowerCase();

function color(value: string, format: EmitOptions['format']): string {
  return format === 'oklch' ? toOklchCss(value) : value;
}

/** Color con alfa en OKLCH (para sombras y overlays). */
export function withAlpha(value: string, alpha: number): string {
  const c = parseColor(value);
  if (!c) return value;
  const base = toOklchCss(c).slice(0, -1);
  return `${base} / ${Math.round(alpha * 1000) / 1000})`;
}

/** Sombras en capas tintadas (Qratia / joshwcomeau): reposo, realce y flotante. */
export function shadows(roles: Roles, mode: Mode) {
  const k = mode === 'dark' ? 2.6 : 1;
  const s = roles.shadow;
  return {
    xs: `0 1px 2px ${withAlpha(s, 0.06 * k)}`,
    card: `0 1px 2px ${withAlpha(s, 0.08 * k)}, 0 3px 10px ${withAlpha(s, 0.07 * k)}`,
    cardHover: `0 3px 6px ${withAlpha(s, 0.1 * k)}, 0 14px 32px ${withAlpha(s, 0.14 * k)}`,
    popover: `0 2px 6px ${withAlpha(s, 0.08 * k)}, 0 12px 28px ${withAlpha(s, 0.16 * k)}`,
    focus: `0 0 0 3px ${withAlpha(roles.ring, 0.35)}`,
  };
}

/** Variables de forma, tipografía y movimiento (iguales en los dos modos). */
function staticVariables(theme: Theme, p: string): Record<string, string> {
  const v: Record<string, string> = {};
  for (const [k, r] of Object.entries(theme.shape.radii)) v[`${p}radius-${k}`] = `${r}px`;
  v[`${p}radius`] = `${theme.shape.radius}px`;
  v[`${p}space`] = `${theme.shape.space}px`;
  v[`${p}font-sans`] = theme.typography.fontSans;
  v[`${p}font-mono`] = theme.typography.fontMono;
  for (const [k, s] of Object.entries(theme.typography.size)) v[`${p}text-${k}`] = `${s}px`;
  for (const [k, s] of Object.entries(theme.typography.leading)) v[`${p}leading-${k}`] = String(s);
  v[`${p}duration-fast`] = theme.motion.fast;
  v[`${p}duration`] = theme.motion.base;
  v[`${p}duration-slow`] = theme.motion.slow;
  v[`${p}ease`] = theme.motion.ease;
  return v;
}

/** Variables `--oe-*` de un modo (incluye forma, tipografía y sombras). */
export function cssVariables(theme: Theme, mode: Mode, opts: EmitOptions = {}): Record<string, string> {
  const p = opts.prefix ?? '--oe-';
  const roles = theme[mode];
  const v: Record<string, string> = {};
  for (const k of ROLE_NAMES) v[`${p}${kebab(k)}`] = color(roles[k], opts.format);
  for (const [k, s] of Object.entries(shadows(roles, mode))) v[`${p}shadow-${kebab(k)}`] = s;
  Object.assign(v, staticVariables(theme, p));
  v[`${p}color-scheme`] = mode;
  return v;
}

function block(selector: string, vars: Record<string, string>, extra = ''): string {
  const body = Object.entries(vars).map(([k, val]) => `  ${k}: ${val};`).join('\n');
  return `${selector} {\n${body}${extra}\n}`;
}

/** Hoja CSS completa del tema (claro + oscuro). */
export function themeCss(theme: Theme, opts: CssOptions = {}): string {
  const selector = opts.selector ?? ':root';
  const darkSel = opts.darkSelector ?? '.dark';
  const mode = opts.dark ?? 'class';
  const light = cssVariables(theme, 'light', opts);
  const dark = cssVariables(theme, 'dark', opts);
  const scheme = '\n  color-scheme: light;';
  const out = [block(selector, light, scheme)];
  if (mode === 'class' || mode === 'both') out.push(block(scoped(selector, darkSel), dark, '\n  color-scheme: dark;'));
  if (mode === 'media' || mode === 'both') {
    const sel = mode === 'both' ? `${selector}:not(.light)` : selector;
    out.push(`@media (prefers-color-scheme: dark) {\n${indent(block(sel, dark, '\n  color-scheme: dark;'))}\n}`);
  }
  return out.join('\n\n') + '\n';
}

/** `:root` + `.dark` → `.dark` ; `.card` + `.dark` → `.dark .card, .card.dark`. */
function scoped(selector: string, darkSel: string): string {
  if (selector === ':root' || selector === 'html') return `${darkSel}`;
  return `${darkSel} ${selector}, ${selector}${darkSel}`;
}

function indent(s: string): string {
  return s.split('\n').map((l) => `  ${l}`).join('\n');
}

/** Mapa rol → nombre shadcn / Qratia. */
const SHADCN: Partial<Record<RoleName, string[]>> = {
  background: ['--background'],
  foreground: ['--foreground'],
  card: ['--card'],
  cardForeground: ['--card-foreground'],
  popover: ['--popover'],
  popoverForeground: ['--popover-foreground'],
  primary: ['--primary'],
  primaryForeground: ['--primary-foreground'],
  secondary: ['--secondary'],
  secondaryForeground: ['--secondary-foreground'],
  muted: ['--muted'],
  mutedForeground: ['--muted-foreground'],
  accent: ['--accent'],
  accentForeground: ['--accent-foreground'],
  destructive: ['--destructive'],
  destructiveForeground: ['--destructive-foreground'],
  border: ['--border'],
  input: ['--input'],
  ring: ['--ring'],
  chart1: ['--chart-1'],
  chart2: ['--chart-2'],
  chart3: ['--chart-3'],
  chart4: ['--chart-4'],
  chart5: ['--chart-5'],
  chart6: ['--chart-6'],
  chart7: ['--chart-7'],
  chart8: ['--chart-8'],
  inset: ['--incrustado'],
  insetForeground: ['--incrustado-foreground'],
  link: ['--enlace'],
  linkHover: ['--enlace-hover'],
  brand: ['--marca'],
  critical: ['--estado-critico'],
  criticalSoft: ['--estado-critico-suave'],
  warning: ['--estado-aviso'],
  warningSoft: ['--estado-aviso-suave'],
  success: ['--estado-correcto'],
  successSoft: ['--estado-correcto-suave'],
  noData: ['--estado-sin-dato'],
  noDataSoft: ['--estado-sin-dato-suave'],
  info: ['--estado-info'],
  infoSoft: ['--estado-info-suave'],
};

/** Variables con nombres shadcn + Qratia (drop-in para `theme.css`). */
export function shadcnVariables(theme: Theme, mode: Mode, opts: EmitOptions = {}): Record<string, string> {
  const roles = theme[mode];
  const v: Record<string, string> = { '--radius': `${theme.shape.radius / 16}rem` };
  for (const [role, names] of Object.entries(SHADCN) as Array<[RoleName, string[]]>) {
    for (const n of names) v[n] = color(roles[role], opts.format ?? 'oklch');
  }
  const sh = shadows(roles, mode);
  v['--shadow-card'] = sh.card;
  v['--shadow-card-hover'] = sh.cardHover;
  return v;
}

export function shadcnCss(theme: Theme, opts: CssOptions = {}): string {
  const selector = opts.selector ?? ':root';
  const darkSel = opts.darkSelector ?? '.dark';
  return `${block(selector, shadcnVariables(theme, 'light', opts))}\n\n${block(scoped(selector, darkSel), shadcnVariables(theme, 'dark', opts))}\n`;
}

/**
 * Bloque `@theme inline` de Tailwind v4 que expone las `--oe-*` como
 * utilidades (`bg-oe-card`, `text-oe-link`, `rounded-oe-lg`, `shadow-oe-card`…).
 */
export function tailwindTheme(theme: Theme, opts: EmitOptions & { namespace?: string } = {}): string {
  const p = opts.prefix ?? '--oe-';
  const ns = opts.namespace ?? 'oe';
  const lines: string[] = [];
  for (const k of ROLE_NAMES) {
    if (k === 'shadow') continue;
    lines.push(`  --color-${ns}-${kebab(k)}: var(${p}${kebab(k)});`);
  }
  for (const k of Object.keys(theme.shape.radii)) lines.push(`  --radius-${ns}-${k}: var(${p}radius-${k});`);
  for (const k of ['xs', 'card', 'card-hover', 'popover']) lines.push(`  --shadow-${ns}-${k}: var(${p}shadow-${k});`);
  lines.push(`  --font-${ns}-sans: var(${p}font-sans);`);
  lines.push(`  --font-${ns}-mono: var(${p}font-mono);`);
  return `@theme inline {\n${lines.join('\n')}\n}\n`;
}

/** Variables `--widget-*` del widget de chat Orbital. */
export function widgetVariables(theme: Theme, mode: Mode): Record<string, string> {
  const r = theme[mode];
  const sh = shadows(r, mode);
  return {
    '--widget-primary': r.primary,
    '--widget-primary-hover': r.primaryHover,
    '--widget-primary-foreground': r.primaryForeground,
    '--widget-accent': r.highlight,
    '--widget-bg': r.card,
    '--widget-bg-secondary': r.inset,
    '--widget-bg-tertiary': r.muted,
    '--widget-text': r.foreground,
    '--widget-text-secondary': r.mutedForeground,
    '--widget-text-muted': r.mutedForeground,
    '--widget-text-tertiary': r.mutedForeground,
    '--widget-border': r.border,
    '--widget-border-light': r.border,
    '--widget-border-strong': r.borderStrong,
    '--widget-link': r.link,
    '--widget-link-hover': r.linkHover,
    '--widget-radius': `${theme.shape.radii.xl}px`,
    '--widget-radius-sm': `${theme.shape.radii.md}px`,
    '--widget-font': theme.typography.fontSans,
    '--widget-shadow-sm': sh.card,
    '--widget-shadow': sh.popover,
    '--widget-transition': `${theme.motion.base} ${theme.motion.ease}`,
  };
}

/** JSON W3C Design Tokens (DTCG): para Figma/Tokens Studio, documentos y otros lenguajes. */
export function designTokens(theme: Theme): Record<string, unknown> {
  const modeTokens = (mode: Mode) =>
    Object.fromEntries(ROLE_NAMES.map((k) => [kebab(k), { $type: 'color', $value: theme[mode][k] }]));
  const scaleTokens = (s: Record<string, string>) =>
    Object.fromEntries(Object.entries(s).map(([k, v]) => [k, { $type: 'color', $value: v }]));
  return {
    $description: `Tema Orbital generado desde ${theme.brand} (${theme.input.harmony})`,
    color: {
      light: modeTokens('light'),
      dark: modeTokens('dark'),
      scale: {
        primary: scaleTokens(theme.scales.primary),
        neutral: scaleTokens(theme.scales.neutral),
        highlight: scaleTokens(theme.scales.highlight),
      },
      harmony: Object.fromEntries(theme.harmony.colors.map((c, i) => [String(i + 1), { $type: 'color', $value: c }])),
    },
    radius: Object.fromEntries(Object.entries(theme.shape.radii).map(([k, v]) => [k, { $type: 'dimension', $value: `${v}px` }])),
    font: {
      sans: { $type: 'fontFamily', $value: theme.typography.fontSans },
      mono: { $type: 'fontFamily', $value: theme.typography.fontMono },
      size: Object.fromEntries(Object.entries(theme.typography.size).map(([k, v]) => [k, { $type: 'dimension', $value: `${v}px` }])),
    },
    duration: {
      fast: { $type: 'duration', $value: theme.motion.fast },
      base: { $type: 'duration', $value: theme.motion.base },
      slow: { $type: 'duration', $value: theme.motion.slow },
    },
  };
}
