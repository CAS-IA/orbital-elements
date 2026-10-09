/**
 * @cas-ia/orbital-elements/tools — las dos tools que un agente necesita para
 * construir interfaces:
 *
 *  1. `ui_catalog` — consulta el catálogo: índice de componentes y, para los
 *     que vaya a usar, su schema exacto y un ejemplo. Así el prompt de
 *     sistema no carga ~40 componentes en cada llamada.
 *  2. `render_ui` — envía la interfaz. Se valida contra el catálogo; si algo
 *     falla devuelve los errores con su ruta para que el agente corrija y
 *     reintente. La spec válida es la que pinta el cliente.
 *
 * Agnósticas del framework: cada tool es `{ name, description, inputSchema,
 * execute }`, y `toAnthropicTools` / `toOpenAITools` / `toMcpTools` las
 * adaptan al formato de cada proveedor. Sin dependencias de Workers.
 */
import {
  CATALOG,
  catalogIndex,
  componentJsonSchema,
  formatIssues,
  fromRenderUi,
  isRenderUiInput,
  specJsonSchema,
  toNested,
  validateSpec,
  type FlatSpec,
  type SpecIssue,
} from '../catalog';

export interface ToolDef<I, O> {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute(input: I): O;
}

// ── ui_catalog ──

export interface UiCatalogInput {
  /** Componentes de los que se quiere el detalle (schema + ejemplo). */
  components?: string[];
  /** Filtrar el índice por categoría. */
  category?: string;
}

export interface UiCatalogOutput {
  components: ReturnType<typeof catalogIndex>;
  details?: Array<{ type: string; props: Record<string, unknown> | null; example: unknown }>;
  unknown?: string[];
  guidance: string;
}

export const uiCatalogTool: ToolDef<UiCatalogInput, UiCatalogOutput> = {
  name: 'ui_catalog',
  description:
    'Consulta el catálogo de componentes de interfaz (Orbital Elements). Sin argumentos devuelve el índice: qué componentes existen y cuándo usar cada uno. ' +
    'Con "components" devuelve el schema exacto de props y un ejemplo de esos componentes. Úsala antes de render_ui si no conoces las props.',
  inputSchema: {
    type: 'object',
    properties: {
      components: { type: 'array', items: { type: 'string', enum: [...CATALOG.keys()] }, description: 'Componentes de los que quieres el schema y un ejemplo.' },
      category: { type: 'string', enum: ['layout', 'text', 'data', 'chart', 'diagram', 'feedback', 'media', 'interactive'] },
    },
  },
  execute(input) {
    const all = catalogIndex();
    const components = input?.category ? all.filter((c) => c.category === input.category) : all;
    const wanted = Array.isArray(input?.components) ? input.components : [];
    const details = wanted.filter((t) => CATALOG.has(t)).map((t) => ({ type: t, props: componentJsonSchema(t), example: CATALOG.get(t)!.example }));
    const unknown = wanted.filter((t) => !CATALOG.has(t));
    return {
      components,
      ...(details.length ? { details } : {}),
      ...(unknown.length ? { unknown } : {}),
      guidance:
        'Nodo: {"type","props","children"?}. Raíz: Stack. Datos ausentes = null. Porcentajes como fracción. ' +
        'El estilo lo pone el sistema: no describas colores ni tamaños.',
    };
  },
};

// ── render_ui ──

export interface RenderUiInput {
  /** Árbol de la interfaz (formato anidado) o lista de nodos. */
  ui?: unknown;
  /** Título opcional (se pinta como Heading). */
  title?: string;
  /** Compatibilidad: input del render_ui anterior (`sections[]`). */
  sections?: unknown[];
}

export interface RenderUiOutput {
  ok: boolean;
  /** Spec validada y normalizada (plana): es lo que pinta el cliente. */
  spec: FlatSpec;
  issues: SpecIssue[];
  /** Mensaje para el modelo: confirmación o errores a corregir. */
  message: string;
}

export const renderUiTool: ToolDef<RenderUiInput, RenderUiOutput> = {
  name: 'render_ui',
  description:
    'Muestra al usuario una interfaz construida con componentes del catálogo Orbital Elements (tarjetas, KPIs, tablas, gráficos, diagramas de flujo, ' +
    'líneas de tiempo, formularios…). Envía el árbol en "ui". Si la respuesta trae issues, corrige esos nodos y vuelve a llamar. ' +
    'Usa ui_catalog para conocer las props exactas.',
  inputSchema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Título opcional de la vista.' },
      ui: { ...specJsonSchema(), description: 'Raíz del árbol (normalmente un Stack).' },
    },
    required: ['ui'],
  },
  execute(input) {
    let tree: unknown = input?.ui;
    if (!tree && isRenderUiInput(input)) tree = fromRenderUi(input);
    if (tree && input?.title) {
      tree = { type: 'Stack', props: { gap: 'md' }, children: [{ type: 'Heading', props: { text: input.title, level: 2 } }, ...(Array.isArray(tree) ? tree : [tree])] };
    }
    const { valid, spec, issues } = validateSpec(tree);
    const rendered = Object.keys(spec.elements).length;
    return {
      ok: valid,
      spec,
      issues,
      message: valid
        ? `Interfaz mostrada (${rendered} elementos).`
        : `Se muestra lo válido (${rendered} elementos), pero hay errores. Corrígelos y vuelve a llamar a render_ui:\n${formatIssues(issues)}`,
    };
  },
};

export const TOOLS = [uiCatalogTool, renderUiTool] as const;

// ── Adaptadores por proveedor ──

/** Formato Anthropic Messages API (`tools: [{ name, description, input_schema }]`). */
export function toAnthropicTools(tools: readonly ToolDef<any, any>[] = TOOLS) {
  return tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.inputSchema }));
}

/** Formato OpenAI (function calling). */
export function toOpenAITools(tools: readonly ToolDef<any, any>[] = TOOLS) {
  return tools.map((t) => ({ type: 'function' as const, function: { name: t.name, description: t.description, parameters: t.inputSchema } }));
}

/** Formato MCP (`tools/list`). */
export function toMcpTools(tools: readonly ToolDef<any, any>[] = TOOLS) {
  return tools.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema }));
}

/** Ejecuta una tool por nombre (para el bucle del agente). */
export function executeTool(name: string, input: unknown): unknown {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) throw new Error(`tool desconocida: ${name}`);
  return (tool.execute as (i: unknown) => unknown)(input ?? {});
}

export { toNested };
