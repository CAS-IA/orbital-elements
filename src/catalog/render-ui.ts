/**
 * Compatibilidad: convierte el input de la tool `render_ui` actual
 * (`{ title?, sections[] }`, contrato en faro-orbital-tools
 * `src/a2ui/sections/schema.ts`) a una spec de Orbital Elements.
 *
 * Así lo que ya generan los agentes de hoy se pinta con el diseño nuevo sin
 * tocar las tools, y la migración puede hacerse sin prisa.
 *
 * Acciones: los botones de render_ui llevan `payload` con `_intent`; aquí la
 * acción se llama como el `_intent` (o `action`) y el payload se conserva.
 */
import type { SpecNode } from './spec';

type Section = { type?: string; [k: string]: unknown };

const TONE: Record<string, string> = { info: 'info', warning: 'warning', danger: 'critical', success: 'success', primary: 'brand' };
const tone = (t: unknown) => (typeof t === 'string' ? TONE[t] : undefined);
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v : undefined);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

function clean<T extends Record<string, unknown>>(o: T): T {
  for (const k of Object.keys(o)) if (o[k] === undefined) delete o[k];
  return o;
}

function button(b: unknown, fallbackVariant?: string) {
  const o = obj(b);
  const payload = obj(o.payload);
  const variant = str(o.variant) ?? fallbackVariant;
  return clean({
    label: str(o.label) ?? 'Continuar',
    action: str(payload._intent) ?? 'action',
    payload: Object.keys(payload).length ? payload : undefined,
    variant: variant === 'tertiary' ? 'ghost' : variant,
  });
}

function section(s: Section): SpecNode | SpecNode[] | null {
  switch (s.type) {
    case 'text': {
      const content = str(s.content) ?? '';
      if (s.variant === 'heading') return { type: 'Heading', props: { text: content, level: 2 } };
      if (s.variant === 'subheading') return { type: 'Heading', props: { text: content, level: 3 } };
      return { type: 'Text', props: clean({ text: content, variant: s.variant === 'caption' ? 'caption' : undefined, markdown: s.markdown === false ? false : true }) };
    }
    case 'card': {
      const children: SpecNode[] = [];
      if (str(s.image)) children.push({ type: 'Media', props: { url: s.image as string, kind: 'image', alt: str(s.title) ?? '' } });
      if (s.cta) children.push({ type: 'Actions', props: { buttons: [button(s.cta, 'primary')] } });
      return { type: 'Card', props: clean({ title: str(s.title), description: str(s.body), tone: tone(s.tone) }), children };
    }
    case 'list': {
      const items = arr(s.items).map((it) =>
        typeof it === 'string' ? it : clean({ title: str(obj(it).title) ?? '', description: str(obj(it).body) }),
      );
      const rich = items.some((i) => typeof i !== 'string');
      const list: SpecNode = { type: 'List', props: { items, variant: rich ? 'cards' : 'bullets' } };
      return str(s.title) ? { type: 'Section', props: { title: s.title as string }, children: [list] } : list;
    }
    case 'kpis': {
      const items = arr(s.items).map((k) => {
        const o = obj(k);
        return clean({
          label: str(o.label) ?? '',
          value: (typeof o.value === 'number' || typeof o.value === 'string' ? o.value : null) as number | string | null,
          deltaLabel: str(o.trendValue),
          tone: tone(o.tone) ?? (o.trend === 'up' ? 'success' : o.trend === 'down' ? 'critical' : undefined),
        });
      });
      const node: SpecNode = { type: 'Kpis', props: { items } };
      return str(s.title) ? { type: 'Section', props: { title: s.title as string }, children: [node] } : node;
    }
    case 'form':
      return {
        type: 'Form',
        props: clean({
          fields: arr(s.fields).map((f) => {
            const o = obj(f);
            return clean({ name: str(o.name) ?? 'campo', label: str(o.label) ?? '', type: str(o.type) ?? 'text', required: o.required === true ? true : undefined, placeholder: str(o.placeholder) });
          }),
          submitLabel: str(s.submitLabel),
          action: str(obj(s.submitPayload)._intent) ?? 'submit',
        }),
      };
    case 'actions':
      return { type: 'Actions', props: clean({ question: str(s.question), buttons: arr(s.buttons).map((b) => button(b)) }) };
    case 'divider':
      return { type: 'Divider', props: {} };
    case 'options':
      return {
        type: 'Options',
        props: clean({
          question: str(s.question),
          options: arr(s.options).map((o) => clean({ value: str(obj(o).value) ?? '', label: str(obj(o).label) ?? '', description: str(obj(o).description) })),
          multi: s.multi === true ? true : undefined,
          action: 'selection',
        }),
      };
    case 'confirmation':
      return {
        type: 'Confirmation',
        props: clean({ title: str(s.title), message: str(s.message) ?? '', tone: tone(s.tone), confirmLabel: str(s.confirmLabel), cancelLabel: str(s.cancelLabel), payload: s.payload ? obj(s.payload) : undefined }),
      };
    case 'approval':
      return {
        type: 'Approval',
        props: clean({
          title: str(s.title) ?? '',
          summary: str(s.summary),
          rows: s.rows ? arr(s.rows).map((r) => ({ label: str(obj(r).label) ?? '', value: String(obj(r).value ?? '') })) : undefined,
          destructive: s.destructive === true ? true : undefined,
          pendingActionId: str(s.pendingActionId) ?? '',
          approveLabel: str(s.approveLabel),
          rejectLabel: str(s.rejectLabel),
        }),
      };
    case 'alert':
      return { type: 'Alert', props: clean({ message: str(s.message) ?? '', title: str(s.title), tone: tone(s.tone) ?? 'info' }) };
    case 'badges': {
      const node: SpecNode = { type: 'Badges', props: { items: arr(s.items).map((b) => clean({ text: str(obj(b).text) ?? '', tone: tone(obj(b).tone) })) } };
      return str(s.title) ? { type: 'Section', props: { title: s.title as string }, children: [node] } : node;
    }
    case 'progress':
      return { type: 'Progress', props: clean({ value: Number(s.value) || 0, max: typeof s.max === 'number' ? s.max : undefined, label: str(s.label), tone: tone(s.tone) }) };
    case 'links': {
      const node: SpecNode = { type: 'Links', props: { items: arr(s.items).map((l) => ({ text: str(obj(l).text) ?? '', href: str(obj(l).href) ?? '' })) } };
      return str(s.title) ? { type: 'Section', props: { title: s.title as string }, children: [node] } : node;
    }
    case 'table':
      return {
        type: 'Table',
        props: clean({
          columns: arr(s.columns).map((c) => clean({ key: str(obj(c).key) ?? '', label: str(obj(c).label) ?? '', align: str(obj(c).align) })),
          rows: arr(s.rows) as Record<string, string | number | boolean | null>[],
          caption: str(s.title),
        }),
      };
    case 'steps': {
      const node: SpecNode = {
        type: 'Steps',
        props: clean({
          steps: arr(s.steps).map((p) => clean({ title: str(obj(p).title) ?? '', description: str(obj(p).description), status: str(obj(p).status) })),
          orientation: str(s.orientation),
        }),
      };
      return str(s.title) ? { type: 'Section', props: { title: s.title as string }, children: [node] } : node;
    }
    case 'media':
      return { type: 'Media', props: clean({ url: str(s.url) ?? '', kind: str(s.kind), caption: str(s.caption) ?? str(s.title), poster: str(s.poster) }) };
    case 'product':
      return {
        type: 'Product',
        props: clean({
          title: str(s.title) ?? '',
          image: str(s.image),
          price: str(s.price),
          currency: str(s.currency),
          description: str(s.description),
          badges: s.badges ? arr(s.badges).map((b) => clean({ text: str(obj(b).text) ?? '', tone: tone(obj(b).tone) })) : undefined,
          attributes: s.metadata ? arr(s.metadata).map((m) => ({ label: str(obj(m).label) ?? '', value: String(obj(m).value ?? '') })) : undefined,
          action: s.action ? button(s.action, 'primary') : undefined,
        }),
      };
    case 'chart': {
      const series = arr(s.series).map((x) => ({ name: str(obj(x).name) ?? 'Serie', data: arr(obj(x).data).map((n) => (typeof n === 'number' ? n : null)) }));
      const len = Math.max(0, ...series.map((x) => x.data.length));
      const labels = arr(s.labels).length ? arr(s.labels).map(String) : Array.from({ length: len }, (_, i) => String(i + 1));
      return { type: 'Chart', props: clean({ kind: s.kind === 'pie' ? 'pie' : (str(s.kind) ?? 'bar'), labels, series, title: str(s.title) }) };
    }
    case 'tabs':
      return {
        type: 'Tabs',
        props: {},
        children: arr(s.tabs).map((t) => ({ type: 'Tab', props: { title: str(obj(t).title) ?? '' }, children: sections(arr(obj(t).sections)) })),
      };
    case 'grid':
      return { type: 'Grid', props: clean({ columns: typeof s.columns === 'number' ? s.columns : undefined }), children: sections(arr(s.sections)) };
    default:
      return null;
  }
}

function sections(list: unknown[]): SpecNode[] {
  return list.flatMap((s) => {
    const r = section(obj(s) as Section);
    return r ? (Array.isArray(r) ? r : [r]) : [];
  });
}

/** `{ title?, sections[] }` de render_ui → spec anidada de Orbital Elements. */
export function fromRenderUi(input: unknown): SpecNode {
  const o = obj(input);
  const children = sections(arr(o.sections));
  if (str(o.title)) children.unshift({ type: 'Heading', props: { text: o.title as string, level: 2 } });
  return { type: 'Stack', props: { gap: 'md' }, children };
}

/** ¿Parece un input de render_ui? */
export function isRenderUiInput(v: unknown): boolean {
  return Array.isArray(obj(v).sections);
}
