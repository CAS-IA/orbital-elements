import React from 'react';
import type { ElementProps } from '../registry';
import type { PropsOf } from '../../catalog';
import { isSafeUrl } from '../markdown';
import { IconExternal } from '../icons';

/** YouTube/Vimeo → URL de embed con dominio fijo (nunca la URL del modelo tal cual). */
function embedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const id = u.searchParams.get('v');
      return id && /^[\w-]{6,20}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }
    if (host === 'youtu.be') {
      const id = u.pathname.slice(1);
      return /^[\w-]{6,20}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }
    if (host === 'vimeo.com') {
      const id = u.pathname.split('/').filter(Boolean)[0];
      return id && /^\d{4,12}$/.test(id) ? `https://player.vimeo.com/video/${id}` : null;
    }
  } catch {
    /* URL inválida */
  }
  return null;
}

function kindOf(url: string, kind?: string): 'image' | 'video' | 'audio' | 'embed' {
  if (embedUrl(url)) return 'embed';
  if (kind && kind !== 'auto') return kind as 'image' | 'video' | 'audio';
  const path = url.split('?')[0].toLowerCase();
  if (/\.(mp4|webm|mov|m4v)$/.test(path)) return 'video';
  if (/\.(mp3|wav|ogg|m4a|aac)$/.test(path)) return 'audio';
  return 'image';
}

export function Media({ props }: ElementProps<PropsOf<'Media'>>) {
  // Defensa en profundidad: el catálogo ya exige http(s).
  if (!isSafeUrl(props.url) || props.url.startsWith('mailto:')) return null;
  const kind = kindOf(props.url, props.kind);
  return (
    <figure className="oe-media" data-kind={kind}>
      {kind === 'embed' && (
        <div className="oe-media-frame">
          <iframe src={embedUrl(props.url)!} title={props.caption ?? props.alt ?? 'Vídeo'} loading="lazy" allow="encrypted-media; picture-in-picture" allowFullScreen sandbox="allow-scripts allow-same-origin allow-presentation" referrerPolicy="strict-origin-when-cross-origin" />
        </div>
      )}
      {kind === 'image' && <img src={props.url} alt={props.alt ?? ''} loading="lazy" decoding="async" referrerPolicy="no-referrer" />}
      {kind === 'video' && <video src={props.url} poster={props.poster} controls preload="metadata" />}
      {kind === 'audio' && <audio src={props.url} controls preload="metadata" />}
      {props.caption && <figcaption>{props.caption}</figcaption>}
    </figure>
  );
}

function domain(href: string): string {
  try {
    return new URL(href).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function Links({ props }: ElementProps<PropsOf<'Links'>>) {
  const variant = props.variant ?? 'list';
  const items = props.items.filter((l) => isSafeUrl(l.href) && !l.href.startsWith('mailto:'));
  return (
    <ul className={`oe-links oe-links--${variant}`}>
      {items.map((l, i) => (
        <li key={i}>
          <a href={l.href} target="_blank" rel="noopener noreferrer" className="oe-links-item">
            {variant === 'sources' && <span className="oe-links-index">{i + 1}</span>}
            <span className="oe-links-main">
              <span className="oe-links-text">{l.text}</span>
              {l.description && <span className="oe-links-desc">{l.description}</span>}
              <span className="oe-links-domain">{domain(l.href)}</span>
            </span>
            <IconExternal size={14} className="oe-links-ext" />
          </a>
        </li>
      ))}
    </ul>
  );
}
