/**
 * @cas-ia/orbital-elements/react — los componentes pintados con el sistema
 * de marca. Importa también la hoja de estilos:
 *
 *   import '@cas-ia/orbital-elements/styles.css';
 *   import { OrbitalTheme, OrbitalRenderer } from '@cas-ia/orbital-elements/react';
 *
 *   <OrbitalTheme brand="#0EA5E9" mode="system" onAction={(a) => send(a.text, a)}>
 *     <OrbitalRenderer spec={spec} partial={streaming} />
 *   </OrbitalTheme>
 *
 * En un Shadow DOM, inyecta el CSS como texto (`?inline` en Vite) dentro de la raíz.
 */
export { OrbitalTheme, useOrbital, type OrbitalAction, type OrbitalThemeProps } from './context';
export { OrbitalRenderer, type OrbitalRendererProps } from './Renderer';
export { REGISTRY, MISSING_COMPONENTS, type ElementProps } from './registry';
export { Markdown, isSafeUrl } from './markdown';
export { formatValue, formatDelta, niceTicks } from './format';
export { layoutFlow } from './components/diagram';
