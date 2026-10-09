/**
 * Formato de cifras y textos de la interfaz según el idioma activo.
 * El formato numérico sigue al idioma, nunca a un locale fijo (Qratia).
 */
export type NumberFormat = 'number' | 'integer' | 'percent' | 'currency' | 'compact' | 'duration';

export interface FormatOptions {
  locale: string;
  currency?: string;
}

export function formatValue(value: unknown, format: NumberFormat | undefined, opts: FormatOptions): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? '✓' : '✕';
  if (typeof value !== 'number') return String(value);
  if (!Number.isFinite(value)) return '—';
  const { locale } = opts;
  try {
    switch (format) {
      case 'integer':
        return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
      case 'percent':
        return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: Math.abs(value) < 0.1 ? 1 : 0 }).format(value);
      case 'currency':
        return new Intl.NumberFormat(locale, { style: 'currency', currency: opts.currency || 'EUR', maximumFractionDigits: Math.abs(value) >= 1000 ? 0 : 2 }).format(value);
      case 'compact':
        return new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(value);
      case 'duration':
        return formatDuration(value, locale);
      default:
        return new Intl.NumberFormat(locale, { maximumFractionDigits: Math.abs(value) >= 100 ? 0 : 2 }).format(value);
    }
  } catch {
    return String(value);
  }
}

/** Para ejes: siempre compacto. */
export function formatAxis(value: number, format: NumberFormat | undefined, opts: FormatOptions): string {
  if (format === 'percent' || format === 'duration') return formatValue(value, format, opts);
  if (format === 'currency') {
    try {
      return new Intl.NumberFormat(opts.locale, { style: 'currency', currency: opts.currency || 'EUR', notation: 'compact', maximumFractionDigits: 1 }).format(value);
    } catch {
      /* cae al compacto */
    }
  }
  return new Intl.NumberFormat(opts.locale, { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

function formatDuration(seconds: number, locale: string): string {
  const en = locale.startsWith('en');
  const s = Math.round(Math.abs(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const sign = seconds < 0 ? '−' : '';
  if (h) return `${sign}${h} h${m ? ` ${m} min` : ''}`;
  if (m) return `${sign}${m} min${r ? ` ${r} s` : ''}`;
  return `${sign}${r} ${en ? 's' : 's'}`;
}

/** Variación como texto con signo (`+12 %`). */
export function formatDelta(delta: number, locale: string): string {
  const v = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1, signDisplay: 'exceptZero' }).format(delta);
  return v.replace('-', '−');
}

/** "Ticks" redondos para un eje: 0, 25, 50, 75, 100… */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) {
    max = min === 0 ? 1 : min * 1.2;
    if (min > 0) min = 0;
  }
  const span = max - min;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1) * mag;
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = start; v <= end + step / 2; v += step) out.push(Math.round(v / step) * step);
  return out;
}

const MESSAGES = {
  es: {
    noData: 'Sin dato',
    copy: 'Copiar',
    copied: 'Copiado',
    confirm: 'Confirmar',
    cancel: 'Cancelar',
    approve: 'Aprobar',
    reject: 'Rechazar',
    submit: 'Enviar',
    send: 'Enviar selección',
    required: 'Obligatorio',
    answered: 'Respondido',
    approved: 'Aprobado',
    rejected: 'Rechazado',
    confirmed: 'Confirmado',
    cancelled: 'Cancelado',
    vsPrevious: 'respecto al periodo anterior',
    showMore: 'Ver más',
    yes: 'Sí',
    no: 'No',
    error: 'No se pudo mostrar este bloque',
  },
  en: {
    noData: 'No data',
    copy: 'Copy',
    copied: 'Copied',
    confirm: 'Confirm',
    cancel: 'Cancel',
    approve: 'Approve',
    reject: 'Reject',
    submit: 'Submit',
    send: 'Send selection',
    required: 'Required',
    answered: 'Answered',
    approved: 'Approved',
    rejected: 'Rejected',
    confirmed: 'Confirmed',
    cancelled: 'Cancelled',
    vsPrevious: 'vs previous period',
    showMore: 'Show more',
    yes: 'Yes',
    no: 'No',
    error: 'This block could not be displayed',
  },
} as const;

export type MessageKey = keyof (typeof MESSAGES)['es'];

export function message(locale: string, key: MessageKey): string {
  return (locale.toLowerCase().startsWith('en') ? MESSAGES.en : MESSAGES.es)[key];
}
