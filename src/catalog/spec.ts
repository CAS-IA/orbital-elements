/**
 * El "AST" de la interfaz: formato, normalización y validación.
 *
 * Dos formas de entrada, una sola salida:
 *  - ANIDADA (la que mejor genera un LLM):
 *      { type: 'Card', props: {...}, children: [ { type: 'Kpi', props: {...} } ] }
 *    También se acepta una lista de nodos en la raíz (se envuelve en Stack).
 *  - PLANA (la de json-render, ideal para streaming por parches):
 *      { root: 'n1', elements: { n1: { type, props, children: ['n2'] }, ... } }
 *
 * `validateSpec` devuelve SIEMPRE una spec plana segura: lo que no valida se
 * quita y se explica en `issues` (con ruta), para que el agente corrija y
 * reintente. Un nodo roto nunca rompe a sus hermanos.
 */
import type { z } from 'zod';
import { CATALOG, type ComponentDef } from './components';

export interface SpecElement {
  type: string;
  props: Record<string, unknown>;
  children: string[];
}

export interface FlatSpec {
  root: string;
  elements: Record<string, SpecElement>;
}

export interface SpecNode {
  type: string;
  props?: Record<string, unknown>;
  children?: SpecNode[];
  /** Id opcional (estable entre streams); si falta se genera. */
  id?: string;
}

export interface SpecIssue {
  /** Ruta legible: `Card[0] > Kpis[1].items[2].value` */
  path: string;
  /** `unknown-type`, `invalid-props`, `children-not-allowed`, `child-type`, `missing-child`, `limit`, `invalid-spec`. */
  code: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidateOptions {
  /** Spec a medio llegar (streaming): los nodos incompletos se omiten sin error. */
  partial?: boolean;
  /** Catálogo alternativo (por defecto, el de Orbital Elements). */
  catalog?: ReadonlyMap<string, ComponentDef>;
  /** Límite de nodos (por defecto 400). */
  maxElements?: number;
  /** Profundidad máxima (por defecto 10). */
  maxDepth?: number;
}

export interface ValidationResult {
  valid: boolean;
  spec: FlatSpec;
  issues: SpecIssue[];
}

const EMPTY_ROOT = '__root';

export function isFlatSpec(v: unknown): v is FlatSpec {
  return !!v && typeof v === 'object' && typeof (v as FlatSpec).root === 'string' && !!(v as FlatSpec).elements && typeof (v as FlatSpec).elements === 'object';
}

/** Anidada (o lista) → plana, generando ids estables por posición. */
export function toFlat(input: unknown): FlatSpec {
  if (isFlatSpec(input)) {
    const elements: Record<string, SpecElement> = {};
    for (const [id, el] of Object.entries(input.elements ?? {})) {
      if (!el || typeof el !== 'object') continue;
      const e = el as Partial<SpecElement>;
      elements[id] = { type: String(e.type ?? ''), props: isRecord(e.props) ? e.props : {}, children: Array.isArray(e.children) ? e.children.filter((c) => typeof c === 'string') : [] };
    }
    return { root: input.root, elements };
  }
  const elements: Record<string, SpecElement> = {};
  let n = 0;
  const used = new Set<string>();
  const visit = (node: unknown): string | null => {
    if (!isRecord(node) || typeof node.type !== 'string') return null;
    let id = typeof node.id === 'string' && /^[\w-]{1,60}$/.test(node.id) && !used.has(node.id) ? node.id : `n${++n}`;
    while (used.has(id)) id = `n${++n}`;
    used.add(id);
    const kids = Array.isArray(node.children) ? node.children.map(visit).filter((x): x is string => !!x) : [];
    elements[id] = { type: node.type, props: isRecord(node.props) ? node.props : {}, children: kids };
    return id;
  };
  if (Array.isArray(input)) {
    const kids = input.map(visit).filter((x): x is string => !!x);
    elements[EMPTY_ROOT] = { type: 'Stack', props: {}, children: kids };
    return { root: EMPTY_ROOT, elements };
  }
  // `{ sections: [...] }` o `{ children: [...] }` sin type: lista implícita.
  if (isRecord(input) && typeof input.type !== 'string' && Array.isArray(input.children)) return toFlat(input.children);
  const root = visit(input);
  return root ? { root, elements } : { root: EMPTY_ROOT, elements: { [EMPTY_ROOT]: { type: 'Stack', props: {}, children: [] } } };
}

/** Plana → anidada (para depurar, mostrar al modelo o exportar). */
export function toNested(spec: FlatSpec): SpecNode | null {
  const seen = new Set<string>();
  const build = (id: string): SpecNode | null => {
    const el = spec.elements[id];
    if (!el || seen.has(id)) return null;
    seen.add(id);
    const children = el.children.map(build).filter((x): x is SpecNode => !!x);
    return { type: el.type, props: el.props, ...(children.length ? { children } : {}) };
  };
  return build(spec.root);
}

export function validateSpec(input: unknown, opts: ValidateOptions = {}): ValidationResult {
  const catalog = opts.catalog ?? CATALOG;
  const maxElements = opts.maxElements ?? 400;
  const maxDepth = opts.maxDepth ?? 10;
  const issues: SpecIssue[] = [];
  const flat = toFlat(input);
  const out: Record<string, SpecElement> = {};
  const visited = new Set<string>();
  let count = 0;

  const label = (el: SpecElement | undefined, i: number) => `${el?.type || '?'}[${i}]`;

  const walk = (id: string, path: string, depth: number): boolean => {
    const el = flat.elements[id];
    if (!el) {
      if (!opts.partial) issues.push({ path, code: 'missing-child', message: `no existe el elemento "${id}"`, severity: 'warning' });
      return false;
    }
    if (visited.has(id)) {
      issues.push({ path, code: 'invalid-spec', message: `"${id}" aparece dos veces (ciclo o repetición)`, severity: 'error' });
      return false;
    }
    visited.add(id);
    if (depth > maxDepth) {
      issues.push({ path, code: 'limit', message: `profundidad máxima ${maxDepth} superada`, severity: 'error' });
      return false;
    }
    if (++count > maxElements) {
      issues.push({ path, code: 'limit', message: `máximo ${maxElements} elementos`, severity: 'error' });
      return false;
    }
    const def = catalog.get(el.type);
    if (!def) {
      issues.push({
        path,
        code: 'unknown-type',
        message: `tipo "${el.type}" no existe en el catálogo. Válidos: ${[...catalog.keys()].join(', ')}`,
        severity: 'error',
      });
      return false;
    }
    const parsed = (def.props as z.ZodTypeAny).safeParse(el.props ?? {});
    if (!parsed.success) {
      if (!opts.partial) {
        for (const iss of parsed.error.issues.slice(0, 8)) {
          issues.push({
            path: `${path}.${iss.path.map(String).join('.') || 'props'}`.replace(/\.$/, ''),
            code: 'invalid-props',
            message: iss.message,
            severity: 'error',
          });
        }
      }
      return false;
    }
    const kids: string[] = [];
    if (el.children.length) {
      if (!def.children) {
        issues.push({ path, code: 'children-not-allowed', message: `${def.type} no admite hijos (se ignoran)`, severity: 'warning' });
      } else {
        el.children.forEach((cid, i) => {
          const child = flat.elements[cid];
          const childPath = `${path} > ${label(child, i)}`;
          if (Array.isArray(def.children) && child && !def.children.includes(child.type)) {
            issues.push({ path: childPath, code: 'child-type', message: `${def.type} solo admite ${def.children.join(', ')}`, severity: 'error' });
            return;
          }
          if (walk(cid, childPath, depth + 1)) kids.push(cid);
        });
      }
    }
    out[id] = { type: el.type, props: parsed.data as Record<string, unknown>, children: kids };
    return true;
  };

  const ok = walk(flat.root, label(flat.elements[flat.root], 0), 0);
  if (!ok && !out[flat.root]) {
    out[EMPTY_ROOT] = { type: 'Stack', props: {}, children: [] };
    return { valid: false, spec: { root: EMPTY_ROOT, elements: out }, issues };
  }
  return { valid: !issues.some((i) => i.severity === 'error'), spec: { root: flat.root, elements: out }, issues };
}

/** Issues en texto, pensado para devolvérselo al modelo y que corrija. */
export function formatIssues(issues: SpecIssue[]): string {
  return issues.map((i) => `- [${i.code}] ${i.path}: ${i.message}`).join('\n');
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}
