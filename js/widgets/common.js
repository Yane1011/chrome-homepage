import { h } from '../util.js';

// A widget card. `actions` go in the header, to the right of the title.
export function card(id, title, body, { actions = [], className = '' } = {}) {
  return h('section', { class: `widget w-${id} ${className}`, dataset: { widget: id } },
    title ? h('header', { class: 'widget-head' }, h('h4', { class: 'widget-title' }, title), h('div', { class: 'widget-actions' }, actions)) : null,
    body,
  );
}

export function headBtn(label, title, onclick) {
  return h('button', { class: 'widget-btn', title, 'aria-label': title, onclick }, label);
}

export const pad = (n) => String(n).padStart(2, '0');

// Local calendar date as YYYY-MM-DD.
export function dateKey(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseDateKey(k) {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function daysBetween(a, b) {
  return Math.round((parseDateKey(dateKey(b)) - parseDateKey(dateKey(a))) / 864e5);
}

// GET a JSON URL, cached in localStorage for `ttl` ms. `cachedJson` is the synchronous half.
export function cachedJson(url, ttl) {
  try {
    const c = JSON.parse(localStorage.getItem('hp.cache.' + url) || 'null');
    if (c && Date.now() - c.ts < ttl) return c.data;
  } catch {}
  return null;
}

export async function fetchJson(url, ttl) {
  const hit = cachedJson(url, ttl);
  if (hit) return hit;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Request failed (${r.status})`);
  const data = await r.json();
  try {
    localStorage.setItem('hp.cache.' + url, JSON.stringify({ ts: Date.now(), data }));
  } catch {}
  return data;
}

// Render from cache immediately when possible, otherwise show "loading" and fill in later.
export function withData(body, url, ttl, draw, { loading = 'Loading…' } = {}) {
  const hit = cachedJson(url, ttl);
  if (hit) {
    draw(hit);
    return;
  }
  body.replaceChildren(h('p', { class: 'widget-msg' }, loading));
  fetchJson(url, ttl)
    .then(draw)
    .catch((e) => body.replaceChildren(h('p', { class: 'widget-msg' }, e.message || 'Unavailable')));
}

// Converts Open-Meteo local time ("2026-10-28T07:12") + utc offset to a real timestamp.
export function cityTime(str, offsetSec) {
  const [d, t = '00:00'] = str.split('T');
  const [y, m, day] = d.split('-').map(Number);
  const [hh, mm] = t.split(':').map(Number);
  return Date.UTC(y, m - 1, day, hh, mm) - offsetSec * 1000;
}

export function fmtTime(ts, tz, clock24) {
  return new Date(ts).toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit', hour12: !clock24, timeZone: tz });
}

const SVGNS = 'http://www.w3.org/2000/svg';
export function svg(tag, attrs = {}, ...children) {
  const el = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  for (const c of children) c && el.append(c);
  return el;
}

// Small line chart. `values` are numbers; `min`/`max` default to the data range.
export function sparkline(values, { width = 260, height = 44, min, max, fill = true, marker } = {}) {
  const vals = values.filter((v) => v != null);
  const lo = min ?? Math.min(...vals);
  const hi = max ?? Math.max(...vals);
  const span = hi - lo || 1;
  const n = Math.max(values.length - 1, 1);
  const pts = values.map((v, i) => [(i / n) * width, height - 3 - ((v - lo) / span) * (height - 6)]);
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const s = svg('svg', { class: 'spark', viewBox: `0 0 ${width} ${height}`, preserveAspectRatio: 'none', width: '100%', height });
  if (fill && pts.length) s.append(svg('path', { d: `${d} L${width},${height} L0,${height} Z`, class: 'spark-fill' }));
  s.append(svg('path', { d, class: 'spark-line' }));
  if (marker != null) {
    const x = (marker / n) * width;
    s.append(svg('line', { x1: x, x2: x, y1: 0, y2: height, class: 'spark-now' }));
  }
  return s;
}

export function meter(pct) {
  return h('div', { class: 'meter' }, h('span', { style: { width: Math.max(0, Math.min(100, pct)) + '%' } }));
}

export function openWidgetSettings() {
  document.dispatchEvent(new CustomEvent('open-settings', { detail: 'widgets' }));
}

export function needsCity(store, body, what) {
  if (store.settings.privacy) {
    body.replaceChildren(h('p', { class: 'widget-msg' }, `${what} is off while strict privacy mode is on.`));
    return true;
  }
  if (!store.state.weatherCity) {
    body.replaceChildren(
      h('p', { class: 'widget-msg' }, `Choose a city to see ${what.toLowerCase()}.`),
      h('button', { class: 'btn small', onclick: openWidgetSettings }, 'Choose city'),
    );
    return true;
  }
  return false;
}
