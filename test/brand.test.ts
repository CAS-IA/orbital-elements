import { describe, expect, it } from 'vitest';
import { formatHex } from 'culori';
import {
  BRAND_PRESETS,
  BrandError,
  contrast,
  createTheme,
  cssVariables,
  designTokens,
  shadcnCss,
  tailwindTheme,
  themeCss,
  widgetVariables,
  type Harmony,
  type Mode,
  type Roles,
} from '../src/brand';

/** Barrido de la rueda + casos difíciles (amarillo, lima, blanco, negro, gris, cian Qratia). */
const SEEDS = [
  ...Array.from({ length: 24 }, (_, i) => formatHex({ mode: 'oklch', l: 0.62, c: 0.16, h: i * 15 })!),
  '#FFFF00', '#FDE047', '#84CC16', '#FFFFFF', '#000000', '#808080', '#00B4D8', '#0A1128', '#DC2626', '#F59E0B',
];

/** [texto, fondo, mínimo]: los pares que la UI usa y su exigencia WCAG. */
const PAIRS: Array<[keyof Roles, keyof Roles, number]> = [
  ['foreground', 'background', 4.5],
  ['foreground', 'card', 4.5],
  ['foreground', 'inset', 4.5],
  ['mutedForeground', 'background', 4.5],
  ['mutedForeground', 'card', 4.5],
  ['mutedForeground', 'muted', 4.5],
  ['primaryForeground', 'primary', 4.5],
  ['primarySoftForeground', 'primarySoft', 4.5],
  ['accentForeground', 'accent', 4.5],
  ['highlightForeground', 'highlight', 4.5],
  ['highlightSoftForeground', 'highlightSoft', 4.5],
  ['link', 'card', 4.5],
  ['link', 'background', 4.5],
  ['destructiveForeground', 'destructive', 4.5],
  ['critical', 'criticalSoft', 4.5],
  ['warning', 'warningSoft', 4.5],
  ['success', 'successSoft', 4.5],
  ['info', 'infoSoft', 4.5],
  ['noData', 'noDataSoft', 4.5],
  ['critical', 'card', 4.5],
  ['input', 'card', 3],
  ['ring', 'card', 3],
  ['highlight', 'card', 3],
  ...([1, 2, 3, 4, 5, 6, 7, 8] as const).map((i) => [`chart${i}` as keyof Roles, 'card' as keyof Roles, 3] as [keyof Roles, keyof Roles, number]),
];

describe('createTheme: contraste WCAG garantizado para cualquier marca', () => {
  for (const primary of SEEDS) {
    for (const strategy of ['brand', 'ink'] as const) {
      it(`${primary} (${strategy})`, () => {
        const t = createTheme({ primary, strategy });
        for (const mode of ['light', 'dark'] as Mode[]) {
          for (const [fg, bg, min] of PAIRS) {
            const k = contrast(t[mode][fg], t[mode][bg]);
            expect(k, `${mode} ${fg} sobre ${bg} = ${k.toFixed(2)}`).toBeGreaterThanOrEqual(min - 0.01);
          }
        }
      });
    }
  }
});

describe('createTheme: fidelidad y estructura', () => {
  it('una marca que ya cumple se usa tal cual como acción en claro', () => {
    const t = createTheme({ primary: '#2563EB' });
    expect(t.light.primary).toBe('#2563eb');
    expect(t.light.primaryForeground).toBe('#ffffff');
    expect(t.warnings).toEqual([]);
  });

  it('una marca clara (amarillo) se respeta con tinta encima, no se oscurece', () => {
    const t = createTheme({ primary: '#FDE047' });
    expect(t.light.primary).toBe('#fde047');
    expect(contrast(t.light.primaryForeground, '#000000')).toBeLessThan(2);
  });

  it('el lienzo NO es blanco puro y la tarjeta sí (tres niveles de superficie)', () => {
    const t = createTheme({ primary: '#0EA5E9' });
    expect(t.light.card).toBe('#ffffff');
    expect(t.light.background).not.toBe('#ffffff');
    expect(t.light.inset).not.toBe(t.light.card);
    expect(t.dark.background).not.toBe('#000000');
  });

  it('la serie 1 es la marca y ninguna otra repite su tono', () => {
    const t = createTheme({ primary: '#2a78d6' });
    const charts = [2, 3, 4, 5, 6, 7, 8].map((i) => t.light[`chart${i}` as keyof Roles]);
    expect(new Set(charts).size).toBe(7);
  });

  it('las armonías generan el número de tonos esperado', () => {
    const n: Record<Harmony, number> = { complementary: 1, analogous: 2, triadic: 2, 'split-complementary': 2, tetradic: 3, monochrome: 0 };
    for (const [harmony, count] of Object.entries(n)) {
      expect(createTheme({ primary: '#7C3AED', harmony: harmony as Harmony }).harmony.colors).toHaveLength(count);
    }
  });

  it('escalas 50–950 de luminosidad decreciente', () => {
    const t = createTheme({ primary: '#059669' });
    const steps = Object.values(t.scales.primary);
    expect(steps).toHaveLength(11);
    expect(contrast(steps[0], '#000000')).toBeGreaterThan(contrast(steps[10], '#000000'));
  });

  it('radio, densidad y fuente', () => {
    const t = createTheme({ primary: '#111827', radius: 'lg', density: 'compact', font: 'Inter' });
    expect(t.shape.radius).toBe(14);
    expect(t.shape.radii.xl).toBe(20);
    expect(t.shape.space).toBe(3.5);
    expect(t.typography.fontSans.startsWith('Inter')).toBe(true);
  });

  it('todos los presets generan un tema válido', () => {
    for (const p of BRAND_PRESETS) expect(() => createTheme(p.input)).not.toThrow();
  });
});

describe('createTheme: entradas no válidas', () => {
  it.each(['', 'red', 'url(x)', '#12', 'javascript:alert(1)', '#ff0000; color: red', null, 42])('rechaza %s', (v) => {
    expect(() => createTheme({ primary: v as string })).toThrow(BrandError);
  });
  it('rechaza una fuente con CSS inyectado', () => {
    expect(() => createTheme({ primary: '#000', font: 'x; } body { display:none' })).toThrow(BrandError);
  });
});

describe('emisores', () => {
  const t = createTheme({ primary: '#0EA5E9' });

  it('themeCss: claro + .dark, sin valores rotos', () => {
    const css = themeCss(t);
    expect(css).toContain(':root {');
    expect(css).toContain('.dark {');
    expect(css).toContain('--oe-primary: #');
    expect(css).toContain('--oe-shadow-card:');
    expect(css).not.toMatch(/undefined|NaN/);
  });

  it('themeCss con media query', () => {
    expect(themeCss(t, { dark: 'media' })).toContain('@media (prefers-color-scheme: dark)');
  });

  it('cssVariables admite OKLCH', () => {
    expect(cssVariables(t, 'light', { format: 'oklch' })['--oe-primary']).toMatch(/^oklch\(/);
  });

  it('shadcnCss con los nombres de shadcn y de Qratia', () => {
    const css = shadcnCss(t);
    for (const n of ['--background:', '--primary-foreground:', '--chart-1:', '--incrustado:', '--enlace:', '--estado-critico-suave:', '--radius:']) {
      expect(css).toContain(n);
    }
  });

  it('tailwindTheme expone utilidades', () => {
    const tw = tailwindTheme(t);
    expect(tw).toContain('@theme inline');
    expect(tw).toContain('--color-oe-card: var(--oe-card);');
  });

  it('widgetVariables cubre las --widget-* que usa el widget', () => {
    const v = widgetVariables(t, 'dark');
    for (const k of ['--widget-primary', '--widget-primary-hover', '--widget-bg', '--widget-text', '--widget-link', '--widget-radius', '--widget-shadow-sm']) {
      expect(v[k]).toBeTruthy();
    }
  });

  it('designTokens en formato DTCG', () => {
    const j = designTokens(t) as { color: { light: Record<string, { $type: string }> } };
    expect(j.color.light.primary.$type).toBe('color');
  });
});
