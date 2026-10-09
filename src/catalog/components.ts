/**
 * Catálogo de Orbital Elements: QUÉ puede construir un agente.
 *
 * Cada componente declara sus props en Zod (la única fuente de verdad: de
 * aquí salen la validación, los JSON Schema para el modelo y los tipos de
 * React), su categoría, para qué sirve y cuándo usarlo. El agente no puede
 * inventar tipos ni props: lo que no valida, no se pinta.
 *
 * Inventario: las 21 secciones de `render_ui` (faro-orbital-tools) + lo que
 * faltaba según el catálogo de `orbital-documents` (diagramas de flujo,
 * línea de tiempo, heatmap, ranking, gauge, comparativa, cita, código…).
 */
import { z } from 'zod';

// ── Primitivas compartidas ──

export const Tone = z
  .enum(['neutral', 'brand', 'info', 'success', 'warning', 'critical'])
  .describe('Tono semántico. critical/warning/success juzgan; info informa; brand destaca; neutral no colorea.');

export const NumberFormat = z
  .enum(['number', 'integer', 'percent', 'currency', 'compact', 'duration'])
  .describe('Formato de cifra. percent espera fracción (0.25 = 25 %); duration espera segundos.');

const text = (d: string, max = 2000) => z.string().min(1).max(max).describe(d);
const optText = (d: string, max = 2000) => z.string().max(max).optional().describe(d);
const url = (d: string) =>
  z
    .string()
    .max(2048)
    .regex(/^https?:\/\//i, 'solo URLs http(s)')
    .describe(d);

const Gap = z.enum(['none', 'xs', 'sm', 'md', 'lg']).optional().describe('Separación entre hijos.');
const Payload = z.record(z.string(), z.unknown()).optional().describe('Datos que acompañan a la acción.');
const CellValue = z.union([z.string().max(500), z.number(), z.boolean(), z.null()]);
const Currency = z.string().regex(/^[A-Z]{3}$/).optional().describe('Código ISO 4217 (EUR, USD…).');

const ButtonSpec = z
  .object({
    label: text('Texto del botón', 60),
    action: text('Nombre de la acción que se emite al pulsar', 80),
    payload: Payload,
    variant: z.enum(['primary', 'secondary', 'ghost', 'danger']).optional(),
  })
  .strict();

// ── Definición de componente ──

export type Category = 'layout' | 'text' | 'data' | 'chart' | 'diagram' | 'feedback' | 'media' | 'interactive';

export interface ComponentDef<S extends z.ZodTypeAny = z.ZodTypeAny, T extends string = string> {
  type: T;
  category: Category;
  description: string;
  /** Guía de uso para el modelo: cuándo elegirlo (y cuándo no). */
  whenToUse: string;
  props: S;
  /** `true` acepta cualquier hijo; una lista restringe los tipos; ausente = hoja. */
  children?: true | readonly string[];
  /** Ejemplo mínimo (formato anidado) que también sirve de test. */
  example: { type: string; props: z.input<S>; children?: unknown[] };
}

function def<S extends z.ZodTypeAny, const T extends string>(d: ComponentDef<S, T>): ComponentDef<S, T> {
  return d;
}

// ── Layout ──

export const Stack = def({
  type: 'Stack',
  category: 'layout',
  description: 'Apila sus hijos en vertical u horizontal.',
  whenToUse: 'Contenedor raíz por defecto y para agrupar bloques en orden de lectura.',
  props: z
    .object({
      direction: z.enum(['vertical', 'horizontal']).optional(),
      gap: Gap,
      align: z.enum(['start', 'center', 'end', 'stretch']).optional(),
      wrap: z.boolean().optional(),
    })
    .strict(),
  children: true,
  example: { type: 'Stack', props: { gap: 'md' }, children: [] },
});

export const Grid = def({
  type: 'Grid',
  category: 'layout',
  description: 'Rejilla responsiva de 1 a 4 columnas (se pliega a una en pantallas estrechas).',
  whenToUse: 'Varias piezas del mismo peso lado a lado: tarjetas, KPIs sueltos, gráficos pequeños.',
  props: z.object({ columns: z.number().int().min(1).max(4).optional(), gap: Gap }).strict(),
  children: true,
  example: { type: 'Grid', props: { columns: 2 }, children: [] },
});

export const Card = def({
  type: 'Card',
  category: 'layout',
  description: 'Tarjeta con título, descripción y contenido; superficie elevada con sombra suave.',
  whenToUse: 'Agrupar un bloque con entidad propia. No anides tarjetas dentro de tarjetas.',
  props: z
    .object({
      title: optText('Título', 160),
      description: optText('Subtítulo o contexto', 400),
      tone: Tone.optional(),
      variant: z.enum(['default', 'outline', 'soft', 'elevated']).optional(),
      footer: optText('Pie de la tarjeta', 300),
    })
    .strict(),
  children: true,
  example: { type: 'Card', props: { title: 'Resumen', description: 'Últimos 30 días' }, children: [] },
});

export const Section = def({
  type: 'Section',
  category: 'layout',
  description: 'Bloque con cabecera (antetítulo, título, descripción) sin superficie propia.',
  whenToUse: 'Dividir una respuesta larga en apartados con título.',
  props: z
    .object({ title: text('Título', 160), eyebrow: optText('Antetítulo corto en mayúsculas', 40), description: optText('Descripción', 400) })
    .strict(),
  children: true,
  example: { type: 'Section', props: { title: 'Detalle' }, children: [] },
});

export const Tabs = def({
  type: 'Tabs',
  category: 'layout',
  description: 'Pestañas; cada hijo es un Tab.',
  whenToUse: 'Vistas alternativas del mismo asunto (p. ej. Resumen / Detalle / Datos).',
  props: z.object({ defaultTab: z.number().int().min(0).optional() }).strict(),
  children: ['Tab'],
  example: { type: 'Tabs', props: {}, children: [] },
});

export const Tab = def({
  type: 'Tab',
  category: 'layout',
  description: 'Una pestaña de Tabs.',
  whenToUse: 'Solo como hijo directo de Tabs.',
  props: z.object({ title: text('Título de la pestaña', 40) }).strict(),
  children: true,
  example: { type: 'Tab', props: { title: 'Resumen' }, children: [] },
});

export const Disclosure = def({
  type: 'Disclosure',
  category: 'layout',
  description: 'Bloque plegable con título.',
  whenToUse: 'Detalle secundario que no todos necesitan leer (metodología, datos crudos).',
  props: z.object({ title: text('Título', 160), open: z.boolean().optional() }).strict(),
  children: true,
  example: { type: 'Disclosure', props: { title: 'Ver metodología' }, children: [] },
});

// ── Texto ──

export const Heading = def({
  type: 'Heading',
  category: 'text',
  description: 'Titular de nivel 1 a 3, con antetítulo opcional.',
  whenToUse: 'Encabezar la respuesta o un apartado. La jerarquía la marca el nivel, no el color.',
  props: z
    .object({ text: text('Texto', 200), level: z.number().int().min(1).max(3).optional(), eyebrow: optText('Antetítulo', 40) })
    .strict(),
  example: { type: 'Heading', props: { text: 'Informe semanal', level: 1 } },
});

export const Text = def({
  type: 'Text',
  category: 'text',
  description: 'Párrafo. Admite markdown básico (negrita, cursiva, código, enlaces http(s), listas, títulos).',
  whenToUse: 'Explicaciones y conclusiones. Para cifras usa Kpi; para avisos, Alert.',
  props: z
    .object({
      text: text('Contenido', 8000),
      variant: z.enum(['body', 'lead', 'muted', 'caption']).optional(),
      markdown: z.boolean().optional().describe('Interpretar markdown (por defecto true).'),
    })
    .strict(),
  example: { type: 'Text', props: { text: 'Las ventas crecen un **12 %** respecto al mes anterior.' } },
});

export const Quote = def({
  type: 'Quote',
  category: 'text',
  description: 'Cita destacada con autor o fuente.',
  whenToUse: 'Reproducir literalmente lo que dijo alguien o un documento.',
  props: z.object({ text: text('Cita', 1200), cite: optText('Autor', 120), source: optText('Fuente', 200) }).strict(),
  example: { type: 'Quote', props: { text: 'Lo que no se mide no se puede mejorar.', cite: 'Peter Drucker' } },
});

export const Code = def({
  type: 'Code',
  category: 'text',
  description: 'Bloque de código o texto preformateado (monoespaciado, con botón de copiar).',
  whenToUse: 'Comandos, configuraciones, fragmentos de código, JSON.',
  props: z.object({ code: text('Código', 12000), language: optText('Lenguaje', 30), title: optText('Nombre del fichero', 120) }).strict(),
  example: { type: 'Code', props: { code: 'npm i @cas-ia/orbital-elements', language: 'bash' } },
});

export const Divider = def({
  type: 'Divider',
  category: 'text',
  description: 'Separador horizontal.',
  whenToUse: 'Separar bloques sin tarjeta. Úsalo con moderación.',
  props: z.object({ label: optText('Texto centrado opcional', 60) }).strict(),
  example: { type: 'Divider', props: {} },
});

// ── Datos ──

const KpiProps = z
  .object({
    label: text('Qué mide', 80),
    value: z.union([z.number(), z.string().max(60), z.null()]).describe('Cifra. null = sin dato (nunca uses 0 para "no hay dato").'),
    format: NumberFormat.optional(),
    currency: Currency,
    suffix: optText('Sufijo pegado a la cifra (p. ej. "/10")', 12),
    delta: z.number().optional().describe('Variación respecto al periodo anterior como fracción (0.12 = +12 %).'),
    deltaLabel: optText('Texto de la variación si no es numérica', 30),
    goodWhen: z.enum(['up', 'down']).optional().describe('Si subir es bueno (por defecto up) o malo (p. ej. tiempos, errores).'),
    context: optText('Línea de contexto bajo la cifra', 120),
    sparkline: z.array(z.number()).max(120).optional().describe('Serie corta para la tendencia.'),
    tone: Tone.optional(),
  })
  .strict();

export const Kpi = def({
  type: 'Kpi',
  category: 'data',
  description: 'Cifra destacada con etiqueta, variación y tendencia opcionales.',
  whenToUse: 'Una métrica clave. Para varias a la vez usa Kpis.',
  props: KpiProps,
  example: { type: 'Kpi', props: { label: 'Ingresos', value: 128400, format: 'currency', currency: 'EUR', delta: 0.12 } },
});

export const Kpis = def({
  type: 'Kpis',
  category: 'data',
  description: 'Fila responsiva de KPIs.',
  whenToUse: 'Resumen de 2 a 6 métricas al principio de un informe.',
  props: z.object({ items: z.array(KpiProps).min(1).max(8) }).strict(),
  example: {
    type: 'Kpis',
    props: { items: [{ label: 'Pedidos', value: 1240, delta: 0.08 }, { label: 'Tiempo medio', value: 312, format: 'duration', delta: -0.05, goodWhen: 'down' }] },
  },
});

export const Table = def({
  type: 'Table',
  category: 'data',
  description: 'Tabla con columnas tipadas (formato y alineación), cabecera fija y desplazamiento horizontal.',
  whenToUse: 'Datos tabulares con varias columnas. Para pares etiqueta-valor usa KeyValue.',
  props: z
    .object({
      columns: z
        .array(
          z
            .object({
              key: text('Clave en cada fila', 60),
              label: text('Cabecera', 80),
              align: z.enum(['start', 'center', 'end']).optional(),
              format: NumberFormat.optional(),
              currency: Currency,
            })
            .strict(),
        )
        .min(1)
        .max(12),
      rows: z.array(z.record(z.string(), CellValue)).max(200),
      caption: optText('Pie de tabla', 200),
      dense: z.boolean().optional(),
    })
    .strict(),
  example: {
    type: 'Table',
    props: { columns: [{ key: 'name', label: 'Nombre' }, { key: 'total', label: 'Total', format: 'currency', currency: 'EUR', align: 'end' }], rows: [{ name: 'Norte', total: 1200 }] },
  },
});

export const KeyValue = def({
  type: 'KeyValue',
  category: 'data',
  description: 'Lista de pares etiqueta → valor (ficha de datos).',
  whenToUse: 'Atributos de una entidad: cliente, pedido, incidente.',
  props: z
    .object({
      items: z.array(z.object({ label: text('Etiqueta', 80), value: z.union([z.string().max(500), z.number(), z.boolean(), z.null()]), tone: Tone.optional() }).strict()).min(1).max(40),
      columns: z.number().int().min(1).max(2).optional(),
    })
    .strict(),
  example: { type: 'KeyValue', props: { items: [{ label: 'Cliente', value: 'ACME' }, { label: 'Estado', value: 'Activo', tone: 'success' }] } },
});

export const List = def({
  type: 'List',
  category: 'data',
  description: 'Lista de viñetas, numerada, de tareas (check) o de tarjetas con título y descripción.',
  whenToUse: 'Enumeraciones. Para pasos de un proceso usa Steps; para hechos fechados, Timeline.',
  props: z
    .object({
      items: z
        .array(
          z.union([
            z.string().min(1).max(500),
            z
              .object({
                title: text('Título', 200),
                description: optText('Descripción', 600),
                meta: optText('Dato a la derecha', 60),
                tone: Tone.optional(),
                done: z.boolean().optional(),
              })
              .strict(),
          ]),
        )
        .min(1)
        .max(60),
      variant: z.enum(['bullets', 'numbered', 'check', 'cards']).optional(),
    })
    .strict(),
  example: { type: 'List', props: { items: ['Revisar contrato', 'Enviar propuesta'], variant: 'bullets' } },
});

export const Badges = def({
  type: 'Badges',
  category: 'data',
  description: 'Fila de etiquetas cortas con tono.',
  whenToUse: 'Etiquetas, categorías o estados breves.',
  props: z.object({ items: z.array(z.object({ text: text('Texto', 40), tone: Tone.optional() }).strict()).min(1).max(24) }).strict(),
  example: { type: 'Badges', props: { items: [{ text: 'Urgente', tone: 'critical' }, { text: 'Cliente VIP', tone: 'brand' }] } },
});

export const Status = def({
  type: 'Status',
  category: 'data',
  description: 'Semáforo: indicador de estado con punto de color, etiqueta y detalle. El color nunca va solo.',
  whenToUse: 'El estado de algo (servicio, proyecto, riesgo). Sin medir → status noData, no success.',
  props: z
    .object({
      label: text('Qué se evalúa', 120),
      status: z.enum(['success', 'warning', 'critical', 'info', 'neutral', 'noData']),
      value: optText('Lectura (p. ej. "Operativo", "3 incidencias")', 80),
      description: optText('Detalle', 300),
    })
    .strict(),
  example: { type: 'Status', props: { label: 'API de pagos', status: 'success', value: 'Operativo' } },
});

export const Progress = def({
  type: 'Progress',
  category: 'data',
  description: 'Barra de avance con etiqueta y valor.',
  whenToUse: 'Avance hacia un objetivo o porcentaje completado.',
  props: z
    .object({
      value: z.number(),
      max: z.number().positive().optional(),
      label: optText('Etiqueta', 120),
      format: NumberFormat.optional(),
      tone: Tone.optional(),
    })
    .strict(),
  example: { type: 'Progress', props: { label: 'Objetivo trimestral', value: 72, max: 100 } },
});

export const Gauge = def({
  type: 'Gauge',
  category: 'data',
  description: 'Indicador semicircular de un valor dentro de un rango, con umbrales de color.',
  whenToUse: 'Una lectura respecto a límites (puntuación, ocupación, riesgo).',
  props: z
    .object({
      value: z.number(),
      min: z.number().optional(),
      max: z.number().optional(),
      label: optText('Etiqueta', 80),
      format: NumberFormat.optional(),
      thresholds: z
        .array(z.object({ upTo: z.number(), tone: Tone }).strict())
        .max(5)
        .optional()
        .describe('Tramos ascendentes: hasta upTo se pinta con tone.'),
    })
    .strict(),
  example: { type: 'Gauge', props: { label: 'NPS', value: 42, min: -100, max: 100 } },
});

export const Ranking = def({
  type: 'Ranking',
  category: 'data',
  description: 'Clasificación ordenada con barra proporcional.',
  whenToUse: 'Top N: los que más venden, los más afectados, etc.',
  props: z
    .object({
      items: z.array(z.object({ label: text('Elemento', 120), value: z.number(), note: optText('Nota', 80) }).strict()).min(1).max(50),
      format: NumberFormat.optional(),
      currency: Currency,
      limit: z.number().int().min(1).max(50).optional(),
    })
    .strict(),
  example: { type: 'Ranking', props: { items: [{ label: 'Madrid', value: 420 }, { label: 'Sevilla', value: 310 }] } },
});

export const Comparison = def({
  type: 'Comparison',
  category: 'data',
  description: 'Comparativa de opciones (columnas) por criterios (filas). Booleanos se pintan como ✓/✕.',
  whenToUse: 'Elegir entre alternativas: planes, proveedores, escenarios.',
  props: z
    .object({
      options: z.array(z.object({ title: text('Opción', 60), highlight: z.boolean().optional(), note: optText('Nota', 80) }).strict()).min(2).max(5),
      rows: z.array(z.object({ label: text('Criterio', 120), values: z.array(CellValue).min(1).max(5) }).strict()).min(1).max(30),
    })
    .strict(),
  example: {
    type: 'Comparison',
    props: { options: [{ title: 'Básico' }, { title: 'Pro', highlight: true }], rows: [{ label: 'Usuarios', values: [5, 50] }, { label: 'Soporte 24 h', values: [false, true] }] },
  },
});

// ── Gráficos ──

export const Chart = def({
  type: 'Chart',
  category: 'chart',
  description: 'Gráfico de barras (vertical, horizontal o apilado), línea, área, donut o tarta, con leyenda y valores.',
  whenToUse: 'Comparar categorías (bar/hbar), ver evolución (line/area) o reparto de un total (donut, ≤ 6 partes).',
  props: z
    .object({
      kind: z.enum(['bar', 'hbar', 'stacked-bar', 'line', 'area', 'donut', 'pie']),
      labels: z.array(z.string().max(60)).min(1).max(200).describe('Categorías del eje X (o segmentos en donut/pie).'),
      series: z
        .array(z.object({ name: text('Nombre de la serie', 60), data: z.array(z.number().nullable()).min(1).max(200) }).strict())
        .min(1)
        .max(8),
      title: optText('Título', 160),
      format: NumberFormat.optional(),
      currency: Currency,
      showValues: z.boolean().optional(),
      height: z.number().int().min(120).max(480).optional(),
    })
    .strict(),
  example: {
    type: 'Chart',
    props: { kind: 'bar', labels: ['Ene', 'Feb', 'Mar'], series: [{ name: 'Ventas', data: [120, 180, 150] }] },
  },
});

export const Sparkline = def({
  type: 'Sparkline',
  category: 'chart',
  description: 'Mini gráfico de línea en línea con el texto.',
  whenToUse: 'Tendencia compacta junto a una cifra o en una tabla.',
  props: z.object({ data: z.array(z.number()).min(2).max(200), label: optText('Descripción accesible', 120), tone: Tone.optional() }).strict(),
  example: { type: 'Sparkline', props: { data: [3, 5, 4, 7, 9, 8] } },
});

export const Heatmap = def({
  type: 'Heatmap',
  category: 'chart',
  description: 'Matriz de calor: filas × columnas con intensidad de color por valor.',
  whenToUse: 'Patrones en dos dimensiones (día × hora, región × producto).',
  props: z
    .object({
      rows: z.array(z.string().max(60)).min(1).max(40),
      columns: z.array(z.string().max(40)).min(1).max(40),
      values: z.array(z.array(z.number().nullable())).min(1).max(40),
      format: NumberFormat.optional(),
      scale: z.enum(['sequential', 'diverging']).optional(),
    })
    .strict(),
  example: { type: 'Heatmap', props: { rows: ['Lun', 'Mar'], columns: ['Mañana', 'Tarde'], values: [[3, 8], [5, 2]] } },
});

// ── Diagramas ──

export const Flow = def({
  type: 'Flow',
  category: 'diagram',
  description: 'Diagrama de flujo: nodos (inicio, proceso, decisión, dato, fin, nota) unidos por flechas con etiqueta. Se maqueta solo.',
  whenToUse: 'Procesos, decisiones, arquitecturas, recorridos. Hasta 40 nodos.',
  props: z
    .object({
      direction: z.enum(['LR', 'TB']).optional().describe('LR = izquierda→derecha (por defecto), TB = arriba→abajo.'),
      nodes: z
        .array(
          z
            .object({
              id: z.string().min(1).max(40).regex(/^[\w-]+$/),
              label: text('Texto del nodo', 80),
              kind: z.enum(['start', 'end', 'process', 'decision', 'data', 'note']).optional(),
              tone: Tone.optional(),
            })
            .strict(),
        )
        .min(1)
        .max(40),
      edges: z
        .array(
          z
            .object({
              from: z.string().min(1).max(40),
              to: z.string().min(1).max(40),
              label: optText('Etiqueta de la flecha', 40),
              dashed: z.boolean().optional(),
            })
            .strict(),
        )
        .max(80),
    })
    .strict(),
  example: {
    type: 'Flow',
    props: {
      nodes: [
        { id: 'a', label: 'Solicitud', kind: 'start' },
        { id: 'b', label: '¿Aprobada?', kind: 'decision' },
        { id: 'c', label: 'Enviar', kind: 'end', tone: 'success' },
      ],
      edges: [{ from: 'a', to: 'b' }, { from: 'b', to: 'c', label: 'sí' }],
    },
  },
});

export const Timeline = def({
  type: 'Timeline',
  category: 'diagram',
  description: 'Línea de tiempo vertical de hechos fechados.',
  whenToUse: 'Historial, cronología de un incidente, hitos.',
  props: z
    .object({
      items: z
        .array(z.object({ date: optText('Fecha u hora (texto libre)', 40), title: text('Hecho', 160), description: optText('Detalle', 500), tone: Tone.optional() }).strict())
        .min(1)
        .max(40),
    })
    .strict(),
  example: { type: 'Timeline', props: { items: [{ date: '09:12', title: 'Alerta recibida', tone: 'warning' }, { date: '09:30', title: 'Resuelto', tone: 'success' }] } },
});

export const Steps = def({
  type: 'Steps',
  category: 'diagram',
  description: 'Pasos de un proceso con estado (pendiente, en curso, hecho, error).',
  whenToUse: 'Avance por fases o instrucciones a seguir en orden.',
  props: z
    .object({
      steps: z
        .array(z.object({ title: text('Paso', 120), description: optText('Detalle', 400), status: z.enum(['pending', 'active', 'done', 'error']).optional() }).strict())
        .min(1)
        .max(20),
      orientation: z.enum(['vertical', 'horizontal']).optional(),
    })
    .strict(),
  example: { type: 'Steps', props: { steps: [{ title: 'Datos', status: 'done' }, { title: 'Revisión', status: 'active' }, { title: 'Firma' }] } },
});

// ── Avisos ──

export const Alert = def({
  type: 'Alert',
  category: 'feedback',
  description: 'Aviso destacado con icono y tono.',
  whenToUse: 'Algo que el usuario debe ver: riesgo, requisito, confirmación de éxito.',
  props: z.object({ message: text('Mensaje (admite markdown básico)', 2000), title: optText('Título', 120), tone: Tone.optional() }).strict(),
  example: { type: 'Alert', props: { tone: 'warning', title: 'Revisión pendiente', message: 'Faltan **2 firmas**.' } },
});

export const EmptyState = def({
  type: 'EmptyState',
  category: 'feedback',
  description: 'Estado vacío explicado («no hay nada» con motivo y siguiente paso).',
  whenToUse: 'Cuando una búsqueda o consulta no devuelve resultados. Un vacío mudo parece un fallo.',
  props: z.object({ title: text('Título', 120), description: optText('Explicación', 400) }).strict(),
  example: { type: 'EmptyState', props: { title: 'Sin incidencias', description: 'No hay incidencias abiertas esta semana.' } },
});

// ── Medios ──

export const Media = def({
  type: 'Media',
  category: 'media',
  description: 'Imagen, vídeo (incl. YouTube/Vimeo) o audio por URL http(s).',
  whenToUse: 'Mostrar un recurso visual o sonoro con pie.',
  props: z
    .object({
      url: url('URL del recurso'),
      kind: z.enum(['auto', 'image', 'video', 'audio']).optional(),
      alt: optText('Texto alternativo (obligatorio de facto en imágenes)', 300),
      caption: optText('Pie', 300),
      poster: url('Imagen de portada del vídeo').optional(),
    })
    .strict(),
  example: { type: 'Media', props: { url: 'https://picsum.photos/640/360', alt: 'Ejemplo', caption: 'Imagen de ejemplo' } },
});

export const Links = def({
  type: 'Links',
  category: 'media',
  description: 'Lista de enlaces o de fuentes citadas (con dominio y descripción).',
  whenToUse: 'Referencias, documentación, fuentes de una respuesta.',
  props: z
    .object({
      items: z
        .array(z.object({ text: text('Texto', 160), href: url('URL'), description: optText('Descripción', 300) }).strict())
        .min(1)
        .max(30),
      variant: z.enum(['list', 'sources', 'cards']).optional(),
    })
    .strict(),
  example: { type: 'Links', props: { variant: 'sources', items: [{ text: 'Documentación', href: 'https://example.com/docs' }] } },
});

// ── Interacción (emiten acciones; el host decide qué hacer) ──

export const Actions = def({
  type: 'Actions',
  category: 'interactive',
  description: 'Pregunta opcional + fila de botones; cada botón emite su acción.',
  whenToUse: 'Proponer siguientes pasos concretos al usuario.',
  props: z.object({ question: optText('Pregunta', 300), buttons: z.array(ButtonSpec).min(1).max(6) }).strict(),
  example: { type: 'Actions', props: { question: '¿Qué quieres hacer?', buttons: [{ label: 'Ver detalle', action: 'show_detail', variant: 'primary' }] } },
});

export const Options = def({
  type: 'Options',
  category: 'interactive',
  description: 'Elección entre alternativas (una o varias) presentadas como tarjetas seleccionables.',
  whenToUse: 'Pedir al usuario que elija para continuar.',
  props: z
    .object({
      question: optText('Pregunta', 300),
      options: z.array(z.object({ value: text('Valor', 80), label: text('Etiqueta', 120), description: optText('Detalle', 300) }).strict()).min(2).max(12),
      multi: z.boolean().optional(),
      action: optText('Acción emitida (por defecto "select")', 80),
    })
    .strict(),
  example: { type: 'Options', props: { question: '¿Qué plan prefieres?', options: [{ value: 'a', label: 'Mensual' }, { value: 'b', label: 'Anual', description: '2 meses gratis' }] } },
});

export const Form = def({
  type: 'Form',
  category: 'interactive',
  description: 'Formulario con validación de obligatorios y un único envío.',
  whenToUse: 'Recoger datos estructurados del usuario.',
  props: z
    .object({
      fields: z
        .array(
          z
            .object({
              name: z.string().min(1).max(60).regex(/^[\w-]+$/),
              label: text('Etiqueta', 120),
              type: z.enum(['text', 'email', 'number', 'date', 'textarea', 'select', 'boolean']),
              required: z.boolean().optional(),
              placeholder: optText('Ejemplo', 120),
              options: z.array(z.object({ value: z.string().max(80), label: z.string().max(120) }).strict()).max(50).optional(),
              help: optText('Ayuda bajo el campo', 200),
            })
            .strict(),
        )
        .min(1)
        .max(20),
      submitLabel: optText('Texto del botón', 40),
      action: optText('Acción emitida (por defecto "submit")', 80),
    })
    .strict(),
  example: { type: 'Form', props: { fields: [{ name: 'email', label: 'Correo', type: 'email', required: true }], submitLabel: 'Enviar' } },
});

export const Confirmation = def({
  type: 'Confirmation',
  category: 'interactive',
  description: 'Confirmar o cancelar una operación.',
  whenToUse: 'Antes de ejecutar algo con consecuencias.',
  props: z
    .object({
      title: optText('Título', 120),
      message: text('Qué se va a hacer', 1000),
      tone: Tone.optional(),
      confirmLabel: optText('Botón confirmar', 40),
      cancelLabel: optText('Botón cancelar', 40),
      payload: Payload,
    })
    .strict(),
  example: { type: 'Confirmation', props: { message: 'Se enviarán 120 correos.', confirmLabel: 'Enviar' } },
});

export const Approval = def({
  type: 'Approval',
  category: 'interactive',
  description: 'Aprobación humana de una acción pendiente (resumen + datos + aprobar/rechazar).',
  whenToUse: 'Human-in-the-loop: el agente necesita permiso explícito.',
  props: z
    .object({
      title: text('Qué se aprueba', 160),
      summary: optText('Resumen', 1000),
      rows: z.array(z.object({ label: text('Etiqueta', 80), value: z.string().max(300) }).strict()).max(20).optional(),
      destructive: z.boolean().optional(),
      pendingActionId: text('Id de la acción pendiente', 120),
      approveLabel: optText('Botón aprobar', 40),
      rejectLabel: optText('Botón rechazar', 40),
    })
    .strict(),
  example: { type: 'Approval', props: { title: 'Reembolso de 240 €', pendingActionId: 'act_123', rows: [{ label: 'Cliente', value: 'ACME' }] } },
});

export const Product = def({
  type: 'Product',
  category: 'interactive',
  description: 'Ficha de producto o servicio: imagen, precio, etiquetas, atributos y acción.',
  whenToUse: 'Recomendar o presentar un producto concreto.',
  props: z
    .object({
      title: text('Nombre', 160),
      image: url('Imagen').optional(),
      price: z.union([z.number(), z.string().max(40)]).optional(),
      currency: Currency,
      description: optText('Descripción', 800),
      badges: z.array(z.object({ text: text('Texto', 40), tone: Tone.optional() }).strict()).max(6).optional(),
      attributes: z.array(z.object({ label: text('Atributo', 60), value: z.string().max(200) }).strict()).max(12).optional(),
      action: ButtonSpec.optional(),
    })
    .strict(),
  example: { type: 'Product', props: { title: 'Plan Pro', price: 49, currency: 'EUR', description: 'Para equipos.' } },
});

export const COMPONENTS = [
  Stack, Grid, Card, Section, Tabs, Tab, Disclosure,
  Heading, Text, Quote, Code, Divider,
  Kpi, Kpis, Table, KeyValue, List, Badges, Status, Progress, Gauge, Ranking, Comparison,
  Chart, Sparkline, Heatmap,
  Flow, Timeline, Steps,
  Alert, EmptyState,
  Media, Links,
  Actions, Options, Form, Confirmation, Approval, Product,
] as const;

export type ComponentType = (typeof COMPONENTS)[number]['type'];
export type PropsOf<T extends ComponentType> = z.infer<Extract<(typeof COMPONENTS)[number], { type: T }>['props']>;

export const CATALOG: ReadonlyMap<string, ComponentDef> = new Map(COMPONENTS.map((c) => [c.type, c as ComponentDef]));
