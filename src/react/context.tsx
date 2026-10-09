/**
 * Contexto de Orbital Elements: tema (variables `--oe-*`), modo claro/oscuro,
 * idioma y despacho de acciones.
 *
 *   <OrbitalTheme brand="#0EA5E9" mode="system">
 *     <OrbitalRenderer spec={spec} onAction={...} />
 *   </OrbitalTheme>
 *
 * El tema se aplica como variables CSS en el propio contenedor: funciona
 * igual en una página, dentro de un Shadow DOM o en varias instancias con
 * marcas distintas en la misma pantalla.
 */
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { createTheme, cssVariables, type BrandInput, type Mode, type Theme } from '../brand';
import { message, type MessageKey } from './format';

export interface OrbitalAction {
  /** Nombre de la acción (la del botón, `select`, `submit`, `confirm`, `approval`…). */
  action: string;
  /** Datos de la acción (payload del botón, valores del formulario, elección…). */
  payload: Record<string, unknown>;
  /** Resumen legible de lo que hizo el usuario (para la burbuja del chat). */
  text: string;
  /** Componente que la emitió. */
  source: string;
}

interface Ctx {
  theme: Theme;
  mode: Mode;
  locale: string;
  onAction?: (a: OrbitalAction) => void;
}

const OrbitalContext = createContext<Ctx | null>(null);

const DEFAULT_THEME = createTheme({ primary: '#4F46E5' });

export function useOrbital(): Ctx {
  return useContext(OrbitalContext) ?? { theme: DEFAULT_THEME, mode: 'light', locale: 'es-ES' };
}

export function useT() {
  const { locale } = useOrbital();
  return (k: MessageKey) => message(locale, k);
}

function useSystemDark(enabled: boolean): boolean {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    setDark(mq.matches);
    const on = (e: MediaQueryListEvent) => setDark(e.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, [enabled]);
  return dark;
}

export interface OrbitalThemeProps {
  /** Tema ya calculado… */
  theme?: Theme;
  /** …o el color de marca (y opciones) para calcularlo aquí. */
  brand?: string | BrandInput;
  mode?: Mode | 'system';
  locale?: string;
  onAction?: (a: OrbitalAction) => void;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export function OrbitalTheme({ theme, brand, mode = 'light', locale = 'es-ES', onAction, className, style, children }: OrbitalThemeProps) {
  const brandKey = typeof brand === 'string' ? brand : JSON.stringify(brand ?? null);
  const resolved = useMemo(() => {
    if (theme) return theme;
    if (!brand) return DEFAULT_THEME;
    try {
      return createTheme(typeof brand === 'string' ? { primary: brand } : brand);
    } catch {
      return DEFAULT_THEME;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, brandKey]);
  const systemDark = useSystemDark(mode === 'system');
  const effective: Mode = mode === 'system' ? (systemDark ? 'dark' : 'light') : mode;
  const vars = useMemo(() => cssVariables(resolved, effective) as React.CSSProperties, [resolved, effective]);
  const ctx = useMemo(() => ({ theme: resolved, mode: effective, locale, onAction }), [resolved, effective, locale, onAction]);

  return (
    <OrbitalContext.Provider value={ctx}>
      <div className={`oe-root${className ? ` ${className}` : ''}`} data-mode={effective} style={{ ...vars, colorScheme: effective, ...style }}>
        {children}
      </div>
    </OrbitalContext.Provider>
  );
}

/** Despachador de acciones del contexto (no hace nada si el host no escucha). */
export function useEmit() {
  const { onAction } = useOrbital();
  return (a: OrbitalAction) => onAction?.(a);
}
