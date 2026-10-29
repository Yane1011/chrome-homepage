// Sun and moon, tides. Both use the widget city (Settings › Widgets).
import { store } from '../store.js';
import { h } from '../util.js';
import { card, withData, needsCity, cityTime, fmtTime, svg, sparkline } from './common.js';

// ---- Moon phase (computed locally) ----
const SYNODIC = 29.530588853;
const NEW_MOON_REF = Date.UTC(2000, 0, 6, 18, 14) / 864e5;
const PHASES = [
  [0.0339, 'New moon', '🌑'], [0.216, 'Waxing crescent', '🌒'], [0.284, 'First quarter', '🌓'],
  [0.466, 'Waxing gibbous', '🌔'], [0.534, 'Full moon', '🌕'], [0.716, 'Waning gibbous', '🌖'],
  [0.784, 'Last quarter', '🌗'], [0.966, 'Waning crescent', '🌘'], [1.01, 'New moon', '🌑'],
];

export function moonPhase(date = new Date()) {
  const age = (((date.getTime() / 864e5 - NEW_MOON_REF) % SYNODIC) + SYNODIC) % SYNODIC;
  const phase = age / SYNODIC;
  const [, name, emoji] = PHASES.find(([lim]) => phase < lim);
  const illum = (1 - Math.cos(2 * Math.PI * phase)) / 2;
  const toFull = (phase < 0.5 ? 0.5 - phase : 1.5 - phase) * SYNODIC;
  const toNew = (1 - phase) * SYNODIC;
  return { phase, name, emoji, illum, toFull, toNew };
}

function dur(sec) {
  const hh = Math.floor(sec / 3600);
  const mm = Math.round((sec % 3600) / 60);
  return `${hh}h ${mm}m`;
}

export function sun() {
  const body = h('div', { class: 'sun-body' });
  const el = card('sun', 'Sun and moon', body);
  const moon = moonPhase();
  const moonRow = h('div', { class: 'moon' },
    h('span', { class: 'moon-emoji' }, moon.emoji),
    h('div', {},
      h('b', {}, moon.name),
      h('span', {}, `${Math.round(moon.illum * 100)}% lit · ${moon.name === 'Full moon' ? `new moon in ${Math.round(moon.toNew)} days` : `full moon in ${Math.round(moon.toFull)} day${Math.round(moon.toFull) === 1 ? '' : 's'}`}`),
    ),
  );
  if (needsCity(store, body, 'Sun times')) {
    body.append(moonRow);
    return el;
  }
  const city = store.state.weatherCity;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&daily=sunrise,sunset,daylight_duration&forecast_days=2&timezone=auto`;
  let data = null;
  const arc = h('div', { class: 'sun-arc' });
  const drawArc = () => {
    if (!data) return;
    const off = data.utc_offset_seconds;
    const rise = cityTime(data.daily.sunrise[0], off);
    const set = cityTime(data.daily.sunset[0], off);
    const now = Date.now();
    const p = Math.max(0, Math.min(1, (now - rise) / (set - rise)));
    const up = now >= rise && now <= set;
    // The arc sits on the horizon line and stays inside the SVG, so the sun never covers the labels.
    const W = 240, H = 92, r = 76;
    const cx = W / 2, cy = H - 10;
    const ang = Math.PI * (1 - p);
    const sx = cx + Math.cos(ang) * r;
    const sy = cy - Math.sin(ang) * r;
    arc.replaceChildren(
      svg('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', height: H, preserveAspectRatio: 'xMidYMid meet' },
        svg('path', { d: `M${cx - r},${cy} A${r},${r} 0 0 1 ${cx + r},${cy}`, class: 'sun-path' }),
        svg('line', { x1: 0, x2: W, y1: cy, y2: cy, class: 'sun-horizon' }),
        up ? svg('circle', { cx: sx, cy: sy, r: 7, class: 'sun-dot' }) : null,
      ),
    );
  };
  withData(body, url, 6 * 3600e3, (d) => {
    data = d;
    const off = d.utc_offset_seconds;
    const tz = d.timezone;
    const c24 = store.settings.clock24;
    const rise = cityTime(d.daily.sunrise[0], off);
    const set = cityTime(d.daily.sunset[0], off);
    const tomorrow = d.daily.daylight_duration[1] - d.daily.daylight_duration[0];
    drawArc();
    body.replaceChildren(
      arc,
      h('div', { class: 'sun-times' },
        h('div', {}, h('span', {}, '↑ Sunrise'), h('b', {}, fmtTime(rise, tz, c24))),
        h('div', {}, h('span', {}, 'Daylight'), h('b', {}, dur(d.daily.daylight_duration[0]))),
        h('div', {}, h('span', {}, '↓ Sunset'), h('b', {}, fmtTime(set, tz, c24))),
      ),
      h('p', { class: 'widget-sub' }, `${city.name} · tomorrow ${Math.abs(Math.round(tomorrow / 60))} min ${tomorrow >= 0 ? 'longer' : 'shorter'}`),
      moonRow,
    );
  }, { loading: 'Loading sun times…' });
  let last = -1;
  el._tick = () => {
    const m = new Date().getMinutes();
    if (m !== last) {
      last = m;
      drawArc();
    }
  };
  return el;
}

// ---- Tides (Open-Meteo Marine) ----
function extremes(times, heights, off) {
  const out = [];
  for (let i = 1; i < heights.length - 1; i++) {
    const a = heights[i - 1], b = heights[i], c = heights[i + 1];
    if (a == null || b == null || c == null) continue;
    const isHigh = b >= a && b > c;
    const isLow = b <= a && b < c;
    if (!isHigh && !isLow) continue;
    // Parabolic fit through the three hourly points for a better time and height.
    const denom = a - 2 * b + c;
    const shift = denom ? (a - c) / (2 * denom) : 0;
    const hgt = b - ((a - c) * shift) / 4;
    out.push({ ts: cityTime(times[i], off) + shift * 36e5, h: hgt, high: isHigh });
  }
  return out;
}

export function tides() {
  const body = h('div', { class: 'tide-body' });
  const el = card('tides', 'Tides', body);
  if (needsCity(store, body, 'Tides')) return el;
  const city = store.state.weatherCity;
  const url = `https://marine-api.open-meteo.com/v1/marine?latitude=${city.lat}&longitude=${city.lon}&hourly=sea_level_height_msl&timezone=auto&forecast_days=3`;
  withData(body, url, 3 * 3600e3, (d) => {
    const hs = d.hourly?.sea_level_height_msl || [];
    if (!hs.some((v) => v != null)) {
      body.replaceChildren(h('p', { class: 'widget-msg' }, `No tide data for ${city.name}. Tides need a coastal city.`));
      return;
    }
    const off = d.utc_offset_seconds;
    const tz = d.timezone;
    const c24 = store.settings.clock24;
    const now = Date.now();
    const times = d.hourly.time;
    const ex = extremes(times, hs, off).filter((e) => e.ts > now - 36e5).slice(0, 4);
    const idx = times.findIndex((t) => cityTime(t, off) > now);
    const nowIdx = Math.max(0, idx - 1);
    const from = Math.max(0, nowIdx - 3);
    const window = hs.slice(from, from + 27);
    const rising = hs[nowIdx + 1] != null && hs[nowIdx + 1] > hs[nowIdx];
    const unit = (v) => `${v >= 0 ? '' : '−'}${Math.abs(v).toFixed(1)} m`;
    body.replaceChildren(
      h('div', { class: 'tide-now' },
        h('span', { class: 'tide-arrow' }, rising ? '↗' : '↘'),
        h('div', {}, h('b', {}, rising ? 'Rising' : 'Falling'), h('span', {}, `${unit(hs[nowIdx] ?? 0)} now · ${city.name}`)),
      ),
      sparkline(window, { marker: nowIdx - from, height: 50 }),
      h('div', { class: 'tide-list' },
        ex.map((e) =>
          h('div', { class: 'tide ' + (e.high ? 'high' : 'low') },
            h('span', {}, e.high ? 'High' : 'Low'),
            h('b', {}, fmtTime(e.ts, tz, c24)),
            h('span', {}, unit(e.h)),
          ),
        ),
      ),
      h('p', { class: 'widget-sub' }, 'Model estimate, not for navigation.'),
    );
  }, { loading: 'Loading tides…' });
  return el;
}
