/**
 * OrbitalRenderer — pinta una spec (anidada, plana o el render_ui antiguo).
 *
 *  - Valida contra el catálogo (`validateSpec`): lo que no valida no se pinta.
 *  - `partial`: spec a medio llegar (streaming). Cada nodo aparece en cuanto
 *    está completo; los incompletos esperan sin errores.
 *  - Cada elemento va dentro de su propio límite de errores: si uno falla al
 *    pintar, se muestra un aviso discreto y el resto sigue.
 *  - `components` permite sustituir o añadir componentes (mismas props).
 */
import React, { Component, useMemo } from 'react';
import { fromRenderUi, isRenderUiInput, validateSpec, type FlatSpec, type SpecIssue } from '../catalog';
import { REGISTRY, type ElementProps } from './registry';
import { useT } from './context';

export interface OrbitalRendererProps {
  spec: unknown;
  partial?: boolean;
  /** Componentes propios o sustituciones (por `type`). */
  components?: Record<string, React.ComponentType<ElementProps<any>>>;
  /** Avisos de validación (para depurar o devolvérselos al agente). */
  onIssues?: (issues: SpecIssue[]) => void;
  className?: string;
}

class Boundary extends Component<{ fallback: React.ReactNode; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    // eslint-disable-next-line no-console
    console.warn('[orbital-elements] fallo al pintar un elemento', error);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function ErrorNote() {
  const t = useT();
  return <div className="oe-error-note">{t('error')}</div>;
}

export function OrbitalRenderer({ spec, partial, components, onIssues, className }: OrbitalRendererProps) {
  const result = useMemo(() => {
    const input = isRenderUiInput(spec) ? fromRenderUi(spec) : spec;
    return validateSpec(input, { partial });
  }, [spec, partial]);

  React.useEffect(() => {
    if (onIssues && result.issues.length) onIssues(result.issues);
  }, [result, onIssues]);

  const registry = components ? { ...REGISTRY, ...components } : REGISTRY;
  return (
    <div className={`oe-render${partial ? ' oe-render--partial' : ''}${className ? ` ${className}` : ''}`}>
      <Node id={result.spec.root} spec={result.spec} registry={registry} />
    </div>
  );
}

function Node({ id, spec, registry }: { id: string; spec: FlatSpec; registry: Record<string, React.ComponentType<ElementProps<any>>> }) {
  const el = spec.elements[id];
  if (!el) return null;
  const Comp = registry[el.type];
  if (!Comp) return null;
  const children = el.children.map((cid) => <Node key={cid} id={cid} spec={spec} registry={registry} />);
  return (
    <Boundary fallback={<ErrorNote />}>
      <Comp props={el.props} id={id} childElements={el.children.map((c) => spec.elements[c]).filter(Boolean)}>
        {children}
      </Comp>
    </Boundary>
  );
}
