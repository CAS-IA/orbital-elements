/**
 * Galería interactiva de Orbital Elements (banco de pruebas visual).
 * Se empaqueta con scripts/build-gallery.mjs en un HTML autocontenido.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BRAND_PRESETS, contrast, createTheme, type BrandInput, type Harmony, type Theme } from '../src/brand';
import { COMPONENTS, createSpecAccumulator, validateSpec, formatIssues, type Category } from '../src/catalog';
import { OrbitalRenderer, OrbitalTheme, type OrbitalAction } from '../src/react';

// ── Datos de ejemplo (realistas, marcados como ejemplo en la página) ──

const BRIEFING = {
  type: 'Stack',
  props: { gap: 'lg' },
  children: [
    { type: 'Heading', props: { eyebrow: 'Centro de atención · semana 41', text: 'Briefing de operaciones', level: 1 } },
    {
      type: 'Text',
      props: {
        variant: 'lead',
        text: 'La semana cierra con **más llamadas atendidas y menos espera**. El riesgo está en las incidencias abiertas del canal web, que vuelven a subir.',
      },
    },
    {
      type: 'Kpis',
      props: {
        items: [
          { label: 'Llamadas atendidas', value: 12480, delta: 0.08, sparkline: [9800, 10400, 10900, 11200, 11800, 12480] },
          { label: 'Espera media', value: 312, format: 'duration', delta: -0.12, goodWhen: 'down' },
          { label: 'Satisfacción', value: 0.87, format: 'percent', delta: 0.02 },
          { label: 'Incidencias abiertas', value: 14, delta: 0.27, goodWhen: 'down', context: '9 del canal web' },
        ],
      },
    },
    {
      type: 'Grid',
      props: { columns: 2 },
      children: [
        {
          type: 'Card',
          props: { title: 'Llamadas por día', description: 'Semana 41 frente a la 40' },
          children: [
            {
              type: 'Chart',
              props: {
                kind: 'area',
                labels: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
                series: [
                  { name: 'Semana 41', data: [2140, 2380, 2290, 2510, 2260, 520, 380] },
                  { name: 'Semana 40', data: [1980, 2210, 2180, 2300, 2150, 610, 450] },
                ],
                format: 'integer',
              },
            },
          ],
        },
        {
          type: 'Card',
          props: { title: 'Motivo de contacto', description: 'Reparto de la semana' },
          children: [
            {
              type: 'Chart',
              props: {
                kind: 'donut',
                labels: ['Facturación', 'Averías', 'Altas', 'Bajas', 'Otros'],
                series: [{ name: 'Contactos', data: [4120, 3480, 2190, 1460, 1230] }],
                format: 'integer',
              },
            },
          ],
        },
      ],
    },
    {
      type: 'Card',
      props: { title: 'Escalado de una incidencia', description: 'Cómo se resuelve hoy una avería que no se arregla en primera línea' },
      children: [
        {
          type: 'Flow',
          props: {
            nodes: [
              { id: 'in', label: 'Llamada de avería', kind: 'start' },
              { id: 'n1', label: 'Diagnóstico en primera línea' },
              { id: 'q', label: '¿Resuelta?', kind: 'decision' },
              { id: 'n2', label: 'Ticket a técnico de campo', tone: 'warning' },
              { id: 'n3', label: 'Visita y cierre' },
              { id: 'ok', label: 'Encuesta de satisfacción', kind: 'end' },
            ],
            edges: [
              { from: 'in', to: 'n1' },
              { from: 'n1', to: 'q' },
              { from: 'q', to: 'ok', label: 'sí' },
              { from: 'q', to: 'n2', label: 'no' },
              { from: 'n2', to: 'n3' },
              { from: 'n3', to: 'ok' },
            ],
          },
        },
      ],
    },
    {
      type: 'Alert',
      props: {
        tone: 'warning',
        title: 'Incidencias del canal web',
        message: 'Han pasado de 5 a **9** en una semana. Todas vienen del formulario de cambio de titular.',
      },
    },
    {
      type: 'Actions',
      props: {
        question: '¿Qué quieres revisar ahora?',
        buttons: [
          { label: 'Ver las 9 incidencias', action: 'open_incidents', payload: { channel: 'web' }, variant: 'primary' },
          { label: 'Comparar con el mes pasado', action: 'compare_month', variant: 'secondary' },
        ],
      },
    },
  ],
};

/** Ejemplos ricos por componente (los mínimos del catálogo se quedan cortos para ver el diseño). */
const DEMOS: Record<string, unknown> = {
  Card: { type: 'Card', props: { title: 'Contrato renovado', description: 'ACME Logística · firmado el 3 de octubre', tone: 'success', footer: 'Próxima revisión: abril de 2027' }, children: [{ type: 'Text', props: { text: 'Renovación por **24 meses** con una subida del 3,2 % ligada al IPC.' } }] },
  Section: { type: 'Section', props: { eyebrow: 'Apartado 2', title: 'Qué ha cambiado', description: 'Diferencias respecto a la versión anterior del contrato.' }, children: [{ type: 'List', props: { items: ['Plazo de pago a 45 días', 'Penalización por retraso del 1 %'] } }] },
  Tabs: { type: 'Tabs', props: {}, children: [{ type: 'Tab', props: { title: 'Resumen' }, children: [{ type: 'Text', props: { text: 'Tres hallazgos críticos y dos de aviso.' } }] }, { type: 'Tab', props: { title: 'Detalle' }, children: [{ type: 'Text', props: { text: 'Detalle por activo afectado.' } }] }, { type: 'Tab', props: { title: 'Datos' }, children: [] }] },
  Disclosure: { type: 'Disclosure', props: { title: 'Cómo se ha calculado' }, children: [{ type: 'Text', props: { text: 'Media móvil de 7 días sobre las llamadas atendidas en menos de 20 s.' } }] },
  Heading: { type: 'Heading', props: { eyebrow: 'Informe mensual', text: 'Septiembre cierra por encima del objetivo', level: 2 } },
  Text: { type: 'Text', props: { text: 'El margen sube **dos puntos** gracias a la renegociación con transportistas.\n\n- Coste por envío: 4,10 € (antes 4,62 €)\n- Plazo medio: 1,8 días\n- [ ] Revisar tarifas de islas\n- [x] Cerrar acuerdo con el operador del norte\n\nMás detalle en el [panel de costes](https://example.com).' } },
  Quote: { type: 'Quote', props: { text: 'Necesitamos saber el estado del pedido sin tener que llamar.', cite: 'Cliente de la encuesta de septiembre', source: 'Respuesta n.º 214' } },
  Code: { type: 'Code', props: { title: 'widget.html', language: 'html', code: '<script src="https://widget.orbital.fractaliacyber.com/loader.js"\n  data-project-id="prj_123" data-mode="card" data-primary-color="#0EA5E9"></script>' } },
  Divider: { type: 'Divider', props: { label: 'Anexo' } },
  Kpi: { type: 'Kpi', props: { label: 'Ingresos del trimestre', value: 1284000, format: 'currency', currency: 'EUR', delta: 0.124, context: 'Objetivo: 1,2 M€', sparkline: [820, 900, 870, 980, 1100, 1284] } },
  Kpis: { type: 'Kpis', props: { items: [{ label: 'NPS', value: 42, delta: 0.05 }, { label: 'Tiempo de respuesta', value: 95, format: 'duration', delta: -0.18, goodWhen: 'down' }, { label: 'Pedidos devueltos', value: 0.031, format: 'percent', delta: 0.004, goodWhen: 'down' }, { label: 'Satisfacción media', value: null, context: 'Encuesta aún abierta' }] } },
  Table: { type: 'Table', props: { columns: [{ key: 'zona', label: 'Zona' }, { key: 'pedidos', label: 'Pedidos', format: 'integer' }, { key: 'importe', label: 'Importe', format: 'currency', currency: 'EUR' }, { key: 'margen', label: 'Margen', format: 'percent' }, { key: 'activa', label: 'Activa' }], rows: [{ zona: 'Norte', pedidos: 4210, importe: 182400, margen: 0.21, activa: true }, { zona: 'Centro', pedidos: 6120, importe: 241900, margen: 0.18, activa: true }, { zona: 'Sur', pedidos: 3890, importe: 151200, margen: 0.16, activa: false }], caption: 'Datos de septiembre de 2026' } },
  KeyValue: { type: 'KeyValue', props: { columns: 2, items: [{ label: 'Cliente', value: 'ACME Logística' }, { label: 'CIF', value: 'B-12345678' }, { label: 'Estado', value: 'Al corriente', tone: 'success' }, { label: 'Riesgo', value: 'Medio', tone: 'warning' }, { label: 'Facturación anual', value: 482000 }, { label: 'Cliente desde', value: '2019' }] } },
  List: { type: 'List', props: { variant: 'cards', items: [{ title: 'Renovar certificado SSL', description: 'Caduca en 9 días', meta: 'Alta', tone: 'critical' }, { title: 'Actualizar política de copias', description: 'Pendiente de firma', meta: 'Media', tone: 'warning' }, { title: 'Revisar accesos de exempleados', meta: 'Baja' }] } },
  Badges: { type: 'Badges', props: { items: [{ text: 'Crítico', tone: 'critical' }, { text: 'En revisión', tone: 'warning' }, { text: 'Resuelto', tone: 'success' }, { text: 'Fuente: CRM', tone: 'info' }, { text: 'Cliente VIP', tone: 'brand' }, { text: 'Archivado' }] } },
  Status: { type: 'Stack', props: { gap: 'sm' }, children: [{ type: 'Status', props: { label: 'API de pagos', status: 'success', value: 'Operativa', description: 'Latencia media 120 ms' } }, { type: 'Status', props: { label: 'Envío de SMS', status: 'warning', value: 'Degradado', description: 'Retrasos de hasta 4 min' } }, { type: 'Status', props: { label: 'Sincronización con el ERP', status: 'critical', value: 'Caída' } }, { type: 'Status', props: { label: 'Encuesta de satisfacción', status: 'noData', value: 'Sin medir' } }] },
  Progress: { type: 'Stack', props: { gap: 'md' }, children: [{ type: 'Progress', props: { label: 'Objetivo trimestral', value: 72, max: 100 } }, { type: 'Progress', props: { label: 'Presupuesto consumido', value: 0.91, format: 'percent', tone: 'warning' } }] },
  Gauge: { type: 'Gauge', props: { label: 'Puntuación de riesgo', value: 68, thresholds: [{ upTo: 40, tone: 'success' }, { upTo: 70, tone: 'warning' }, { upTo: 100, tone: 'critical' }] } },
  Ranking: { type: 'Ranking', props: { format: 'currency', currency: 'EUR', items: [{ label: 'Madrid · Castellana', value: 128400, note: '+14 % respecto a agosto' }, { label: 'Barcelona · Diagonal', value: 112900 }, { label: 'Valencia · Colón', value: 84300 }, { label: 'Sevilla · Nervión', value: 61200 }, { label: 'Bilbao · Abando', value: 48700 }] } },
  Comparison: { type: 'Comparison', props: { options: [{ title: 'Básico', note: '19 €/mes' }, { title: 'Profesional', note: '49 €/mes', highlight: true }, { title: 'Empresa', note: 'A medida' }], rows: [{ label: 'Usuarios', values: [3, 25, 'Ilimitados'] }, { label: 'Agentes de IA', values: [1, 10, 'Ilimitados'] }, { label: 'Soporte 24 h', values: [false, true, true] }, { label: 'SSO', values: [false, false, true] }] } },
  Chart: { type: 'Grid', props: { columns: 2 }, children: [{ type: 'Chart', props: { title: 'Ventas por trimestre', kind: 'bar', labels: ['T1', 'T2', 'T3', 'T4'], series: [{ name: '2025', data: [420, 510, 480, 620] }, { name: '2026', data: [460, 590, 560, null] }], format: 'integer' } }, { title: '', type: 'Chart', props: { title: 'Tiempo de resolución (h)', kind: 'line', labels: ['Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep'], series: [{ name: 'Horas', data: [38, 34, 31, 29, 30, 24] }] } }, { type: 'Chart', props: { title: 'Incidencias por equipo', kind: 'hbar', labels: ['Redes', 'Puesto de trabajo', 'Aplicaciones', 'Seguridad'], series: [{ name: 'Abiertas', data: [18, 42, 27, 9] }] } }, { type: 'Chart', props: { title: 'Canal de entrada', kind: 'stacked-bar', labels: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'], series: [{ name: 'Teléfono', data: [120, 140, 130, 150, 110] }, { name: 'Chat', data: [80, 95, 110, 120, 100] }, { name: 'Correo', data: [40, 35, 45, 50, 30] }] } }] },
  Sparkline: { type: 'Text', props: { text: 'Tendencia de 12 meses junto a una cifra:' }, sparkAfter: true },
  Heatmap: { type: 'Heatmap', props: { rows: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'], columns: ['8 h', '10 h', '12 h', '14 h', '16 h', '18 h'], values: [[12, 48, 62, 40, 55, 20], [10, 52, 70, 45, 60, 22], [8, 44, 58, 38, 50, 18], [14, 60, 75, 52, 66, 25], [9, 38, 49, 30, 35, 12]] } },
  Flow: { type: 'Flow', props: { direction: 'TB', nodes: [{ id: 'a', label: 'Solicitud de reembolso', kind: 'start' }, { id: 'b', label: 'Validar pedido', kind: 'data' }, { id: 'c', label: '¿Importe > 500 €?', kind: 'decision' }, { id: 'd', label: 'Aprobación del responsable', tone: 'warning' }, { id: 'e', label: 'Reembolso automático', tone: 'success' }, { id: 'f', label: 'Notificar al cliente', kind: 'end' }], edges: [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }, { from: 'c', to: 'd', label: 'sí' }, { from: 'c', to: 'e', label: 'no' }, { from: 'd', to: 'f' }, { from: 'e', to: 'f' }] } },
  Timeline: { type: 'Timeline', props: { items: [{ date: '09:12', title: 'Alerta de caída del ERP', description: 'Detectada por el monitor de sincronización', tone: 'critical' }, { date: '09:18', title: 'Incidencia asignada a Sistemas', tone: 'warning' }, { date: '09:41', title: 'Causa identificada', description: 'Certificado caducado en el balanceador' }, { date: '10:05', title: 'Servicio restablecido', tone: 'success' }] } },
  Steps: { type: 'Grid', props: { columns: 2 }, children: [{ type: 'Steps', props: { steps: [{ title: 'Datos del cliente', status: 'done' }, { title: 'Verificación de identidad', status: 'done' }, { title: 'Revisión de riesgo', description: 'Pendiente del equipo de cumplimiento', status: 'active' }, { title: 'Firma del contrato' }] } }, { type: 'Steps', props: { orientation: 'horizontal', steps: [{ title: 'Pedido', status: 'done' }, { title: 'Preparación', status: 'done' }, { title: 'Transporte', status: 'error', description: 'Dirección incompleta' }, { title: 'Entrega' }] } }] },
  Alert: { type: 'Stack', props: { gap: 'sm' }, children: [{ type: 'Alert', props: { tone: 'critical', title: 'Pago rechazado', message: 'La tarjeta terminada en **4421** ha caducado.' } }, { type: 'Alert', props: { tone: 'success', message: 'El informe se ha enviado a 12 destinatarios.' } }, { type: 'Alert', props: { tone: 'info', title: 'Dato estimado', message: 'Las cifras de octubre son una proyección con los datos hasta el día 9.' } }] },
  EmptyState: { type: 'EmptyState', props: { title: 'No hay incidencias abiertas', description: 'Las 23 de esta semana están resueltas. La próxima revisión es el lunes.' } },
  Media: { type: 'Media', props: { url: 'https://example.com/plano-almacen.png', kind: 'image', alt: 'Plano del almacén', caption: 'Plano del almacén de Coslada (las imágenes externas no se cargan en esta vista previa)' } },
  Links: { type: 'Links', props: { variant: 'sources', items: [{ text: 'Informe de mercado logístico 2026', href: 'https://example.com/informe', description: 'Capítulo 3: costes de última milla' }, { text: 'Tarifas públicas de transportistas', href: 'https://example.org/tarifas' }] } },
  Actions: { type: 'Actions', props: { question: 'He encontrado 3 facturas duplicadas. ¿Qué hago?', buttons: [{ label: 'Anularlas', action: 'void', variant: 'primary' }, { label: 'Revisarlas una a una', action: 'review', variant: 'secondary' }, { label: 'Ignorar', action: 'ignore', variant: 'ghost' }] } },
  Options: { type: 'Options', props: { question: '¿Qué formato prefieres para el informe?', options: [{ value: 'pdf', label: 'PDF', description: 'Para enviar o imprimir' }, { value: 'xlsx', label: 'Excel', description: 'Con los datos para filtrar' }, { value: 'pptx', label: 'Presentación', description: '6 diapositivas con los gráficos' }] } },
  Form: { type: 'Form', props: { submitLabel: 'Crear incidencia', fields: [{ name: 'titulo', label: 'Título', type: 'text', required: true, placeholder: 'Ej.: no carga el portal de clientes' }, { name: 'prioridad', label: 'Prioridad', type: 'select', options: [{ value: 'alta', label: 'Alta' }, { value: 'media', label: 'Media' }, { value: 'baja', label: 'Baja' }] }, { name: 'detalle', label: 'Descripción', type: 'textarea', help: 'Qué pasa, desde cuándo y a quién afecta.' }, { name: 'avisar', label: 'Avisar al responsable del servicio', type: 'boolean' }] } },
  Confirmation: { type: 'Confirmation', props: { title: 'Envío masivo', message: 'Se enviarán 1.240 correos de renovación a clientes con el contrato a punto de vencer.', confirmLabel: 'Enviar ahora' } },
  Approval: { type: 'Approval', props: { title: 'Reembolso de 640 € a ACME Logística', summary: 'El agente propone reembolsar el pedido 88213 por entrega fuera de plazo.', pendingActionId: 'act_88213', rows: [{ label: 'Pedido', value: '88213' }, { label: 'Motivo', value: 'Entrega con 6 días de retraso' }, { label: 'Política aplicada', value: 'Reembolso íntegro > 5 días' }] } },
  Product: { type: 'Product', props: { title: 'Plan Profesional', price: 49, currency: 'EUR', description: 'Para equipos que atienden clientes con agentes de IA.', badges: [{ text: 'Más elegido', tone: 'brand' }], attributes: [{ label: 'Usuarios', value: 'Hasta 25' }, { label: 'Agentes', value: '10' }], action: { label: 'Contratar', action: 'buy', payload: { plan: 'pro' } } } },
};

// Sparkline: mejor una fila con cifras de ejemplo.
DEMOS.Sparkline = {
  type: 'Table',
  props: {
    columns: [{ key: 'm', label: 'Métrica' }, { key: 'v', label: 'Valor', align: 'end' }],
    rows: [{ m: 'Pedidos diarios', v: 1240 }, { m: 'Ticket medio', v: 38.2 }],
    caption: 'El Sparkline se usa dentro de un Kpi (arriba) o junto a texto.',
  },
};

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

const HARMONIES: Array<[Harmony, string]> = [
  ['complementary', 'Complementaria'],
  ['analogous', 'Análoga'],
  ['triadic', 'Tríada'],
  ['split-complementary', 'Complementaria dividida'],
  ['tetradic', 'Tétrada'],
  ['monochrome', 'Monocromática'],
];

const ROLE_PAIRS: Array<[string, string, string, number]> = [
  ['Acción', 'primary', 'primaryForeground', 4.5],
  ['Tinte de selección', 'primarySoft', 'primarySoftForeground', 4.5],
  ['Acento armónico', 'highlight', 'highlightForeground', 4.5],
  ['Enlace sobre tarjeta', 'card', 'link', 4.5],
  ['Texto secundario', 'background', 'mutedForeground', 4.5],
  ['Borde de control', 'card', 'input', 3],
  ['Crítico', 'criticalSoft', 'critical', 4.5],
  ['Aviso', 'warningSoft', 'warning', 4.5],
  ['Correcto', 'successSoft', 'success', 4.5],
  ['Info', 'infoSoft', 'info', 4.5],
];

function systemDark(): boolean {
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr) return attr === 'dark';
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <div className="g-swatch">
      <span className="g-chip" style={{ background: color }} />
      <span className="g-swatch-label">{label}</span>
      <code>{color}</code>
    </div>
  );
}

function ThemePanel({ theme, mode }: { theme: Theme; mode: 'light' | 'dark' }) {
  const r = theme[mode] as Record<string, string>;
  return (
    <div className="g-theme">
      <div className="g-scales">
        {(['primary', 'highlight', 'neutral'] as const).map((k) => (
          <div key={k} className="g-scale">
            <span className="g-scale-name">{k === 'primary' ? 'Marca' : k === 'highlight' ? 'Acento' : 'Neutros'}</span>
            <div className="g-scale-row">
              {Object.entries(theme.scales[k]).map(([step, c]) => (
                <span key={step} className="g-step" style={{ background: c }} title={`${step} · ${c}`}>
                  <span style={{ color: contrast(c, '#ffffff') > contrast(c, '#000000') ? '#fff' : '#000' }}>{step}</span>
                </span>
              ))}
            </div>
          </div>
        ))}
        <div className="g-scale">
          <span className="g-scale-name">Gráficos</span>
          <div className="g-scale-row">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <span key={i} className="g-step" style={{ background: r[`chart${i}`] }} title={r[`chart${i}`]}>
                <span style={{ color: contrast(r[`chart${i}`], '#ffffff') > contrast(r[`chart${i}`], '#000000') ? '#fff' : '#000' }}>{i}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="g-pairs">
        {ROLE_PAIRS.map(([name, bg, fg, min]) => {
          const k = contrast(r[fg], r[bg]);
          return (
            <div key={name} className="g-pair" style={{ background: r[bg], color: r[fg], borderColor: r.border }}>
              <span className="g-pair-name">{name}</span>
              <span className="g-pair-ratio">
                {k.toFixed(1)}:1 <small>{k >= 7 ? 'AAA' : k >= min ? (min === 3 ? 'UI' : 'AA') : '✕'}</small>
              </span>
            </div>
          );
        })}
      </div>
      <div className="g-swatches">
        <Swatch color={r.background} label="Lienzo" />
        <Swatch color={r.card} label="Tarjeta" />
        <Swatch color={r.inset} label="Incrustado" />
        <Swatch color={r.border} label="Borde" />
        <Swatch color={r.foreground} label="Texto" />
        <Swatch color={r.ring} label="Foco" />
      </div>
      {theme.warnings.length > 0 && (
        <ul className="g-warnings">
          {theme.warnings.map((w) => (
            <li key={w}>Ajuste automático: {w}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StreamingCard({ mode, theme, onAction }: { mode: 'light' | 'dark'; theme: Theme; onAction: (a: OrbitalAction) => void }) {
  const full = useMemo(() => JSON.stringify(BRIEFING), []);
  const [spec, setSpec] = useState<unknown>(BRIEFING);
  const [streaming, setStreaming] = useState(false);
  const timer = useRef<number | null>(null);
  const play = () => {
    if (timer.current) window.clearInterval(timer.current);
    const acc = createSpecAccumulator();
    let i = 0;
    setStreaming(true);
    setSpec(null);
    timer.current = window.setInterval(() => {
      const chunk = full.slice(i, i + 26);
      i += 26;
      const v = acc.push(chunk);
      if (v) setSpec(v);
      if (i >= full.length) {
        window.clearInterval(timer.current!);
        timer.current = null;
        setStreaming(false);
        setSpec(BRIEFING);
      }
    }, 28);
  };
  useEffect(() => () => {
    if (timer.current) window.clearInterval(timer.current);
  }, []);
  return (
    <div className="g-stage-wrap">
      <div className="g-stage-bar">
        <span className="g-badge-example">Ejemplo</span>
        <span className="g-stage-hint">Así se vería en una AI card del widget.</span>
        <button type="button" className="g-btn" onClick={play} disabled={streaming} id="play-stream">
          {streaming ? 'Recibiendo…' : 'Reproducir en streaming'}
        </button>
      </div>
      <OrbitalTheme theme={theme} mode={mode} onAction={onAction} className="g-stage">
        <OrbitalRenderer spec={spec ?? { type: 'Stack', props: {} }} partial={streaming} />
      </OrbitalTheme>
    </div>
  );
}

function SpecLab({ mode, theme }: { mode: 'light' | 'dark'; theme: Theme }) {
  const initial = JSON.stringify(
    {
      type: 'Card',
      props: { title: 'Prueba tu spec', description: 'Edita el JSON: se valida y se pinta al momento' },
      children: [
        { type: 'Kpi', props: { label: 'Conversión', value: 0.034, format: 'percent', delta: 0.1 } },
        { type: 'Chart', props: { kind: 'bar', labels: ['A', 'B', 'C'], series: [{ name: 'Visitas', data: [30, 'cuarenta', 25] }] } },
        { type: 'Boton', props: { label: 'Hola' } },
      ],
    },
    null,
    2,
  );
  const [text, setText] = useState(initial);
  const parsed = useMemo(() => {
    try {
      return { value: JSON.parse(text) as unknown, error: null as string | null };
    } catch (e) {
      return { value: null, error: (e as Error).message };
    }
  }, [text]);
  const result = useMemo(() => (parsed.value ? validateSpec(parsed.value) : null), [parsed]);
  return (
    <div className="g-lab">
      <div className="g-lab-editor">
        <label htmlFor="spec-editor" className="g-label">Spec (JSON)</label>
        <textarea id="spec-editor" spellCheck={false} value={text} onChange={(e) => setText(e.target.value)} />
        <div className="g-lab-result" data-ok={result?.valid ? 'true' : 'false'}>
          {parsed.error ? (
            <p>JSON no válido: {parsed.error}</p>
          ) : result && result.issues.length ? (
            <>
              <p>
                {result.issues.length} {result.issues.length === 1 ? 'aviso' : 'avisos'}. Esto es lo que recibiría el agente para corregir:
              </p>
              <pre>{formatIssues(result.issues)}</pre>
            </>
          ) : (
            <p>Spec válida.</p>
          )}
        </div>
      </div>
      <OrbitalTheme theme={theme} mode={mode} className="g-stage g-lab-stage">
        {parsed.value ? <OrbitalRenderer spec={parsed.value} /> : null}
      </OrbitalTheme>
    </div>
  );
}

function App() {
  const [input, setInput] = useState<BrandInput>({ primary: '#0EA5E9', harmony: 'complementary', strategy: 'brand', radius: 'md' });
  const [hexText, setHexText] = useState('#0EA5E9');
  const [mode, setMode] = useState<'light' | 'dark'>(systemDark() ? 'dark' : 'light');
  const [log, setLog] = useState<OrbitalAction[]>([]);
  const theme = useMemo(() => {
    try {
      return createTheme(input);
    } catch {
      return createTheme({ primary: '#0EA5E9' });
    }
  }, [input]);

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    const on = () => setMode(systemDark() ? 'dark' : 'light');
    mq?.addEventListener?.('change', on);
    const mo = new MutationObserver(on);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => {
      mq?.removeEventListener?.('change', on);
      mo.disconnect();
    };
  }, []);

  const set = (patch: Partial<BrandInput>) => setInput((s) => ({ ...s, ...patch }));
  const onAction = (a: OrbitalAction) => setLog((l) => [a, ...l].slice(0, 4));
  const categories = [...new Set(COMPONENTS.map((c) => c.category))];

  return (
    <div className="g-app">
      <header className="g-head">
        <div className="g-title">
          <span className="g-eyebrow">@cas-ia/orbital-elements · 0.1.0</span>
          <h1>Orbital Elements</h1>
          <p>Un color de marca genera el tema entero. El agente compone la interfaz con el catálogo; el diseño lo pone el sistema.</p>
        </div>
        <div className="g-controls" role="group" aria-label="Marca">
          <div className="g-field">
            <label htmlFor="brand-color" className="g-label">Color primario</label>
            <div className="g-color">
              <input
                id="brand-color"
                type="color"
                value={theme.brand}
                onChange={(e) => {
                  setHexText(e.target.value);
                  set({ primary: e.target.value, accent: undefined });
                }}
              />
              <input
                id="brand-hex"
                type="text"
                value={hexText}
                aria-label="Color en hexadecimal"
                onChange={(e) => {
                  setHexText(e.target.value);
                  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(e.target.value.trim())) set({ primary: e.target.value.trim(), accent: undefined });
                }}
              />
            </div>
          </div>
          <div className="g-field">
            <label htmlFor="brand-harmony" className="g-label">Armonía</label>
            <select id="brand-harmony" value={input.harmony} onChange={(e) => set({ harmony: e.target.value as Harmony, accent: undefined })}>
              {HARMONIES.map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div className="g-field">
            <label htmlFor="brand-strategy" className="g-label">Acción sólida</label>
            <select id="brand-strategy" value={input.strategy} onChange={(e) => set({ strategy: e.target.value as 'brand' | 'ink' })}>
              <option value="brand">Color de marca</option>
              <option value="ink">Tinta (marca de acento)</option>
            </select>
          </div>
          <div className="g-field">
            <label htmlFor="brand-radius" className="g-label">Redondez</label>
            <select id="brand-radius" value={String(input.radius)} onChange={(e) => set({ radius: e.target.value as BrandInput['radius'] })}>
              <option value="none">Recta</option>
              <option value="sm">Suave</option>
              <option value="md">Media</option>
              <option value="lg">Amplia</option>
              <option value="xl">Muy amplia</option>
            </select>
          </div>
          <div className="g-field">
            <span className="g-label" id="mode-label">Modo</span>
            <div className="g-seg" role="radiogroup" aria-labelledby="mode-label">
              {(['light', 'dark'] as const).map((m) => (
                <button key={m} type="button" role="radio" aria-checked={mode === m} className={mode === m ? 'is-on' : ''} onClick={() => setMode(m)} id={`mode-${m}`}>
                  {m === 'light' ? 'Claro' : 'Oscuro'}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="g-presets" role="group" aria-label="Presets de marca">
          {BRAND_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              className="g-preset"
              id={`preset-${p.id}`}
              onClick={() => {
                setHexText(p.input.primary);
                setInput({ harmony: 'complementary', strategy: 'brand', radius: 'md', ...p.input });
              }}
            >
              <span className="g-preset-dot" style={{ background: p.input.primary }} />
              {p.label}
            </button>
          ))}
        </div>
      </header>

      <section className="g-section" aria-labelledby="s-card">
        <h2 id="s-card">AI card generada por un agente</h2>
        <StreamingCard mode={mode} theme={theme} onAction={onAction} />
        <div className="g-log" aria-live="polite">
          <span className="g-label">Acciones emitidas</span>
          {log.length === 0 ? <p>Pulsa un botón de la card: aquí aparece lo que recibiría el agente.</p> : null}
          {log.map((a, i) => (
            <code key={i}>
              {a.source} → {a.action} · «{a.text}» {Object.keys(a.payload).length ? JSON.stringify(a.payload) : ''}
            </code>
          ))}
        </div>
      </section>

      <section className="g-section" aria-labelledby="s-theme">
        <h2 id="s-theme">El tema que sale de {theme.brand}</h2>
        <p className="g-note">Cada par se ajusta solo hasta cumplir WCAG. Cambia el color: nada deja de leerse.</p>
        <ThemePanel theme={theme} mode={mode} />
      </section>

      <section className="g-section" aria-labelledby="s-catalog">
        <h2 id="s-catalog">Catálogo ({COMPONENTS.length} componentes)</h2>
        {categories.map((cat) => (
          <div key={cat} className="g-cat">
            <h3>{CATEGORY_LABEL[cat]}</h3>
            <div className="g-cat-grid">
              {COMPONENTS.filter((c) => c.category === cat && c.type !== 'Tab').map((c) => (
                <article key={c.type} className={`g-item${['Chart', 'Flow', 'Table', 'Comparison', 'Heatmap', 'Steps', 'KeyValue', 'Kpis', 'Form'].includes(c.type) ? ' g-item--wide' : ''}`} id={`c-${c.type}`}>
                  <header>
                    <code className="g-type">{c.type}</code>
                    <p>{c.description}</p>
                  </header>
                  <OrbitalTheme theme={theme} mode={mode} onAction={onAction} className="g-stage g-stage--item">
                    <OrbitalRenderer spec={DEMOS[c.type] ?? c.example} />
                  </OrbitalTheme>
                </article>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="g-section" aria-labelledby="s-lab">
        <h2 id="s-lab">Banco de pruebas de spec</h2>
        <p className="g-note">La spec de ejemplo trae dos errores a propósito: un dato de texto en un gráfico y un componente que no existe.</p>
        <SpecLab mode={mode} theme={theme} />
      </section>
    </div>
  );
}

createRoot(document.getElementById('app')!).render(<App />);
