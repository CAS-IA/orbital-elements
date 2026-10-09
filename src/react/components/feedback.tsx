import React from 'react';
import type { ElementProps } from '../registry';
import type { PropsOf } from '../../catalog';
import { Markdown } from '../markdown';
import { IconInbox, ToneIcon } from '../icons';

export function Alert({ props }: ElementProps<PropsOf<'Alert'>>) {
  const tone = props.tone ?? 'info';
  return (
    <div className="oe-alert" data-tone={tone} role={tone === 'critical' || tone === 'warning' ? 'alert' : 'status'}>
      <span className="oe-alert-icon">
        <ToneIcon tone={tone} size={18} />
      </span>
      <div className="oe-alert-body">
        {props.title && <p className="oe-alert-title">{props.title}</p>}
        <Markdown text={props.message} className="oe-alert-message" />
      </div>
    </div>
  );
}

export function EmptyState({ props }: ElementProps<PropsOf<'EmptyState'>>) {
  return (
    <div className="oe-empty">
      <span className="oe-empty-icon">
        <IconInbox size={22} />
      </span>
      <p className="oe-empty-title">{props.title}</p>
      {props.description && <p className="oe-empty-desc">{props.description}</p>}
    </div>
  );
}
