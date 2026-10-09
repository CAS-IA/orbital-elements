/**
 * @cas-ia/orbital-elements/brand — de un color primario, el tema completo.
 *
 *   import { createTheme, themeCss } from '@cas-ia/orbital-elements/brand';
 *   const theme = createTheme({ primary: '#0EA5E9' });
 *   style.textContent = themeCss(theme);          // --oe-* claro + .dark
 *
 * Sin React ni DOM: sirve igual en un Worker, en el panel o en el widget.
 */
export * from './color';
export * from './theme';
export * from './emit';
export * from './presets';
