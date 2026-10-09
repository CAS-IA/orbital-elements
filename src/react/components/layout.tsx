import React, { useId, useState } from 'react';
import type { ElementProps } from '../registry';
import type { PropsOf } from '../../catalog';
import { IconChevron, ToneIcon } from '../icons';

const cx = (...c: Array<string | false | undefined | null>) => c.filter(Boolean).join(' ');

export function Stack({ props, children }: ElementProps<PropsOf<'Stack'>>) {
  return (
    <div
      className={cx('oe-stack', props.direction === 'horizontal' && 'oe-stack--row', props.wrap && 'oe-stack--wrap')}
      data-gap={props.gap ?? 'md'}
      data-align={props.align}
    >
      {children}
    </div>
  );
}

export function Grid({ props, children }: ElementProps<PropsOf<'Grid'>>) {
  return (
    <div className="oe-grid" data-gap={props.gap ?? 'md'} style={{ ['--oe-cols' as string]: props.columns ?? 2 }}>
      {children}
    </div>
  );
}

export function Card({ props, children }: ElementProps<PropsOf<'Card'>>) {
  const hasHead = props.title || props.description;
  return (
    <section className={cx('oe-card', `oe-card--${props.variant ?? 'default'}`)} data-tone={props.tone}>
      {hasHead && (
        <header className="oe-card-head">
          {props.title && (
            <h3 className="oe-card-title">
              {props.tone && props.tone !== 'neutral' && (
                <span className="oe-card-icon" data-tone={props.tone}>
                  <ToneIcon tone={props.tone} size={16} />
                </span>
              )}
              {props.title}
            </h3>
          )}
          {props.description && <p className="oe-card-desc">{props.description}</p>}
        </header>
      )}
      {React.Children.count(children) > 0 && <div className="oe-card-body">{children}</div>}
      {props.footer && <footer className="oe-card-foot">{props.footer}</footer>}
    </section>
  );
}

export function Section({ props, children }: ElementProps<PropsOf<'Section'>>) {
  return (
    <section className="oe-section">
      <header className="oe-section-head">
        {props.eyebrow && <span className="oe-eyebrow">{props.eyebrow}</span>}
        <h3 className="oe-section-title">{props.title}</h3>
        {props.description && <p className="oe-section-desc">{props.description}</p>}
      </header>
      <div className="oe-stack" data-gap="md">
        {children}
      </div>
    </section>
  );
}

export function Tabs({ props, children, childElements }: ElementProps<PropsOf<'Tabs'>>) {
  const items = React.Children.toArray(children);
  const [active, setActive] = useState(Math.min(props.defaultTab ?? 0, Math.max(0, items.length - 1)));
  const base = useId();
  if (!items.length) return null;
  const titleOf = (i: number) => (childElements?.[i]?.props as { title?: string } | undefined)?.title;
  return (
    <div className="oe-tabs">
      <div className="oe-tablist" role="tablist">
        {items.map((_, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            id={`${base}-t${i}`}
            aria-selected={i === active}
            aria-controls={`${base}-p${i}`}
            className={cx('oe-tab', i === active && 'is-active')}
            onClick={() => setActive(i)}
          >
            {titleOf(i) ?? `${i + 1}`}
          </button>
        ))}
      </div>
      {items.map((el, i) => (
        <div key={i} role="tabpanel" id={`${base}-p${i}`} aria-labelledby={`${base}-t${i}`} hidden={i !== active} className="oe-tabpanel">
          {el}
        </div>
      ))}
    </div>
  );
}

export function Tab({ children }: ElementProps<PropsOf<'Tab'>>) {
  return (
    <div className="oe-stack" data-gap="md">
      {children}
    </div>
  );
}

export function Disclosure({ props, children }: ElementProps<PropsOf<'Disclosure'>>) {
  return (
    <details className="oe-disclosure" open={props.open}>
      <summary>
        <IconChevron size={16} className="oe-disclosure-chevron" />
        {props.title}
      </summary>
      <div className="oe-disclosure-body oe-stack" data-gap="md">
        {children}
      </div>
    </details>
  );
}
