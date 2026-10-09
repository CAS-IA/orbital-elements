# Changelog — @cas-ia/orbital-elements

Versionado [SemVer](https://semver.org/lang/es/) por el impacto en quien lo instala: **major** = rompe
(en `0.x`, sube minor) · **minor** = capacidad nueva compatible · **patch** = corrección. La entrada más
reciente va arriba.

## 0.1.1 — 2026-10-09

Publicación abierta. Ningún cambio de API.

- **Se instala desde npmjs.com sin token**: `npm i @cas-ia/orbital-elements`. La 0.1.0 solo estaba en
  GitHub Packages, que exige autenticarse incluso para leer. Se publica con *provenance*: npm enlaza
  cada versión con el commit y el workflow que la construyeron.
- **Licencia MIT** (antes `UNLICENSED`, que no permitía usarlo a nadie).
- Comentarios y documentación sin referencias a repositorios internos.

## 0.1.0 — 2026-10-09

Primera versión. Unifica lo que estaba repartido y copiado a mano entre repos.

- **Marca desde un color** (`/brand`): `createTheme` genera el tema completo en claro y oscuro a partir
  del primario: escala 50–950, seis armonías, acento, enlace, foco, superficies (tres niveles), estados
  y paleta de gráficos. El contraste WCAG se mide sobre el **hex final** (medir sobre el color continuo
  daba 4,50 y el hex pintado 4,48). Une dos generadores internos que hacían lo mismo por separado.
- **Emisores**: variables `--oe-*`, nombres shadcn + Qratia, `@theme` de Tailwind v4, `--widget-*` del
  widget de chat Orbital y JSON de Design Tokens (DTCG).
- **Presets unificados**: un preset es solo la entrada del tema (primario, acento y opciones); el resto
  lo calcula `createTheme` con el mismo criterio para todos.
- **Catálogo** (`/catalog`): ~40 componentes en Zod con descripción y guía de uso para el modelo. Añade
  lo que no existía en `render_ui`: diagrama de flujo con maquetación automática, línea de tiempo,
  heatmap, ranking, gauge, comparativa, semáforo, cita, código, ficha clave-valor y estado vacío.
- **Validación con errores para reintentar**: `validateSpec` quita lo que no valida, con ruta y motivo,
  sin romper a los hermanos; modo parcial para streaming.
- **Compatibilidad**: `fromRenderUi` convierte las 22 secciones del `render_ui` actual.
- **Dos tools para agentes** (`/tools`): `ui_catalog` y `render_ui`, con adaptadores Anthropic, OpenAI y MCP.
- **React** (`/react`): `OrbitalTheme` + `OrbitalRenderer` con el lenguaje visual de Qratia. Los gráficos
  se dibujan al ancho real (nunca se estira el texto).
- **json-render** (`/json-render`): el mismo catálogo y componentes como motor alternativo.
