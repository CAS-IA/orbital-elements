import React, { useState } from 'react';
import type { ElementProps } from '../registry';
import type { PropsOf } from '../../catalog';
import { Markdown } from '../markdown';
import { IconCheck, IconCopy, IconQuote } from '../icons';
import { useT } from '../context';

export function Heading({ props }: ElementProps<PropsOf<'Heading'>>) {
  const level = props.level ?? 2;
  const Tag = (`h${level + 1}` as unknown) as 'h2';
  return (
    <div className="oe-heading" data-level={level}>
      {props.eyebrow && <span className="oe-eyebrow">{props.eyebrow}</span>}
      <Tag className="oe-heading-text">{props.text}</Tag>
    </div>
  );
}

export function Text({ props }: ElementProps<PropsOf<'Text'>>) {
  const variant = props.variant ?? 'body';
  if (props.markdown === false) return <p className={`oe-text oe-text--${variant}`}>{props.text}</p>;
  return <Markdown text={props.text} className={`oe-text oe-text--${variant}`} />;
}

export function Quote({ props }: ElementProps<PropsOf<'Quote'>>) {
  return (
    <figure className="oe-quote">
      <IconQuote size={20} className="oe-quote-mark" />
      <blockquote>{props.text}</blockquote>
      {(props.cite || props.source) && (
        <figcaption>
          {props.cite && <span className="oe-quote-cite">{props.cite}</span>}
          {props.source && <span className="oe-quote-source">{props.source}</span>}
        </figcaption>
      )}
    </figure>
  );
}

export function Code({ props }: ElementProps<PropsOf<'Code'>>) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard?.writeText(props.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* el portapapeles puede estar bloqueado: no es un error del bloque */
    }
  };
  return (
    <div className="oe-codeblock">
      <div className="oe-codeblock-head">
        <span>{props.title ?? props.language ?? ''}</span>
        <button type="button" className="oe-btn oe-btn--ghost oe-btn--xs" onClick={copy} aria-label={copied ? t('copied') : t('copy')}>
          {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
          {copied ? t('copied') : t('copy')}
        </button>
      </div>
      <pre className="oe-pre">
        <code>{props.code}</code>
      </pre>
    </div>
  );
}

export function Divider({ props }: ElementProps<PropsOf<'Divider'>>) {
  if (!props.label) return <hr className="oe-divider-line" />;
  return (
    <div className="oe-divider" role="separator">
      <span>{props.label}</span>
    </div>
  );
}
