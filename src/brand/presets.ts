/**
 * Presets de marca con nombre. Sustituyen a `brand-presets.ts`, que estaba
 * duplicado (y divergente) en orbital-ui y control-panel: ahora un preset es
 * solo la ENTRADA del tema (primario + acento + opciones); superficies,
 * textos y bordes los calcula `createTheme` con el mismo criterio para todos.
 */
import type { BrandInput } from './theme';

export interface BrandPreset {
  id: string;
  label: string;
  input: BrandInput;
}

export const DEFAULT_PRESET_ID = 'moderno';

export const BRAND_PRESETS: BrandPreset[] = [
  { id: 'moderno', label: 'Moderno', input: { primary: '#4F46E5', accent: '#7C3AED', harmony: 'analogous' } },
  { id: 'clasico', label: 'Clásico', input: { primary: '#2563EB', accent: '#0EA5E9', harmony: 'analogous' } },
  { id: 'minimal', label: 'Minimal', input: { primary: '#111827', accent: '#6B7280', neutral: 'pure', radius: 'sm' } },
  { id: 'vibrante', label: 'Vibrante', input: { primary: '#DB2777', accent: '#F59E0B', harmony: 'triadic', radius: 'lg' } },
  { id: 'esmeralda', label: 'Esmeralda', input: { primary: '#059669', harmony: 'split-complementary' } },
  { id: 'qratia', label: 'Qratia', input: { primary: '#00B4D8', strategy: 'ink' } },
  { id: 'fractalia', label: 'Fractalia', input: { primary: '#0A1128', accent: '#00B4D8', strategy: 'brand' } },
];

export function presetById(id: string): BrandPreset | undefined {
  return BRAND_PRESETS.find((p) => p.id === id);
}
