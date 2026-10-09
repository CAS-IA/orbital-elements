/**
 * Registro tipo → componente React. Cada componente recibe sus props YA
 * validadas por el catálogo (nunca datos crudos del modelo). Solo se dan de
 * alta los tipos que existen en el catálogo.
 */
import type React from 'react';
import { CATALOG, type SpecElement } from '../catalog';
import * as layout from './components/layout';
import * as text from './components/text';
import * as data from './components/data';
import * as charts from './components/charts';
import * as diagram from './components/diagram';
import * as feedback from './components/feedback';
import * as media from './components/media';
import * as interactive from './components/interactive';

export interface ElementProps<P> {
  props: P;
  id: string;
  children?: React.ReactNode;
  /** Elementos hijos (spec), p. ej. para leer los títulos de las pestañas. */
  childElements?: SpecElement[];
}

const ALL = { ...layout, ...text, ...data, ...charts, ...diagram, ...feedback, ...media, ...interactive } as Record<string, unknown>;

export const REGISTRY: Record<string, React.ComponentType<ElementProps<any>>> = Object.fromEntries(
  [...CATALOG.keys()].filter((k) => typeof ALL[k] === 'function').map((k) => [k, ALL[k] as React.ComponentType<ElementProps<any>>]),
);

/** Tipos del catálogo sin componente React (debe estar vacío; lo vigila un test). */
export const MISSING_COMPONENTS = [...CATALOG.keys()].filter((k) => typeof ALL[k] !== 'function');
