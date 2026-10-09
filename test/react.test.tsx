// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRoot } from 'react-dom/client';
import { COMPONENTS } from '../src/catalog';
import { MISSING_COMPONENTS, OrbitalRenderer, OrbitalTheme, layoutFlow, type OrbitalAction } from '../src/react';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const html = (spec: unknown, opts: { partial?: boolean; mode?: 'light' | 'dark' } = {}) =>
  renderToStaticMarkup(
    <OrbitalTheme brand="#0EA5E9" mode={opts.mode ?? 'light'}>
      <OrbitalRenderer spec={spec} partial={opts.partial} />
    </OrbitalTheme>,
  );

function mount(el: React.ReactElement) {
  const div = document.createElement('div');
  document.body.appendChild(div);
  const root = createRoot(div);
  act(() => root.render(el));
  return { div, unmount: () => act(() => root.unmount()) };
}

describe('componentes', () => {
  it('cada tipo del catálogo tiene componente React', () => {
    expect(MISSING_COMPONENTS).toEqual([]);
  });

  it.each(COMPONENTS.map((c) => [c.type, c]))('%s se pinta con su ejemplo', (type, c) => {
    const spec = type === 'Tab' ? { type: 'Tabs', props: {}, children: [c.example] } : c.example;
    const out = html(spec);
    expect(out).toContain('oe-root');
    expect(out).not.toContain('oe-error-note');
    expect(out.length).toBeGreaterThan(80);
  });

  it('el tema se aplica como variables --oe-* en el contenedor, en claro y oscuro', () => {
    const light = html({ type: 'Divider', props: {} });
    const dark = html({ type: 'Divider', props: {} }, { mode: 'dark' });
    expect(light).toContain('--oe-primary:#');
    expect(light).toContain('data-mode="light"');
    expect(dark).toContain('data-mode="dark"');
  });

  it('Kpi: null se pinta como «—» y sin flecha de tendencia', () => {
    const out = html({ type: 'Kpi', props: { label: 'Media', value: null, delta: 0.2 } });
    expect(out).toContain('oe-kpi-value--nodata');
    expect(out).not.toContain('oe-delta');
  });

  it('Kpi: bajar es bueno cuando goodWhen=down', () => {
    const out = html({ type: 'Kpi', props: { label: 'Tiempo', value: 30, delta: -0.1, goodWhen: 'down' } });
    expect(out).toContain('data-tone="success"');
  });

  it('Chart: barras con valores visibles y sin estirar el SVG', () => {
    const out = html({ type: 'Chart', props: { kind: 'bar', labels: ['Máx', 'Media', 'Mín'], series: [{ name: 'Noches', data: [6, 2.1, 0] }] } });
    expect(out).not.toContain('preserveAspectRatio="none"');
    expect((out.match(/oe-value-label/g) || []).length).toBe(3);
  });

  it('Chart: todos los tipos se pintan', () => {
    for (const kind of ['bar', 'hbar', 'stacked-bar', 'line', 'area', 'donut', 'pie']) {
      const out = html({ type: 'Chart', props: { kind, labels: ['a', 'b'], series: [{ name: 's', data: [1, 2] }, { name: 't', data: [2, 1] }] } });
      expect(out, kind).toContain('oe-chart');
      expect(out, kind).not.toContain('oe-error-note');
    }
  });

  it('Tabs: títulos desde los Tab hijos', () => {
    const out = html({ type: 'Tabs', props: {}, children: [{ type: 'Tab', props: { title: 'Resumen' }, children: [] }, { type: 'Tab', props: { title: 'Datos' }, children: [] }] });
    expect(out).toContain('>Resumen<');
    expect(out).toContain('>Datos<');
  });
});

describe('seguridad', () => {
  it('markdown: un enlace javascript: no se convierte en <a>', () => {
    const out = html({ type: 'Text', props: { text: '[clic](javascript:alert(1)) y [bien](https://example.com)' } });
    expect(out).not.toContain('javascript:');
    expect(out).toContain('href="https://example.com"');
  });

  it('markdown: el HTML del modelo se escapa, no se interpreta', () => {
    const out = html({ type: 'Text', props: { text: '<img src=x onerror=alert(1)>' } });
    expect(out).not.toContain('<img');
    expect(out).toContain('&lt;img');
  });

  it('Media: YouTube se incrusta con dominio fijo (nocookie)', () => {
    const out = html({ type: 'Media', props: { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' } });
    expect(out).toContain('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
  });

  it('un tipo desconocido no se pinta', () => {
    const out = html({ type: 'Stack', props: {}, children: [{ type: 'Script', props: { src: 'x' } }] });
    expect(out).not.toContain('Script');
  });
});

describe('Flow', () => {
  it('maqueta por capas y separa los ciclos', () => {
    const L = layoutFlow({
      nodes: [
        { id: 'a', label: 'Inicio', kind: 'start' },
        { id: 'b', label: 'Revisar', kind: 'process' },
        { id: 'c', label: '¿OK?', kind: 'decision' },
        { id: 'd', label: 'Fin', kind: 'end' },
      ],
      edges: [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' },
        { from: 'c', to: 'd', label: 'sí' },
        { from: 'c', to: 'b', label: 'no' },
      ],
    });
    expect([...L.placed.values()].map((p) => p.rank)).toEqual([0, 1, 2, 3]);
    expect(L.back.has('c->b')).toBe(true);
    const xs = [...L.placed.values()].map((p) => p.x);
    expect([...xs].sort((a, b) => a - b)).toEqual(xs);
  });

  it('ignora aristas a nodos inexistentes', () => {
    const L = layoutFlow({ nodes: [{ id: 'a', label: 'A' }], edges: [{ from: 'a', to: 'zzz' }] });
    expect(L.edges).toHaveLength(0);
  });
});

describe('streaming', () => {
  it('modo parcial: pinta lo completo y omite lo incompleto', () => {
    const out = html({ type: 'Stack', props: {}, children: [{ type: 'Heading', props: { text: 'Ya' } }, { type: 'Kpi', props: { label: 'Medio' } }] }, { partial: true });
    expect(out).toContain('Ya');
    expect(out).not.toContain('Medio');
    expect(out).toContain('oe-render--partial');
  });

  it('acepta el render_ui antiguo tal cual', () => {
    const out = html({ sections: [{ type: 'alert', message: 'Hola', tone: 'danger' }] });
    expect(out).toContain('data-tone="critical"');
  });
});

describe('acciones', () => {
  it('Actions emite la acción con su texto y queda respondido', () => {
    const onAction = vi.fn<(a: OrbitalAction) => void>();
    const { div, unmount } = mount(
      <OrbitalTheme brand="#0EA5E9" onAction={onAction}>
        <OrbitalRenderer spec={{ type: 'Actions', props: { buttons: [{ label: 'Ver', action: 'show', payload: { id: 1 } }] } }} />
      </OrbitalTheme>,
    );
    const btn = div.querySelector('button')!;
    act(() => btn.click());
    expect(onAction).toHaveBeenCalledWith({ action: 'show', payload: { id: 1 }, text: 'Ver', source: 'Actions' });
    expect(btn.disabled).toBe(true);
    unmount();
  });

  it('Form valida obligatorios antes de emitir', () => {
    const onAction = vi.fn();
    const { div, unmount } = mount(
      <OrbitalTheme onAction={onAction}>
        <OrbitalRenderer spec={{ type: 'Form', props: { fields: [{ name: 'email', label: 'Correo', type: 'email', required: true }] } }} />
      </OrbitalTheme>,
    );
    const form = div.querySelector('form')!;
    act(() => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(onAction).not.toHaveBeenCalled();
    expect(div.textContent).toContain('Obligatorio');
    unmount();
  });

  it('Approval emite pendingActionId y la decisión', () => {
    const onAction = vi.fn();
    const { div, unmount } = mount(
      <OrbitalTheme onAction={onAction}>
        <OrbitalRenderer spec={{ type: 'Approval', props: { title: 'Reembolso', pendingActionId: 'p1' } }} />
      </OrbitalTheme>,
    );
    act(() => div.querySelector<HTMLButtonElement>('.oe-btn--primary')!.click());
    expect(onAction.mock.calls[0][0]).toMatchObject({ action: 'approval', payload: { pendingActionId: 'p1', decision: 'approve' } });
    unmount();
  });
});
