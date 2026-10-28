export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// Tiny element builder: h('div', {class: 'x', onclick: fn}, 'text', child)
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children) {
    if (c == null || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export const uid = (prefix = '') =>
  prefix + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

export function debounce(fn, ms) {
  let t;
  const d = (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
  d.flush = (...args) => {
    clearTimeout(t);
    fn(...args);
  };
  return d;
}

export const clone = (o) => JSON.parse(JSON.stringify(o));

export function normalizeUrl(u) {
  u = (u || '').trim();
  if (!u) return '';
  if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) u = 'https://' + u;
  return u;
}

export function hostOf(u) {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return u || '';
  }
}

export function titleFromUrl(u) {
  const host = hostOf(u).split('.');
  const name = host.length > 1 ? host[host.length - 2] : host[0];
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : 'Shortcut';
}

export function initialsOf(title) {
  const words = (title || '?').trim().split(/\s+/).filter(Boolean);
  if (words.length > 1) return (words[0][0] + words[1][0]).toUpperCase();
  return [...(words[0] || '?')][0].toUpperCase();
}

export const ICON_COLORS = [
  '#4f7cff', '#7a5af8', '#d946ef', '#ef4444', '#f97316', '#eab308',
  '#22c55e', '#14b8a6', '#06b6d4', '#64748b', '#1f2937', '#ec4899',
];

export function colorFor(str) {
  let n = 0;
  for (const ch of str || '') n = (n * 31 + ch.charCodeAt(0)) >>> 0;
  return ICON_COLORS[n % ICON_COLORS.length];
}

// Reads an image file and returns a downscaled data URL.
export function fileToDataUrl(file, maxSize = 256, quality = 0.9) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        const isPng = file.type === 'image/png' || file.type === 'image/svg+xml';
        resolve(c.toDataURL(isPng && maxSize <= 512 ? 'image/png' : 'image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export function pickFile(accept) {
  return new Promise((resolve) => {
    const input = h('input', { type: 'file', accept, style: { display: 'none' } });
    input.addEventListener('change', () => {
      resolve(input.files[0] || null);
      input.remove();
    });
    document.body.append(input);
    input.click();
  });
}

export function download(filename, text) {
  const a = h('a', {
    href: URL.createObjectURL(new Blob([text], { type: 'application/json' })),
    download: filename,
  });
  document.body.append(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 1000);
}

let toastTimer;
export function toast(msg, action) {
  const el = $('#toast');
  el.replaceChildren(h('span', {}, msg));
  if (action) {
    el.append(
      h('button', { class: 'toast-action', onclick: () => { action.run(); el.classList.remove('show'); } }, action.label),
    );
  }
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), action ? 6000 : 2600);
}

export function formatBytes(n) {
  if (n < 1024) return n + ' B';
  return (n / 1024).toFixed(n < 10240 ? 1 : 0) + ' KB';
}

export function timeAgo(ts) {
  if (!ts) return 'never';
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const hr = Math.round(m / 60);
  if (hr < 24) return `${hr} h ago`;
  return new Date(ts).toLocaleString();
}
