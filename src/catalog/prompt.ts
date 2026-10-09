/**
 * Lo que ve el modelo: instrucciones, catálogo y JSON Schemas, todo derivado
 * de las definiciones Zod (nunca se mantiene a mano en paralelo).
 */
import { z } from 'zod';
import { CATALOG, COMPONENTS, type Category, type ComponentDef } from './components';

/** JSON Schema de las props de un componente. */
export function componentJsonSchema(type: string): Record<string, unknown> | null {
  const def = CATALOG.get(type);
  if (!def) return null;
  const schema = z.toJSONSchema(def.props, { unrepresentable: 'any' }) as Record<string, unknown>;
  delete schema.$schema;
  return schema;
}

/**
 * JSON Schema de un NODO de la spec anidada. Con `strict` se genera la unión
 * discriminada completa (exacta, más larga); sin él, la forma genérica
 * `{ type, props, children }` (corta, para inputs de tool) y la exactitud la
 * pone `validateSpec`, que devuelve los errores para reintentar.
 */
export function specJsonSchema(opts: { strict?: boolean; components?: string[] } = {}): Record<string, unknown> {
  const defs = selected(opts.components);
  if (!opts.strict) {
    return {
      type: 'object',
      description: 'Nodo de interfaz: un componente del catálogo con sus props y, si es contenedor, sus hijos.',
      properties: {
        type: { type: 'string', enum: defs.map((d) => d.type), description: 'Componente del catálogo.' },
        props: { type: 'object', description: 'Props del componente (ver catálogo).' },
        children: { type: 'array', items: { $ref: '#' }, description: 'Solo en contenedores.' },
      },
      required: ['type', 'props'],
    };
  }
  const $defs: Record<string, unknown> = {};
  const variants = defs.map((d) => {
    const props = componentJsonSchema(d.type)!;
    const node: Record<string, unknown> = {
      type: 'object',
      description: d.description,
      properties: { type: { const: d.type }, props },
      required: ['type', 'props'],
      additionalProperties: false,
    };
    if (d.children) (node.properties as Record<string, unknown>).children = { type: 'array', items: { $ref: '#/$defs/Node' } };
    $defs[d.type] = node;
    return { $ref: `#/$defs/${d.type}` };
  });
  $defs.Node = { oneOf: variants };
  return { $ref: '#/$defs/Node', $defs };
}

const CATEGORY_LABEL: Record<Category, string> = {
  layout: 'Estructura',
  text: 'Texto',
  data: 'Datos',
  chart: 'Gráficos',
  diagram: 'Diagramas',
  feedback: 'Avisos',
  media: 'Medios y enlaces',
  interactive: 'Interacción',
};

function selected(components?: string[]): ComponentDef[] {
  const all = COMPONENTS as readonly ComponentDef[];
  return components?.length ? all.filter((c) => components.includes(c.type)) : [...all];
}

/** Índice breve del catálogo (lo que devuelve la tool `ui_catalog` sin detalle). */
export function catalogIndex(components?: string[]) {
  return selected(components).map((d) => ({
    type: d.type,
    category: d.category,
    description: d.description,
    whenToUse: d.whenToUse,
    container: !!d.children,
    ...(Array.isArray(d.children) ? { allowedChildren: d.children } : {}),
  }));
}

export interface PromptOptions {
  /** Restringir a estos componentes. */
  components?: string[];
  /** Incluir el JSON Schema de cada componente (más largo, más exacto). */
  schemas?: boolean;
  /** Incluir un ejemplo por componente. */
  examples?: boolean;
}

/** Instrucciones de sistema para que un modelo componga interfaces con el catálogo. */
export function catalogPrompt(opts: PromptOptions = {}): string {
  const defs = selected(opts.components);
  const byCat = new Map<Category, ComponentDef[]>();
  for (const d of defs) byCat.set(d.category, [...(byCat.get(d.category) ?? []), d]);

  const lines: string[] = [
    'Compón la respuesta visual como un árbol JSON de componentes del catálogo Orbital Elements.',
    '',
    'Formato de cada nodo: {"type": "<Componente>", "props": {...}, "children": [<nodos>]}.',
    'Reglas:',
    '- Usa SOLO los componentes y props del catálogo. Lo que no valida no se muestra.',
    '- La raíz suele ser un Stack. Solo los contenedores llevan "children".',
    '- El diseño (colores, tipografía, espaciado) lo pone el sistema: no describas estilos.',
    '- Tonos: critical/warning/success juzgan; info informa; brand destaca. El color nunca va solo: acompáñalo de texto.',
    '- Un dato que no existe es null, nunca 0. Porcentajes como fracción (0.25 = 25 %).',
    '- Elige la pieza más específica: cifras → Kpi/Kpis; evolución → Chart line; reparto → Chart donut;',
    '  proceso → Flow o Steps; cronología → Timeline; atributos → KeyValue; tabla → Table.',
    '- Empieza por lo importante (titular + KPIs o conclusión) y deja el detalle para después.',
    '',
    'Catálogo:',
  ];
  for (const [cat, list] of byCat) {
    lines.push('', `## ${CATEGORY_LABEL[cat]}`);
    for (const d of list) {
      const kids = Array.isArray(d.children) ? ` (hijos: ${d.children.join(', ')})` : d.children ? ' (contenedor)' : '';
      lines.push(`- ${d.type}${kids}: ${d.description} Cuándo: ${d.whenToUse}`);
      if (opts.schemas) lines.push(`  props: ${JSON.stringify(componentJsonSchema(d.type))}`);
      if (opts.examples) lines.push(`  ejemplo: ${JSON.stringify(d.example)}`);
    }
  }
  return lines.join('\n');
}
