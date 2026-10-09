/**
 * @cas-ia/orbital-elements/json-render — adaptador para json-render (Vercel).
 *
 * El CONTRATO es nuestro (catálogo Zod de `/catalog`); json-render es un motor
 * intercambiable. Para quien quiera su runtime (streaming por parches JSON,
 * estado `$state`, visibilidad, `useUIStream`), este módulo expone el mismo
 * catálogo y los mismos componentes en su formato:
 *
 *   import { createOrbitalJsonRender } from '@cas-ia/orbital-elements/json-render';
 *   import { Renderer } from '@json-render/react';
 *   const { catalog, registry } = createOrbitalJsonRender();
 *   const system = catalog.prompt();
 *   <OrbitalTheme brand="#0EA5E9" onAction={...}><Renderer spec={spec} registry={registry} /></OrbitalTheme>
 *
 * La spec plana de Orbital (`{ root, elements }`) ES la de json-render: el
 * mismo JSON vale para los dos renderizadores. Si mañana se impone A2UI, se
 * añade otro adaptador aquí sin tocar el catálogo.
 *
 * Peer dependencies opcionales: @json-render/core, @json-render/react y react.
 */
import React from 'react';
import { defineCatalog } from '@json-render/core';
import { defineRegistry } from '@json-render/react';
import { schema } from '@json-render/react/schema';
import { COMPONENTS } from '../catalog';
import { REGISTRY } from '../react/registry';

export { OrbitalTheme } from '../react/context';

/** Catálogo json-render con los componentes y descripciones de Orbital Elements. */
export function createOrbitalCatalog() {
  const components = Object.fromEntries(
    COMPONENTS.map((c) => [c.type, { props: c.props, description: `${c.description} Cuándo: ${c.whenToUse}` }]),
  );
  return defineCatalog(schema, { components, actions: {} } as never);
}

/**
 * Catálogo + registro json-render. Las acciones de los componentes
 * interactivos se despachan por el `onAction` de `OrbitalTheme` (igual que
 * con OrbitalRenderer), así un mismo host sirve para los dos motores.
 */
export function createOrbitalJsonRender() {
  const catalog = createOrbitalCatalog();
  const components = Object.fromEntries(
    Object.entries(REGISTRY).map(([type, Comp]) => [
      type,
      (ctx: { props: Record<string, unknown>; children?: React.ReactNode }) =>
        React.createElement(Comp, { props: ctx.props, id: type, children: ctx.children }),
    ]),
  );
  const { registry } = defineRegistry(catalog, { components } as never);
  return { catalog, registry };
}
