import { describe, expect, it } from 'vitest';
import {
  CATALOG,
  COMPONENTS,
  catalogPrompt,
  componentJsonSchema,
  createSpecAccumulator,
  fromRenderUi,
  specJsonSchema,
  toFlat,
  toNested,
  validateSpec,
} from '../src/catalog';
import { executeTool, renderUiTool, toAnthropicTools, toMcpTools, toOpenAITools, uiCatalogTool } from '../src/tools';

describe('catálogo', () => {
  it('tiene tipos únicos y cada ejemplo valida', () => {
    expect(new Set(COMPONENTS.map((c) => c.type)).size).toBe(COMPONENTS.length);
    for (const c of COMPONENTS) {
      const r = validateSpec(c.type === 'Tab' ? { type: 'Tabs', props: {}, children: [c.example] } : c.example);
      expect(r.issues, c.type).toEqual([]);
    }
  });

  it('cada componente genera JSON Schema', () => {
    for (const c of COMPONENTS) expect(componentJsonSchema(c.type), c.type).toMatchObject({ type: 'object' });
  });

  it('el schema estricto de la spec es una unión de todos los componentes', () => {
    const s = specJsonSchema({ strict: true }) as { $defs: Record<string, unknown> };
    expect(Object.keys(s.$defs)).toContain('Flow');
    expect(Object.keys(s.$defs)).toHaveLength(COMPONENTS.length + 1);
  });

  it('el prompt menciona todos los componentes y las reglas clave', () => {
    const p = catalogPrompt();
    for (const c of COMPONENTS) expect(p).toContain(`- ${c.type}`);
    expect(p).toContain('null, nunca 0');
  });
});

describe('validateSpec', () => {
  const good = {
    type: 'Stack',
    props: {},
    children: [
      { type: 'Heading', props: { text: 'Hola' } },
      { type: 'Kpi', props: { label: 'Ventas', value: 10 } },
    ],
  };

  it('acepta una spec válida y la normaliza a plana', () => {
    const r = validateSpec(good);
    expect(r.valid).toBe(true);
    expect(Object.keys(r.spec.elements)).toHaveLength(3);
    expect(toNested(r.spec)).toMatchObject({ type: 'Stack', children: [{ type: 'Heading' }, { type: 'Kpi' }] });
  });

  it('quita un tipo desconocido sin romper a sus hermanos y explica por qué', () => {
    const r = validateSpec({ type: 'Stack', props: {}, children: [{ type: 'Hacker', props: {} }, { type: 'Divider', props: {} }] });
    expect(r.valid).toBe(false);
    expect(r.issues[0]).toMatchObject({ code: 'unknown-type', path: 'Stack[0] > Hacker[0]' });
    expect(Object.values(r.spec.elements).map((e) => e.type)).toEqual(['Divider', 'Stack']);
  });

  it('informa de props inválidas con su ruta', () => {
    const r = validateSpec({ type: 'Kpi', props: { label: 'x', value: 1, delta: 'mucho' } });
    expect(r.issues[0]).toMatchObject({ code: 'invalid-props', path: 'Kpi[0].delta' });
  });

  it('rechaza props desconocidas (strict) y URLs que no son http(s)', () => {
    expect(validateSpec({ type: 'Divider', props: { style: 'color:red' } }).valid).toBe(false);
    expect(validateSpec({ type: 'Media', props: { url: 'javascript:alert(1)' } }).valid).toBe(false);
    expect(validateSpec({ type: 'Links', props: { items: [{ text: 'x', href: 'data:text/html,hi' }] } }).valid).toBe(false);
  });

  it('respeta los hijos permitidos (Tabs solo admite Tab)', () => {
    const r = validateSpec({ type: 'Tabs', props: {}, children: [{ type: 'Text', props: { text: 'x' } }] });
    expect(r.issues[0].code).toBe('child-type');
  });

  it('una hoja no admite hijos (aviso, se ignoran)', () => {
    const r = validateSpec({ type: 'Divider', props: {}, children: [{ type: 'Divider', props: {} }] });
    expect(r.issues[0]).toMatchObject({ code: 'children-not-allowed', severity: 'warning' });
    expect(r.valid).toBe(true);
  });

  it('detecta ciclos en la spec plana', () => {
    const r = validateSpec({ root: 'a', elements: { a: { type: 'Stack', props: {}, children: ['b'] }, b: { type: 'Stack', props: {}, children: ['a'] } } });
    expect(r.issues.some((i) => i.code === 'invalid-spec')).toBe(true);
  });

  it('limita el número de elementos', () => {
    const many = { type: 'Stack', props: {}, children: Array.from({ length: 20 }, () => ({ type: 'Divider', props: {} })) };
    expect(validateSpec(many, { maxElements: 5 }).issues.some((i) => i.code === 'limit')).toBe(true);
  });

  it('modo parcial: un nodo a medias se omite sin error', () => {
    const r = validateSpec({ type: 'Stack', props: {}, children: [{ type: 'Kpi', props: { label: 'Ven' } }] }, { partial: true });
    expect(r.issues).toEqual([]);
    expect(Object.keys(r.spec.elements)).toHaveLength(1);
  });

  it('acepta una lista de nodos en la raíz', () => {
    const f = toFlat([{ type: 'Divider', props: {} }, { type: 'Divider', props: {} }]);
    expect(f.elements[f.root].children).toHaveLength(2);
  });
});

describe('streaming', () => {
  it('el acumulador devuelve la spec parcial a medida que llega', () => {
    const acc = createSpecAccumulator();
    const full = JSON.stringify({ type: 'Stack', props: {}, children: [{ type: 'Heading', props: { text: 'Hola' } }, { type: 'Text', props: { text: 'Mundo' } }] });
    const seen: number[] = [];
    for (let i = 0; i < full.length; i += 7) {
      const v = acc.push(full.slice(i, i + 7));
      seen.push(Object.keys(validateSpec(v, { partial: true }).spec.elements).length);
    }
    expect(Math.max(...seen)).toBe(3);
    expect(seen.some((n) => n === 2)).toBe(true); // hubo un momento con solo el Heading
  });
});

describe('compatibilidad render_ui', () => {
  const legacy = {
    title: 'Panel',
    sections: [
      { type: 'text', content: 'Resumen', variant: 'heading' },
      { type: 'text', content: '**Hola**', markdown: true },
      { type: 'card', title: 'Tarjeta', body: 'Cuerpo', tone: 'primary', cta: { label: 'Ir', payload: { _intent: 'go' } } },
      { type: 'list', title: 'Lista', items: ['a', 'b'] },
      { type: 'kpis', items: [{ label: 'Ventas', value: 10, trend: 'up', trendValue: '+5 %' }] },
      { type: 'form', fields: [{ name: 'email', label: 'Correo', type: 'email', required: true }] },
      { type: 'actions', question: '¿Seguimos?', buttons: [{ label: 'Sí', payload: { _intent: 'yes' }, variant: 'tertiary' }] },
      { type: 'divider' },
      { type: 'options', options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] },
      { type: 'confirmation', message: '¿Seguro?' },
      { type: 'approval', title: 'Aprobar', pendingActionId: 'p1', rows: [{ label: 'x', value: 'y' }] },
      { type: 'alert', message: 'Cuidado', tone: 'danger' },
      { type: 'badges', items: [{ text: 'x', tone: 'success' }] },
      { type: 'progress', value: 40, max: 100 },
      { type: 'links', items: [{ text: 'Docs', href: 'https://example.com' }] },
      { type: 'table', columns: [{ key: 'a', label: 'A' }], rows: [{ a: 1 }] },
      { type: 'steps', steps: [{ title: 'Uno', status: 'done' }] },
      { type: 'media', url: 'https://example.com/a.png', kind: 'image' },
      { type: 'product', title: 'P', price: '10', metadata: [{ label: 'x', value: 'y' }] },
      { type: 'chart', kind: 'line', series: [{ name: 's', data: [1, 2, 3] }] },
      { type: 'tabs', tabs: [{ title: 'T1', sections: [{ type: 'divider' }] }] },
      { type: 'grid', columns: 2, sections: [{ type: 'divider' }, { type: 'divider' }] },
    ],
  };

  it('las 22 secciones de render_ui se convierten en una spec válida', () => {
    const r = validateSpec(fromRenderUi(legacy));
    expect(r.issues).toEqual([]);
    const types = new Set(Object.values(r.spec.elements).map((e) => e.type));
    for (const t of ['Heading', 'Text', 'Card', 'List', 'Kpis', 'Form', 'Actions', 'Options', 'Confirmation', 'Approval', 'Alert', 'Badges', 'Progress', 'Links', 'Table', 'Steps', 'Media', 'Product', 'Chart', 'Tabs', 'Grid']) {
      expect(types.has(t), t).toBe(true);
    }
  });
});

describe('tools', () => {
  it('ui_catalog: índice y detalle', () => {
    const idx = uiCatalogTool.execute({});
    expect(idx.components).toHaveLength(CATALOG.size);
    const det = uiCatalogTool.execute({ components: ['Flow', 'Nope'] });
    expect(det.details?.[0].type).toBe('Flow');
    expect(det.unknown).toEqual(['Nope']);
  });

  it('render_ui: ok con spec válida; errores legibles con spec inválida', () => {
    expect(renderUiTool.execute({ ui: { type: 'Divider', props: {} } }).ok).toBe(true);
    const bad = renderUiTool.execute({ ui: { type: 'Kpi', props: { label: 'x' } } });
    expect(bad.ok).toBe(false);
    expect(bad.message).toContain('Kpi[0].value');
  });

  it('render_ui acepta el input antiguo (sections)', () => {
    expect(renderUiTool.execute({ sections: [{ type: 'divider' }] } as never).ok).toBe(true);
  });

  it('adaptadores de proveedor', () => {
    expect(toAnthropicTools()[1]).toMatchObject({ name: 'render_ui', input_schema: { type: 'object' } });
    expect(toOpenAITools()[0]).toMatchObject({ type: 'function', function: { name: 'ui_catalog' } });
    expect(toMcpTools()).toHaveLength(2);
    expect(() => executeTool('nope', {})).toThrow();
  });
});
