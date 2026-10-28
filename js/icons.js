import { store } from './store.js';
import { h, hostOf, initialsOf, colorFor } from './util.js';

const hasFaviconApi = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id;

export function faviconUrl(url, size = 64) {
  if (store.settings.privacy) {
    // Chrome's own favicon cache: no network request leaves the browser.
    if (!hasFaviconApi) return null;
    return `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(url)}&size=${size}`;
  }
  const host = hostOf(url);
  if (!host) return null;
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=${Math.max(64, size * 2)}`;
}

function initialsEl(sc) {
  const color = sc.icon?.color || colorFor(sc.title || sc.url);
  return h('span', { class: 'icon-initials', style: { background: color } }, initialsOf(sc.title || hostOf(sc.url)));
}

export function imageSrc(icon) {
  if (!icon) return null;
  if (icon.ref) return store.images[icon.ref] || null;
  return icon.src || null;
}

// The square artwork inside a tile.
export function iconEl(sc, size = 64) {
  const icon = sc.icon || { type: 'auto' };
  if (icon.type === 'initials') return initialsEl(sc);
  if (icon.type === 'image') {
    const src = imageSrc(icon);
    if (src) return h('img', { class: 'icon-img cover', src, alt: '', draggable: 'false' });
    return initialsEl(sc);
  }
  const src = faviconUrl(sc.url, size);
  if (!src) return initialsEl(sc);
  const img = h('img', { class: 'icon-img fav', src, alt: '', draggable: 'false', loading: 'lazy' });
  img.addEventListener('error', () => img.replaceWith(initialsEl(sc)));
  // Google returns a 16px globe for unknown sites; treat tiny results as "no icon".
  img.addEventListener('load', () => {
    if (img.naturalWidth && img.naturalWidth <= 16 && !store.settings.privacy) img.replaceWith(initialsEl(sc));
  });
  return img;
}
