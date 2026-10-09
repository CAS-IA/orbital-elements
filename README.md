# @cas-ia/orbital-elements

Sistema de **marca** y **catálogo de componentes** para interfaces que construyen los agentes.

- **Un color de marca → el tema entero.** Escala 50–950, armonías, acento, enlaces, foco, superficies,
  estados y paleta de gráficos, en **claro y oscuro**, con el contraste WCAG garantizado (lo comprueban
  los tests con toda la rueda de color y los casos difíciles: amarillo, blanco, negro, gris).
- **El agente compone, el sistema diseña.** El agente emite un árbol JSON con componentes de un
  catálogo cerrado (Zod). Lo que no valida no se pinta, y los errores vuelven al agente con su ruta para
  que corrija. Nunca código, nunca CSS del modelo.
- **Lenguaje visual de Qratia**: tres niveles de superficie, sombras en capas
  tintadas, jerarquía por tamaño y peso, cifras tabulares, estados con texto.
- **Un solo paquete**, varias entradas: cada app carga solo lo que usa.

| Entrada | Qué trae | Dependencias |
|---|---|---|
| `@cas-ia/orbital-elements/brand` | `createTheme`, emisores CSS / shadcn / Tailwind v4 / `--widget-*` / Design Tokens, presets | culori |
| `@cas-ia/orbital-elements/catalog` | ~40 componentes en Zod, `validateSpec`, prompt y JSON Schema, compatibilidad `render_ui`, streaming | zod |
| `@cas-ia/orbital-elements/tools` | Las dos tools del agente: `ui_catalog` y `render_ui` (formatos Anthropic, OpenAI y MCP) | — |
| `@cas-ia/orbital-elements/react` | `OrbitalTheme`, `OrbitalRenderer` y los componentes | react (peer) |
| `@cas-ia/orbital-elements/json-render` | El mismo catálogo y componentes para el motor json-render (Vercel) | @json-render/* (peer, opcional) |
| `@cas-ia/orbital-elements/styles.css` | Hoja de estilos (todo con variables `--oe-*`) | — |

## Marca: de un color, todo

```ts
import { createTheme, themeCss, shadcnCss, tailwindTheme, widgetVariables } from '@cas-ia/orbital-elements/brand';

const theme = createTheme({
  primary: '#0EA5E9',          // lo único obligatorio
  harmony: 'complementary',    // analogous | triadic | split-complementary | tetradic | monochrome
  strategy: 'brand',           // 'ink': acción en tinta oscura y la marca de acento (estilo Qratia)
  radius: 'md',                // none | sm | md | lg | xl | px
});

themeCss(theme);              // :root { --oe-* } + .dark { --oe-* }
shadcnCss(theme);             // --background, --primary, --chart-1… + --incrustado, --enlace, --estado-*
tailwindTheme(theme);         // @theme inline { --color-oe-card: var(--oe-card); … }
widgetVariables(theme, 'dark'); // --widget-* (widget de chat Orbital)
theme.warnings;               // ajustes hechos para cumplir contraste (para enseñarlos en el panel)
```

Reglas del tema (heredadas de Qratia): el lienzo no es blanco puro; la marca se usa por **papel**
(acción, tinte de superficie, enlace y foco son tokens distintos, cada uno con su contraste); los estados
(crítico, aviso, correcto, info, sin dato) no se tiñen con la marca; la serie 1 de los gráficos es la marca
y el resto, la paleta validada de Qratia sin repetir su tono.

## Catálogo y validación

```ts
import { validateSpec, catalogPrompt, fromRenderUi } from '@cas-ia/orbital-elements/catalog';

const { valid, spec, issues } = validateSpec({
  type: 'Stack', props: {}, children: [
    { type: 'Heading', props: { text: 'Ventas de septiembre', level: 1 } },
    { type: 'Kpis', props: { items: [{ label: 'Ingresos', value: 128400, format: 'currency', currency: 'EUR', delta: 0.12 }] } },
    { type: 'Chart', props: { kind: 'line', labels: ['S1', 'S2', 'S3'], series: [{ name: 'Pedidos', data: [120, 180, 150] }] } },
  ],
});
```

Componentes: `Stack Grid Card Section Tabs Tab Disclosure · Heading Text Quote Code Divider · Kpi Kpis Table
KeyValue List Badges Status Progress Gauge Ranking Comparison · Chart (bar, hbar, stacked-bar, line, area,
donut, pie) Sparkline Heatmap · Flow Timeline Steps · Alert EmptyState · Media Links · Actions Options Form
Confirmation Approval Product`.

La spec admite el formato **anidado** (el que mejor genera un LLM) y el **plano** de json-render
(`{ root, elements }`). `fromRenderUi` convierte el formato de secciones de la tool `render_ui` anterior, así que lo que
ya generan los agentes se pinta con el diseño nuevo sin tocar nada.

## Las dos tools del agente

```ts
import { toAnthropicTools, executeTool } from '@cas-ia/orbital-elements/tools';

const tools = toAnthropicTools();               // [ui_catalog, render_ui] (también toOpenAITools / toMcpTools)
const result = executeTool('render_ui', input);  // { ok, spec, issues, message }
// Si !ok, devuelve result.message al modelo: lista los errores con su ruta para que corrija.
```

1. `ui_catalog`: índice de componentes y, bajo demanda, el schema exacto y un ejemplo.
2. `render_ui`: valida y devuelve la spec que pinta el cliente.

## React

```tsx
import '@cas-ia/orbital-elements/styles.css';
import { OrbitalTheme, OrbitalRenderer } from '@cas-ia/orbital-elements/react';

<OrbitalTheme brand="#0EA5E9" mode="system" locale="es-ES" onAction={(a) => sendToAgent(a.text, a)}>
  <OrbitalRenderer spec={spec} partial={isStreaming} />
</OrbitalTheme>
```

- `partial`: spec a medio llegar. Cada bloque aparece en cuanto está completo (`createSpecAccumulator`
  convierte los trozos de texto del stream en la mejor spec parcial).
- Los gráficos se dibujan al ancho real del contenedor: el texto nunca se estira.
- Cada bloque tiene su propio límite de errores; uno roto no tumba a los demás.
- En un Shadow DOM: inyecta `styles.css` como texto dentro de la raíz.

## Desarrollo

```bash
npm i
npm run verify     # typecheck + tests (contraste, catálogo, React, json-render) + build
npm run gallery    # genera la galería visual en borrador/gallery.html
```

## Instalación

```bash
npm i @cas-ia/orbital-elements
# React y json-render son opcionales (peer dependencies): instálalos solo si usas /react o /json-render.
```

## Publicar una versión

Sube la versión en `package.json`, añade su entrada al CHANGELOG, haz commit en `main` y sube la etiqueta
`vX.Y.Z`. El workflow `Publish` verifica (typecheck, tests y build) y publica en npmjs.com con *provenance*
usando el secreto `NPM_TOKEN` del repo.

## Licencia

MIT © Fractalia Systems
