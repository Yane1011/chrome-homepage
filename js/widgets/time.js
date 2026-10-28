// World clocks and timer/stopwatch.
import { store } from '../store.js';
import { h, uid, toast } from '../util.js';
import { card, headBtn, pad } from './common.js';

// ---- World clocks ----
let zones = null;
function allZones() {
  if (!zones) {
    try {
      zones = Intl.supportedValuesOf('timeZone');
    } catch {
      zones = ['UTC', 'Europe/London', 'Europe/Paris', 'America/New_York', 'America/Los_Angeles', 'Asia/Tokyo', 'Australia/Sydney'];
    }
  }
  return zones;
}
const zoneLabel = (tz) => tz.split('/').pop().replace(/_/g, ' ');

function offsetMinutes(tz, date = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  return Math.round((asUtc - Math.floor(date.getTime() / 6e4) * 6e4) / 6e4);
}

export function clocks() {
  const list = h('div', { class: 'wc-list' });
  const form = h('div', { class: 'cd-form', hidden: true });
  const listId = uid('tz_');
  const input = h('input', { class: 'widget-input', type: 'text', placeholder: 'City or time zone, e.g. Paris', list: listId, spellcheck: 'false' });
  const datalist = h('datalist', { id: listId }, allZones().map((z) => h('option', { value: z }, zoneLabel(z))));
  const add = () => {
    const q = input.value.trim().toLowerCase().replace(/ /g, '_');
    if (!q) return;
    const tz = allZones().find((z) => z.toLowerCase() === q) || allZones().find((z) => z.toLowerCase().endsWith('/' + q)) || allZones().find((z) => z.toLowerCase().includes(q));
    if (!tz) return toast('Time zone not found');
    store.update((st) => st.clocks.push({ id: uid('c_'), tz, label: zoneLabel(tz) }), { render: false });
    input.value = '';
    form.hidden = true;
    draw();
  };
  input.addEventListener('keydown', (e) => e.key === 'Enter' && add());
  form.append(input, datalist, h('div', { class: 'row-inline end' },
    h('button', { class: 'btn small', onclick: () => (form.hidden = true) }, 'Cancel'),
    h('button', { class: 'btn small primary', onclick: add }, 'Add'),
  ));
  const draw = () => {
    const now = new Date();
    const here = -now.getTimezoneOffset();
    const c24 = store.settings.clock24;
    list.replaceChildren(
      ...store.state.clocks.map((c) => {
        let time;
        let off = 0;
        try {
          time = now.toLocaleTimeString('en', { timeZone: c.tz, hour: 'numeric', minute: '2-digit', hour12: !c24 });
          off = offsetMinutes(c.tz, now) - here;
        } catch {
          time = '—';
        }
        const local = new Date(now.getTime() + off * 6e4);
        const dayDiff = Math.round((new Date(local.getFullYear(), local.getMonth(), local.getDate()) - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 864e5);
        const hrs = off / 60;
        const rel = off === 0 ? 'Same time' : `${hrs > 0 ? '+' : '−'}${Math.abs(hrs) % 1 ? Math.abs(hrs).toFixed(1) : Math.abs(hrs)}h`;
        const hourThere = local.getHours();
        const night = hourThere < 6 || hourThere >= 21;
        return h('div', { class: 'wc' },
          h('div', { class: 'wc-info' },
            h('span', { class: 'wc-name' }, c.label),
            h('span', { class: 'wc-rel' }, [dayDiff === 1 ? 'Tomorrow' : dayDiff === -1 ? 'Yesterday' : 'Today', rel].join(' · ')),
          ),
          h('span', { class: 'wc-time', title: c.tz }, night ? '🌙 ' : '', time),
          h('button', { class: 'row-del', title: 'Remove', onclick: () => { store.update((st) => (st.clocks = st.clocks.filter((x) => x.id !== c.id)), { render: false }); draw(); } }, '✕'),
        );
      }),
    );
    if (!store.state.clocks.length) list.append(h('p', { class: 'widget-msg' }, 'Add a city to see its time.'));
  };
  draw();
  const el = card('clocks', 'World clocks', [list, form], {
    actions: [headBtn('+', 'Add a clock', () => { form.hidden = !form.hidden; if (!form.hidden) input.focus(); })],
  });
  let last = -1;
  el._tick = () => {
    const m = new Date().getMinutes();
    if (m !== last) {
      last = m;
      draw();
    }
  };
  return el;
}

// ---- Timer & stopwatch (kept on this computer, shared by all open tabs) ----
const TKEY = 'hp.timer';
const defaultTimer = () => ({ mode: 'timer', duration: 25 * 60e3, end: 0, left: 25 * 60e3, running: false, swStart: 0, swElapsed: 0 });
function readTimer() {
  try {
    return { ...defaultTimer(), ...JSON.parse(localStorage.getItem(TKEY) || '{}') };
  } catch {
    return defaultTimer();
  }
}
const writeTimer = (t) => localStorage.setItem(TKEY, JSON.stringify(t));

function fmt(ms, tenths = false) {
  const neg = ms < 0;
  ms = Math.abs(ms);
  const total = Math.floor(ms / 1000);
  const hh = Math.floor(total / 3600);
  const mm = Math.floor((total % 3600) / 60);
  const ss = total % 60;
  const base = hh ? `${hh}:${pad(mm)}:${pad(ss)}` : `${pad(mm)}:${pad(ss)}`;
  return (neg ? '−' : '') + base + (tenths ? '.' + Math.floor((ms % 1000) / 100) : '');
}

let audioCtx;
function chime() {
  if (!store.settings.timerSound) return;
  try {
    audioCtx = audioCtx || new AudioContext();
    const t0 = audioCtx.currentTime;
    [0, 0.35, 0.7].forEach((dt, i) => {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = 'sine';
      o.frequency.value = i === 2 ? 1046.5 : 784;
      g.gain.setValueAtTime(0.0001, t0 + dt);
      g.gain.exponentialRampToValueAtTime(0.25, t0 + dt + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + 0.3);
      o.connect(g).connect(audioCtx.destination);
      o.start(t0 + dt);
      o.stop(t0 + dt + 0.32);
    });
  } catch {}
}

export function timer() {
  const display = h('div', { class: 'timer-display' });
  const ring = h('div', { class: 'timer-ring' }, display);
  const controls = h('div', { class: 'timer-controls' });
  const presets = h('div', { class: 'timer-presets' });
  const modeSeg = h('div', { class: 'segmented tiny' });

  let lastSig = '';
  const draw = () => {
    const t = readTimer();
    const now = Date.now();
    // Rebuild buttons only when their state changes, so clicks never land on a node being replaced.
    const sig = JSON.stringify([t.mode, t.running, t.duration, t.left > 0, t.left < t.duration, t.swElapsed > 0]);
    const rebuild = sig !== lastSig;
    lastSig = sig;
    if (!rebuild) {
      if (t.mode === 'timer') {
        const left = t.running ? t.end - now : t.left;
        display.textContent = fmt(Math.max(0, left));
        ring.style.setProperty('--p', String(t.duration ? Math.max(0, Math.min(1, left / t.duration)) : 0));
      } else {
        const elapsed = t.swElapsed + (t.running && t.swStart ? now - t.swStart : 0);
        display.textContent = fmt(elapsed, true);
        ring.style.setProperty('--p', String((elapsed % 60e3) / 60e3));
      }
      return;
    }
    modeSeg.replaceChildren(
      ...[['timer', 'Timer'], ['stopwatch', 'Stopwatch']].map(([m, label]) =>
        h('button', { class: t.mode === m ? 'active' : '', onclick: () => { writeTimer({ ...t, mode: m }); draw(); } }, label),
      ),
    );
    if (t.mode === 'timer') {
      const left = t.running ? t.end - now : t.left;
      display.textContent = fmt(Math.max(0, left));
      const pct = t.duration ? Math.max(0, Math.min(1, left / t.duration)) : 0;
      ring.style.setProperty('--p', String(pct));
      ring.classList.toggle('done', left <= 0 && t.left <= 0);
      controls.replaceChildren(
        h('button', { class: 'btn small', onclick: () => { writeTimer({ ...t, running: false, left: t.duration, end: 0 }); draw(); } }, 'Reset'),
        h('button', {
          class: 'btn small primary',
          onclick: () => {
            if (t.running) writeTimer({ ...t, running: false, left: Math.max(0, t.end - Date.now()) });
            else {
              const leftMs = t.left > 0 ? t.left : t.duration;
              writeTimer({ ...t, running: true, end: Date.now() + leftMs, left: leftMs });
            }
            draw();
          },
        }, t.running ? 'Pause' : t.left > 0 && t.left < t.duration ? 'Resume' : 'Start'),
      );
      presets.hidden = false;
      presets.replaceChildren(
        ...[1, 5, 10, 15, 25, 45, 60].map((m) =>
          h('button', {
            class: 'chip' + (t.duration === m * 60e3 ? ' active' : ''),
            onclick: () => { writeTimer({ ...t, duration: m * 60e3, left: m * 60e3, running: false, end: 0 }); draw(); },
          }, m === 60 ? '1h' : `${m}m`),
        ),
        h('button', {
          class: 'chip', title: 'Add a minute',
          onclick: () => {
            const add = 60e3;
            writeTimer(t.running ? { ...t, end: t.end + add, duration: t.duration + add } : { ...t, left: t.left + add, duration: Math.max(t.duration, t.left + add) });
            draw();
          },
        }, '+1'),
      );
    } else {
      const elapsed = t.swElapsed + (t.running && t.swStart ? now - t.swStart : 0);
      display.textContent = fmt(elapsed, true);
      ring.style.setProperty('--p', String((elapsed % 60e3) / 60e3));
      ring.classList.remove('done');
      controls.replaceChildren(
        h('button', { class: 'btn small', onclick: () => { writeTimer({ ...t, running: false, swStart: 0, swElapsed: 0 }); draw(); } }, 'Reset'),
        h('button', {
          class: 'btn small primary',
          onclick: () => {
            if (t.running) writeTimer({ ...t, running: false, swElapsed: t.swElapsed + (Date.now() - t.swStart), swStart: 0 });
            else writeTimer({ ...t, running: true, swStart: Date.now() });
            draw();
          },
        }, t.running ? 'Pause' : elapsed ? 'Resume' : 'Start'),
      );
      presets.hidden = true;
    }
  };

  const check = () => {
    const t = readTimer();
    if (t.mode === 'timer' && t.running && t.end <= Date.now()) {
      // Only one tab announces the end.
      if (localStorage.getItem('hp.timer.done') !== String(t.end)) {
        localStorage.setItem('hp.timer.done', String(t.end));
        chime();
        toast('⏰ Time’s up!');
      }
      writeTimer({ ...t, running: false, left: 0 });
    }
  };

  draw();
  const el = card('timer', 'Timer', [h('div', { class: 'timer-top' }, modeSeg), ring, presets, controls]);
  el._fast = true;
  el._tick = () => {
    check();
    draw();
  };
  window.addEventListener('storage', (e) => e.key === TKEY && el.isConnected && draw());
  return el;
}
