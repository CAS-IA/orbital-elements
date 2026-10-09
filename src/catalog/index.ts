/**
 * @cas-ia/orbital-elements/catalog — el contrato de componentes (Zod), el
 * formato de la spec, su validación y lo que ve el modelo.
 *
 * Sin React ni DOM: lo usan igual las tools del agente (en un Worker), el
 * backend de documentos y los frontales.
 */
export * from './components';
export * from './spec';
export * from './prompt';
export * from './render-ui';
export * from './partial-json';
