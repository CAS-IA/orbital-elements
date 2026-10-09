import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Renderer, JSONUIProvider } from '@json-render/react';
import { createOrbitalJsonRender, OrbitalTheme } from '../src/json-render';
import { validateSpec, COMPONENTS } from '../src/catalog';

describe('adaptador json-render', () => {
  const { catalog, registry } = createOrbitalJsonRender();

  it('el catálogo json-render genera prompt con los componentes de Orbital', () => {
    const p = catalog.prompt();
    for (const c of ['Kpi', 'Chart', 'Flow', 'Timeline']) expect(p).toContain(c);
  });

  it('la misma spec plana se pinta con el Renderer de json-render', () => {
    const { spec } = validateSpec({ type: 'Stack', props: {}, children: [{ type: 'Heading', props: { text: 'Hola json-render' } }, { type: 'Kpi', props: { label: 'Ventas', value: 10 } }] });
    const out = renderToStaticMarkup(
      <OrbitalTheme brand="#059669">
        <JSONUIProvider registry={registry}>
          <Renderer spec={spec as never} registry={registry} />
        </JSONUIProvider>
      </OrbitalTheme>,
    );
    expect(out).toContain('Hola json-render');
    expect(out).toContain('oe-kpi');
  });

  it('registra todos los componentes', () => {
    expect(Object.keys(registry).length).toBeGreaterThanOrEqual(COMPONENTS.length);
  });
});
