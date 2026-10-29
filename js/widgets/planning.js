// Today's focus, countdown, habits and calendar.
import { store } from '../store.js';
import { h, uid } from '../util.js';
import { card, headBtn, dateKey, parseDateKey, addDays, daysBetween } from './common.js';
import { refreshWidget } from '../widgets.js';

const save = (fn) => store.update(fn, { render: false });

// ---- Today's focus ----
export function focus() {
  const body = h('div', { class: 'focus-body' });
  const el = card('focus', 'Today’s focus', body);
  const draw = () => {
    const f = store.state.focus;
    const today = dateKey();
    if (f && f.date === today && f.text) {
      const cb = h('input', { type: 'checkbox', checked: !!f.done });
      cb.addEventListener('change', () => {
        save((st) => (st.focus.done = cb.checked));
        draw();
        if (cb.checked) el.animate([{ transform: 'scale(1.03)' }, { transform: 'scale(1)' }], { duration: 300 });
      });
      body.replaceChildren(
        h('div', { class: 'focus-item' + (f.done ? ' done' : '') },
          h('label', { class: 'check big' }, cb, h('span', { class: 'checkmark' })),
          h('span', { class: 'focus-text' }, f.text),
        ),
        h('div', { class: 'todo-foot' },
          h('span', {}, f.done ? 'Done. Nice work! 🎉' : 'You’ve got this.'),
          h('button', { class: 'link-btn', onclick: () => { save((st) => (st.focus = null)); draw(); setTimeout(() => body.querySelector('input')?.focus()); } }, 'Change'),
        ),
      );
    } else {
      const input = h('input', { class: 'widget-input focus-input', type: 'text', placeholder: 'What’s your main focus today?', maxlength: '140' });
      input.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' || !input.value.trim()) return;
        save((st) => (st.focus = { text: input.value.trim(), date: today, done: false }));
        draw();
      });
      body.replaceChildren(input);
    }
  };
  draw();
  // Roll over at midnight.
  let day = dateKey();
  el._tick = () => {
    if (dateKey() !== day) {
      day = dateKey();
      draw();
    }
  };
  return el;
}

// ---- Countdown ----
function countdownLabel(c) {
  const now = new Date();
  const target = c.time ? new Date(`${c.date}T${c.time}`) : parseDateKey(c.date);
  const days = daysBetween(now, target);
  if (c.time && Math.abs(target - now) < 864e5 * 2) {
    const diff = target - now;
    const hrs = Math.floor(Math.abs(diff) / 36e5);
    const mins = Math.floor((Math.abs(diff) % 36e5) / 6e4);
    if (diff > 0) return [hrs ? `${hrs}h ${mins}m` : `${mins}m`, 'to go'];
    if (diff > -36e5) return ['Now', ''];
  }
  if (days === 0) return ['Today', ''];
  if (days === 1) return ['1', 'day left'];
  if (days > 0) return [String(days), 'days left'];
  return [String(-days), -days === 1 ? 'day ago' : 'days ago'];
}

export function countdown() {
  const list = h('div', { class: 'cd-list' });
  const form = h('div', { class: 'cd-form', hidden: true });
  const name = h('input', { class: 'widget-input', type: 'text', placeholder: 'Event name', maxlength: '80' });
  const date = h('input', { class: 'widget-input', type: 'date', value: dateKey(addDays(new Date(), 7)) });
  const time = h('input', { class: 'widget-input', type: 'time', title: 'Time (optional)' });
  const add = () => {
    if (!name.value.trim() || !date.value) return name.focus();
    save((st) => st.countdowns.push({ id: uid('cd_'), name: name.value.trim(), date: date.value, time: time.value || '' }));
    name.value = '';
    time.value = '';
    form.hidden = true;
    draw();
    refreshWidget('calendar');
  };
  name.addEventListener('keydown', (e) => e.key === 'Enter' && add());
  form.append(name, h('div', { class: 'row-inline' }, date, time), h('div', { class: 'row-inline end' },
    h('button', { class: 'btn small', onclick: () => (form.hidden = true) }, 'Cancel'),
    h('button', { class: 'btn small primary', onclick: add }, 'Add'),
  ));
  const draw = () => {
    const items = [...store.state.countdowns].sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
    const upcoming = items.filter((c) => daysBetween(new Date(), parseDateKey(c.date)) >= 0);
    const past = items.filter((c) => !upcoming.includes(c));
    list.replaceChildren(
      ...(items.length ? [...upcoming, ...past.reverse()] : []).map((c) => {
        const [big, small] = countdownLabel(c);
        const when = parseDateKey(c.date).toLocaleDateString('en', { weekday: 'short', day: 'numeric', month: 'short', year: parseDateKey(c.date).getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
        return h('div', { class: 'cd' + (past.includes(c) ? ' past' : '') },
          h('div', { class: 'cd-num' }, h('b', {}, big), h('span', {}, small)),
          h('div', { class: 'cd-info' }, h('span', { class: 'cd-name' }, c.name), h('span', { class: 'cd-date' }, when + (c.time ? ` · ${c.time}` : ''))),
          h('button', {
            class: 'row-del', title: 'Delete',
            onclick: () => { save((st) => (st.countdowns = st.countdowns.filter((x) => x.id !== c.id))); draw(); refreshWidget('calendar'); },
          }, '✕'),
        );
      }),
    );
    if (!items.length && form.hidden) list.append(h('p', { class: 'widget-msg' }, 'Add a birthday, trip or deadline.'));
  };
  draw();
  const el = card('countdown', 'Countdown', [list, form], {
    actions: [headBtn('+', 'Add a date', () => { form.hidden = !form.hidden; draw(); if (!form.hidden) name.focus(); })],
  });
  let last = '';
  el._tick = () => {
    const sig = new Date().getMinutes();
    if (sig !== last) {
      last = sig;
      draw();
    }
  };
  return el;
}

// ---- Habits ----
const HABIT_DAYS = 7;

function streak(days) {
  const set = new Set(days);
  let n = 0;
  let d = new Date();
  // Today not done yet doesn't break the streak.
  if (!set.has(dateKey(d))) d = addDays(d, -1);
  while (set.has(dateKey(d))) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

export function habits() {
  const list = h('div', { class: 'habit-list' });
  const input = h('input', { class: 'widget-input', type: 'text', placeholder: 'Add a habit…', maxlength: '60' });
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || !input.value.trim()) return;
    const name = input.value.trim();
    input.value = '';
    save((st) => st.habits.push({ id: uid('h_'), name, days: [] }));
    draw();
  });
  const toggle = (id, key) => {
    save((st) => {
      const hb = st.habits.find((x) => x.id === id);
      if (!hb) return;
      hb.days = hb.days.includes(key) ? hb.days.filter((d) => d !== key) : [...hb.days, key];
      // Keep sync data small: only the last 90 days.
      const cutoff = dateKey(addDays(new Date(), -90));
      hb.days = hb.days.filter((d) => d >= cutoff).sort();
    });
    draw();
  };
  const draw = () => {
    const today = new Date();
    const dates = Array.from({ length: HABIT_DAYS }, (_, i) => addDays(today, i - HABIT_DAYS + 1));
    list.replaceChildren(
      ...(store.state.habits.length ? [] : [h('p', { class: 'widget-msg' }, 'Add something you want to do every day.')]),
      ...store.state.habits.map((hb) => {
        const s = streak(hb.days);
        return h('div', { class: 'habit' },
          h('span', { class: 'habit-name', title: hb.name }, hb.name),
          h('span', { class: 'habit-streak', title: `${s}-day streak` }, s ? `🔥 ${s}` : ''),
          h('button', { class: 'row-del', title: 'Delete habit', onclick: () => { save((st) => (st.habits = st.habits.filter((x) => x.id !== hb.id))); draw(); } }, '✕'),
          h('div', { class: 'habit-days' },
            dates.map((d, i) => {
              const key = dateKey(d);
              const on = hb.days.includes(key);
              return h('button', {
                class: 'habit-dot' + (on ? ' on' : '') + (i === HABIT_DAYS - 1 ? ' today' : ''),
                title: `${d.toLocaleDateString('en', { weekday: 'long', day: 'numeric', month: 'short' })}${on ? ' · done' : ''}`,
                onclick: () => toggle(hb.id, key),
              }, d.toLocaleDateString('en', { weekday: 'narrow' }));
            }),
          ),
        );
      }),
    );
  };
  draw();
  let day = dateKey();
  const el = card('habits', 'Habits', [list, input]);
  el._tick = () => {
    if (dateKey() !== day) {
      day = dateKey();
      draw();
    }
  };
  return el;
}

// ---- Calendar ----
let monthOffset = 0;

export function calendar() {
  const grid = h('div', { class: 'cal-grid' });
  const title = h('span', { class: 'cal-title' });
  const draw = () => {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    const monStart = store.settings.weekStart === 'mon';
    const lead = (first.getDay() - (monStart ? 1 : 0) + 7) % 7;
    const start = addDays(first, -lead);
    const todayKey = dateKey(now);
    const events = new Map();
    for (const c of store.state.countdowns) events.set(c.date, [...(events.get(c.date) || []), c.name]);
    title.textContent = first.toLocaleDateString('en', { month: 'long', year: 'numeric' });
    const names = Array.from({ length: 7 }, (_, i) => addDays(start, i).toLocaleDateString('en', { weekday: 'narrow' }));
    const cells = Array.from({ length: 42 }, (_, i) => {
      const d = addDays(start, i);
      const k = dateKey(d);
      const ev = events.get(k);
      return h('span', {
        class: 'cal-day' + (d.getMonth() !== first.getMonth() ? ' other' : '') + (k === todayKey ? ' today' : '') + (ev ? ' event' : '') + (d.getDay() === 0 || d.getDay() === 6 ? ' weekend' : ''),
        title: ev ? ev.join(', ') : d.toLocaleDateString('en', { weekday: 'long', day: 'numeric', month: 'long' }),
      }, d.getDate());
    });
    // Drop a trailing week that is entirely next month.
    const rows = cells.slice(35).every((c) => c.classList.contains('other')) ? cells.slice(0, 35) : cells;
    grid.replaceChildren(...names.map((n) => h('span', { class: 'cal-dow' }, n)), ...rows);
  };
  const go = (n) => {
    monthOffset = n === 0 ? 0 : monthOffset + n;
    draw();
  };
  draw();
  const el = card('calendar', null, [
    h('header', { class: 'widget-head' },
      title,
      h('div', { class: 'widget-actions' },
        headBtn('‹', 'Previous month', () => go(-1)),
        headBtn('•', 'This month', () => go(0)),
        headBtn('›', 'Next month', () => go(1)),
      ),
    ),
    grid,
  ]);
  let day = dateKey();
  el._tick = () => {
    if (dateKey() !== day) {
      day = dateKey();
      draw();
    }
  };
  return el;
}
