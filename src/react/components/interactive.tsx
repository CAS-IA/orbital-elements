/**
 * Componentes que emiten acciones. El host decide qué hacer con ellas
 * (`onAction` de OrbitalTheme): enviarlas como mensaje al agente, llamar a
 * una API… Cada acción lleva `text`, el resumen legible de lo que hizo el
 * usuario. Tras responder, el bloque queda marcado y deshabilitado para que
 * no se envíe dos veces.
 */
import React, { useId, useState } from 'react';
import type { ElementProps } from '../registry';
import type { PropsOf } from '../../catalog';
import { useEmit, useOrbital, useT } from '../context';
import { formatValue } from '../format';
import { IconCheck, ToneIcon } from '../icons';

type Btn = { label: string; action: string; payload?: Record<string, unknown>; variant?: 'primary' | 'secondary' | 'ghost' | 'danger' };

function Button({ b, onClick, disabled, chosen }: { b: Btn; onClick: () => void; disabled?: boolean; chosen?: boolean }) {
  return (
    <button type="button" className={`oe-btn oe-btn--${b.variant ?? 'secondary'}`} onClick={onClick} disabled={disabled} data-chosen={chosen ? 'true' : undefined}>
      {chosen && <IconCheck size={14} />}
      {b.label}
    </button>
  );
}

function Answered({ text }: { text: string }) {
  return (
    <p className="oe-answered">
      <IconCheck size={14} />
      {text}
    </p>
  );
}

export function Actions({ props }: ElementProps<PropsOf<'Actions'>>) {
  const emit = useEmit();
  const [chosen, setChosen] = useState<number | null>(null);
  return (
    <div className="oe-actions">
      {props.question && <p className="oe-question">{props.question}</p>}
      <div className="oe-btn-row">
        {props.buttons.map((b, i) => (
          <Button
            key={i}
            b={b}
            chosen={chosen === i}
            disabled={chosen !== null}
            onClick={() => {
              setChosen(i);
              emit({ action: b.action, payload: b.payload ?? {}, text: b.label, source: 'Actions' });
            }}
          />
        ))}
      </div>
    </div>
  );
}

export function Options({ props }: ElementProps<PropsOf<'Options'>>) {
  const emit = useEmit();
  const t = useT();
  const [picked, setPicked] = useState<string[]>([]);
  const [sent, setSent] = useState(false);
  const action = props.action ?? 'select';
  const label = (v: string) => props.options.find((o) => o.value === v)?.label ?? v;

  const choose = (value: string) => {
    if (sent) return;
    if (props.multi) {
      setPicked((p) => (p.includes(value) ? p.filter((x) => x !== value) : [...p, value]));
      return;
    }
    setPicked([value]);
    setSent(true);
    emit({ action, payload: { value }, text: label(value), source: 'Options' });
  };

  return (
    <fieldset className="oe-options" disabled={sent}>
      {props.question && <legend className="oe-question">{props.question}</legend>}
      <div className="oe-option-grid">
        {props.options.map((o) => {
          const on = picked.includes(o.value);
          return (
            <button key={o.value} type="button" role={props.multi ? 'checkbox' : 'radio'} aria-checked={on} className="oe-option" data-selected={on ? 'true' : undefined} onClick={() => choose(o.value)}>
              <span className="oe-option-mark" aria-hidden="true">{on && <IconCheck size={12} />}</span>
              <span className="oe-option-text">
                <span className="oe-option-label">{o.label}</span>
                {o.description && <span className="oe-option-desc">{o.description}</span>}
              </span>
            </button>
          );
        })}
      </div>
      {props.multi && !sent && (
        <div className="oe-btn-row">
          <button
            type="button"
            className="oe-btn oe-btn--primary"
            disabled={!picked.length}
            onClick={() => {
              setSent(true);
              emit({ action, payload: { values: picked }, text: picked.map(label).join(', '), source: 'Options' });
            }}
          >
            {t('send')}
          </button>
        </div>
      )}
    </fieldset>
  );
}

export function Form({ props }: ElementProps<PropsOf<'Form'>>) {
  const emit = useEmit();
  const t = useT();
  const { locale } = useOrbital();
  const [values, setValues] = useState<Record<string, unknown>>(() =>
    Object.fromEntries(props.fields.map((f) => [f.name, f.type === 'boolean' ? false : ''])),
  );
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const uid = useId();
  const [sent, setSent] = useState(false);
  const set = (k: string, v: unknown) => setValues((s) => ({ ...s, [k]: v }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const missing = Object.fromEntries(props.fields.filter((f) => f.required && (values[f.name] === '' || values[f.name] === undefined)).map((f) => [f.name, true]));
    setErrors(missing);
    if (Object.keys(missing).length) return;
    const clean = Object.fromEntries(
      props.fields.map((f) => [f.name, f.type === 'number' && values[f.name] !== '' ? Number(values[f.name]) : values[f.name]]),
    );
    setSent(true);
    const summary = props.fields
      .filter((f) => clean[f.name] !== '' && clean[f.name] !== undefined)
      .map((f) => `${f.label}: ${f.type === 'boolean' ? (clean[f.name] ? t('yes') : t('no')) : formatValue(clean[f.name], undefined, { locale })}`)
      .join(' · ');
    emit({ action: props.action ?? 'submit', payload: { values: clean }, text: summary || t('submit'), source: 'Form' });
  };

  return (
    <form className="oe-form" onSubmit={submit} noValidate>
      <fieldset disabled={sent} className="oe-form-fields">
        {props.fields.map((f) => {
          const id = `${uid}-${f.name}`;
          const invalid = errors[f.name];
          if (f.type === 'boolean') {
            return (
              <label key={f.name} className="oe-field oe-field--check" htmlFor={id}>
                <input id={id} type="checkbox" checked={!!values[f.name]} onChange={(e) => set(f.name, e.target.checked)} />
                <span>{f.label}</span>
              </label>
            );
          }
          return (
            <div key={f.name} className="oe-field" data-invalid={invalid ? 'true' : undefined}>
              <label htmlFor={id}>
                {f.label}
                {f.required && <span className="oe-required" aria-label={t('required')}> *</span>}
              </label>
              {f.type === 'textarea' ? (
                <textarea id={id} rows={3} placeholder={f.placeholder} value={String(values[f.name] ?? '')} onChange={(e) => set(f.name, e.target.value)} aria-invalid={invalid} />
              ) : f.type === 'select' ? (
                <select id={id} value={String(values[f.name] ?? '')} onChange={(e) => set(f.name, e.target.value)} aria-invalid={invalid}>
                  <option value="">{f.placeholder ?? '—'}</option>
                  {(f.options ?? []).map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              ) : (
                <input id={id} type={f.type} placeholder={f.placeholder} value={String(values[f.name] ?? '')} onChange={(e) => set(f.name, e.target.value)} aria-invalid={invalid} />
              )}
              {invalid ? <span className="oe-field-error">{t('required')}</span> : f.help && <span className="oe-field-help">{f.help}</span>}
            </div>
          );
        })}
      </fieldset>
      {sent ? (
        <Answered text={t('answered')} />
      ) : (
        <div className="oe-btn-row">
          <button type="submit" className="oe-btn oe-btn--primary">{props.submitLabel ?? t('submit')}</button>
        </div>
      )}
    </form>
  );
}

export function Confirmation({ props }: ElementProps<PropsOf<'Confirmation'>>) {
  const emit = useEmit();
  const t = useT();
  const [decision, setDecision] = useState<'confirm' | 'cancel' | null>(null);
  const decide = (d: 'confirm' | 'cancel') => {
    setDecision(d);
    emit({ action: 'confirmation', payload: { decision: d, ...(props.payload ?? {}) }, text: d === 'confirm' ? props.confirmLabel ?? t('confirmed') : props.cancelLabel ?? t('cancelled'), source: 'Confirmation' });
  };
  const tone = props.tone ?? 'warning';
  return (
    <div className="oe-confirm" data-tone={tone}>
      <span className="oe-alert-icon">
        <ToneIcon tone={tone} size={18} />
      </span>
      <div className="oe-confirm-body">
        {props.title && <p className="oe-alert-title">{props.title}</p>}
        <p className="oe-confirm-message">{props.message}</p>
        {decision ? (
          <Answered text={decision === 'confirm' ? t('confirmed') : t('cancelled')} />
        ) : (
          <div className="oe-btn-row">
            <button type="button" className={`oe-btn oe-btn--${tone === 'critical' ? 'danger' : 'primary'}`} onClick={() => decide('confirm')}>
              {props.confirmLabel ?? t('confirm')}
            </button>
            <button type="button" className="oe-btn oe-btn--ghost" onClick={() => decide('cancel')}>
              {props.cancelLabel ?? t('cancel')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function Approval({ props }: ElementProps<PropsOf<'Approval'>>) {
  const emit = useEmit();
  const t = useT();
  const [decision, setDecision] = useState<'approve' | 'reject' | null>(null);
  const decide = (d: 'approve' | 'reject') => {
    setDecision(d);
    emit({
      action: 'approval',
      payload: { pendingActionId: props.pendingActionId, decision: d },
      text: `${d === 'approve' ? t('approved') : t('rejected')}: ${props.title}`,
      source: 'Approval',
    });
  };
  return (
    <section className="oe-approval" data-destructive={props.destructive ? 'true' : undefined} data-decision={decision ?? undefined}>
      <header>
        <span className="oe-eyebrow">{t('approve')}</span>
        <h3 className="oe-card-title">{props.title}</h3>
        {props.summary && <p className="oe-card-desc">{props.summary}</p>}
      </header>
      {props.rows && props.rows.length > 0 && (
        <dl className="oe-kv">
          {props.rows.map((r, i) => (
            <div key={i} className="oe-kv-row">
              <dt>{r.label}</dt>
              <dd>{r.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {decision ? (
        <Answered text={decision === 'approve' ? t('approved') : t('rejected')} />
      ) : (
        <div className="oe-btn-row">
          <button type="button" className={`oe-btn oe-btn--${props.destructive ? 'danger' : 'primary'}`} onClick={() => decide('approve')}>
            {props.approveLabel ?? t('approve')}
          </button>
          <button type="button" className="oe-btn oe-btn--secondary" onClick={() => decide('reject')}>
            {props.rejectLabel ?? t('reject')}
          </button>
        </div>
      )}
    </section>
  );
}

export function Product({ props }: ElementProps<PropsOf<'Product'>>) {
  const emit = useEmit();
  const { locale } = useOrbital();
  const [done, setDone] = useState(false);
  const price = typeof props.price === 'number' ? formatValue(props.price, 'currency', { locale, currency: props.currency }) : props.price;
  return (
    <article className="oe-product">
      {props.image && (
        <div className="oe-product-media">
          <img src={props.image} alt={props.title} loading="lazy" referrerPolicy="no-referrer" />
        </div>
      )}
      <div className="oe-product-body">
        {props.badges && props.badges.length > 0 && (
          <div className="oe-badges">
            {props.badges.map((b, i) => (
              <span key={i} className="oe-badge" data-tone={b.tone ?? 'neutral'}>{b.text}</span>
            ))}
          </div>
        )}
        <h3 className="oe-product-title">{props.title}</h3>
        {price && <span className="oe-product-price oe-num">{price}</span>}
        {props.description && <p className="oe-product-desc">{props.description}</p>}
        {props.attributes && props.attributes.length > 0 && (
          <dl className="oe-kv oe-kv--compact">
            {props.attributes.map((a, i) => (
              <div key={i} className="oe-kv-row">
                <dt>{a.label}</dt>
                <dd>{a.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {props.action && (
          <div className="oe-btn-row">
            <Button
              b={{ ...props.action, variant: props.action.variant ?? 'primary' }}
              chosen={done}
              disabled={done}
              onClick={() => {
                setDone(true);
                emit({ action: props.action!.action, payload: { product: props.title, ...(props.action!.payload ?? {}) }, text: `${props.action!.label}: ${props.title}`, source: 'Product' });
              }}
            />
          </div>
        )}
      </div>
    </article>
  );
}
