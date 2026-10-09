import React from 'react';
import type { ElementProps } from '../registry';
import type { PropsOf } from '../../catalog';
import { useOrbital, useT } from '../context';
import { formatDelta, formatValue } from '../format';
import { IconArrowDown, IconArrowUp, IconCheck, IconMinus, IconX } from '../icons';
import { SparkLine, TONE_COLOR } from '../chart-utils';

type KpiProps = PropsOf<'Kpi'>;

function KpiCard({ p }: { p: KpiProps }) {
  const { locale } = useOrbital();
  const t = useT();
  const hasValue = p.value !== null && p.value !== undefined && p.value !== '';
  // Sin dato no hay tendencia: una flecha sobre la nada sería inventarse una lectura.
  const hasDelta = hasValue && typeof p.delta === 'number' && Number.isFinite(p.delta);
  const dir = hasDelta ? (p.delta! > 0 ? 'up' : p.delta! < 0 ? 'down' : 'flat') : null;
  const good = dir === 'flat' || !dir ? null : (dir === 'up') === ((p.goodWhen ?? 'up') === 'up');
  const deltaTone = good === null ? 'neutral' : good ? 'success' : 'critical';
  const valueText = typeof p.value === 'number' ? formatValue(p.value, p.format, { locale, currency: p.currency }) : String(p.value ?? '');
  const long = typeof p.value === 'string' && (p.value.length > 12 || !/\d/.test(p.value));

  return (
    <div className="oe-kpi" data-tone={p.tone}>
      <span className="oe-kpi-label">{p.label}</span>
      <div className="oe-kpi-row">
        {hasValue ? (
          <span className={`oe-kpi-value${long ? ' oe-kpi-value--text' : ''}`}>
            {valueText}
            {p.suffix && <span className="oe-kpi-suffix">{p.suffix}</span>}
          </span>
        ) : (
          <span className="oe-kpi-value oe-kpi-value--nodata" title={t('noData')}>
            —
          </span>
        )}
        {(hasDelta || (hasValue && p.deltaLabel)) && (
          <span className="oe-delta" data-tone={deltaTone} aria-label={`${hasDelta ? formatDelta(p.delta!, locale) : p.deltaLabel} ${t('vsPrevious')}`}>
            {dir === 'up' ? <IconArrowUp size={12} /> : dir === 'down' ? <IconArrowDown size={12} /> : <IconMinus size={12} />}
            {hasDelta ? formatDelta(p.delta!, locale) : p.deltaLabel}
          </span>
        )}
      </div>
      {p.sparkline && p.sparkline.length > 1 && (
        <div className="oe-kpi-spark" style={{ color: good === false ? TONE_COLOR.critical : 'var(--oe-chart-1)' }}>
          <SparkLine data={p.sparkline} />
        </div>
      )}
      {p.context && <span className="oe-kpi-context">{p.context}</span>}
    </div>
  );
}

export function Kpi({ props }: ElementProps<KpiProps>) {
  return <KpiCard p={props} />;
}

export function Kpis({ props }: ElementProps<PropsOf<'Kpis'>>) {
  return (
    <div className="oe-kpis">
      {props.items.map((k, i) => (
        <KpiCard key={i} p={k} />
      ))}
    </div>
  );
}

export function Table({ props }: ElementProps<PropsOf<'Table'>>) {
  const { locale } = useOrbital();
  const numeric = (key: string) => props.rows.some((r) => typeof r[key] === 'number');
  return (
    <div className="oe-table-wrap">
      <table className={`oe-table${props.dense ? ' oe-table--dense' : ''}`}>
        <thead>
          <tr>
            {props.columns.map((c) => (
              <th key={c.key} scope="col" data-align={c.align ?? (numeric(c.key) ? 'end' : 'start')}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {props.rows.map((row, i) => (
            <tr key={i}>
              {props.columns.map((c) => {
                const v = row[c.key];
                return (
                  <td key={c.key} data-align={c.align ?? (typeof v === 'number' ? 'end' : 'start')} className={typeof v === 'number' ? 'oe-num' : undefined}>
                    {typeof v === 'boolean' ? <BoolMark value={v} /> : formatValue(v, c.format, { locale, currency: c.currency })}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {props.caption && <p className="oe-table-caption">{props.caption}</p>}
    </div>
  );
}

function BoolMark({ value }: { value: boolean }) {
  const t = useT();
  return (
    <span className="oe-bool" data-value={String(value)} aria-label={value ? t('yes') : t('no')}>
      {value ? <IconCheck size={15} /> : <IconX size={15} />}
    </span>
  );
}

export function KeyValue({ props }: ElementProps<PropsOf<'KeyValue'>>) {
  const { locale } = useOrbital();
  return (
    <dl className="oe-kv" style={{ ['--oe-cols' as string]: props.columns ?? 1 }}>
      {props.items.map((it, i) => (
        <div key={i} className="oe-kv-row">
          <dt>{it.label}</dt>
          <dd data-tone={it.tone}>
            {typeof it.value === 'boolean' ? <BoolMark value={it.value} /> : formatValue(it.value, undefined, { locale })}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function List({ props }: ElementProps<PropsOf<'List'>>) {
  const variant = props.variant ?? (props.items.some((i) => typeof i !== 'string') ? 'cards' : 'bullets');
  if (variant === 'cards') {
    return (
      <ul className="oe-list-cards">
        {props.items.map((it, i) => {
          const o = typeof it === 'string' ? { title: it } : it;
          return (
            <li key={i} className="oe-list-card" data-tone={'tone' in o ? o.tone : undefined}>
              <div className="oe-list-card-main">
                <span className="oe-list-card-title">{o.title}</span>
                {'description' in o && o.description && <span className="oe-list-card-desc">{o.description}</span>}
              </div>
              {'meta' in o && o.meta && <span className="oe-list-card-meta">{o.meta}</span>}
            </li>
          );
        })}
      </ul>
    );
  }
  const Tag = variant === 'numbered' ? 'ol' : 'ul';
  return (
    <Tag className={`oe-list oe-list--${variant}`}>
      {props.items.map((it, i) => {
        const o = typeof it === 'string' ? { title: it } : it;
        const done = 'done' in o ? o.done : undefined;
        return (
          <li key={i} data-done={variant === 'check' ? String(!!done) : undefined}>
            {variant === 'check' && <span className="oe-check-box" aria-hidden="true">{done && <IconCheck size={12} />}</span>}
            <span>
              {o.title}
              {'description' in o && o.description && <span className="oe-list-desc"> — {o.description}</span>}
            </span>
          </li>
        );
      })}
    </Tag>
  );
}

export function Badges({ props }: ElementProps<PropsOf<'Badges'>>) {
  return (
    <div className="oe-badges">
      {props.items.map((b, i) => (
        <span key={i} className="oe-badge" data-tone={b.tone ?? 'neutral'}>
          {b.text}
        </span>
      ))}
    </div>
  );
}

export function Status({ props }: ElementProps<PropsOf<'Status'>>) {
  return (
    <div className="oe-status" data-status={props.status}>
      <span className="oe-status-dot" aria-hidden="true" />
      <div className="oe-status-main">
        <span className="oe-status-label">{props.label}</span>
        {props.description && <span className="oe-status-desc">{props.description}</span>}
      </div>
      {props.value && <span className="oe-status-value">{props.value}</span>}
    </div>
  );
}

export function Progress({ props }: ElementProps<PropsOf<'Progress'>>) {
  const { locale } = useOrbital();
  const max = props.max ?? (props.format === 'percent' ? 1 : 100);
  const pct = Math.max(0, Math.min(1, props.value / (max || 1)));
  const text = props.format ? formatValue(props.value, props.format, { locale }) : `${Math.round(pct * 100)} %`;
  return (
    <div className="oe-progress" data-tone={props.tone ?? 'brand'}>
      <div className="oe-progress-head">
        {props.label && <span className="oe-progress-label">{props.label}</span>}
        <span className="oe-progress-value oe-num">{text}</span>
      </div>
      <div className="oe-progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={props.value} aria-label={props.label}>
        <div className="oe-progress-fill" style={{ width: `${pct * 100}%` }} />
      </div>
    </div>
  );
}

export function Gauge({ props }: ElementProps<PropsOf<'Gauge'>>) {
  const { locale } = useOrbital();
  const min = props.min ?? 0;
  const max = props.max ?? (props.format === 'percent' ? 1 : 100);
  const pct = Math.max(0, Math.min(1, (props.value - min) / (max - min || 1)));
  const tone = props.thresholds?.find((t) => props.value <= t.upTo)?.tone ?? props.thresholds?.[props.thresholds.length - 1]?.tone ?? 'brand';
  const R = 80;
  const C = Math.PI * R;
  return (
    <figure className="oe-gauge">
      <svg viewBox="0 0 200 116" role="img" aria-label={`${props.label ?? ''} ${formatValue(props.value, props.format, { locale })}`}>
        <path d="M20 100 A80 80 0 0 1 180 100" className="oe-gauge-track" />
        <path d="M20 100 A80 80 0 0 1 180 100" className="oe-gauge-fill" style={{ stroke: TONE_COLOR[tone], strokeDasharray: `${C * pct} ${C}` }} />
        <text x="100" y="92" textAnchor="middle" className="oe-gauge-value">
          {formatValue(props.value, props.format, { locale })}
        </text>
        <text x="20" y="114" textAnchor="middle" className="oe-gauge-limit">{formatValue(min, props.format, { locale })}</text>
        <text x="180" y="114" textAnchor="middle" className="oe-gauge-limit">{formatValue(max, props.format, { locale })}</text>
      </svg>
      {props.label && <figcaption>{props.label}</figcaption>}
    </figure>
  );
}

export function Ranking({ props }: ElementProps<PropsOf<'Ranking'>>) {
  const { locale } = useOrbital();
  const items = [...props.items].sort((a, b) => b.value - a.value).slice(0, props.limit ?? 10);
  const max = Math.max(...items.map((i) => Math.abs(i.value)), 0) || 1;
  return (
    <ol className="oe-ranking">
      {items.map((it, i) => (
        <li key={i}>
          <span className="oe-rank-pos">{i + 1}</span>
          <div className="oe-rank-main">
            <div className="oe-rank-head">
              <span className="oe-rank-label">{it.label}</span>
              <span className="oe-rank-value oe-num">{formatValue(it.value, props.format, { locale, currency: props.currency })}</span>
            </div>
            <div className="oe-rank-track">
              <div className="oe-rank-bar" style={{ width: `${(Math.abs(it.value) / max) * 100}%` }} />
            </div>
            {it.note && <span className="oe-rank-note">{it.note}</span>}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function Comparison({ props }: ElementProps<PropsOf<'Comparison'>>) {
  const { locale } = useOrbital();
  return (
    <div className="oe-table-wrap">
      <table className="oe-table oe-compare">
        <thead>
          <tr>
            <th scope="col" />
            {props.options.map((o, i) => (
              <th key={i} scope="col" data-highlight={o.highlight ? 'true' : undefined}>
                <span className="oe-compare-title">{o.title}</span>
                {o.note && <span className="oe-compare-note">{o.note}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {props.rows.map((r, i) => (
            <tr key={i}>
              <th scope="row">{r.label}</th>
              {props.options.map((o, j) => {
                const v = r.values[j];
                return (
                  <td key={j} data-highlight={o.highlight ? 'true' : undefined} data-align="center">
                    {typeof v === 'boolean' ? <BoolMark value={v} /> : formatValue(v, undefined, { locale })}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
