// Weather (Open-Meteo, no key), tasks and quick notes.
import { store } from './store.js';
import { h, uid, debounce } from './util.js';

// ---- Weather ----
const WMO = {
  0: ['Clear', '☀️'], 1: ['Mostly clear', '🌤️'], 2: ['Partly cloudy', '⛅'], 3: ['Overcast', '☁️'],
  45: ['Fog', '🌫️'], 48: ['Freezing fog', '🌫️'],
  51: ['Light drizzle', '🌦️'], 53: ['Drizzle', '🌦️'], 55: ['Heavy drizzle', '🌧️'],
  56: ['Freezing drizzle', '🌧️'], 57: ['Freezing drizzle', '🌧️'],
  61: ['Light rain', '🌦️'], 63: ['Rain', '🌧️'], 65: ['Heavy rain', '🌧️'],
  66: ['Freezing rain', '🌧️'], 67: ['Freezing rain', '🌧️'],
  71: ['Light snow', '🌨️'], 73: ['Snow', '🌨️'], 75: ['Heavy snow', '❄️'], 77: ['Snow grains', '🌨️'],
  80: ['Showers', '🌦️'], 81: ['Showers', '🌧️'], 82: ['Violent showers', '⛈️'],
  85: ['Snow showers', '🌨️'], 86: ['Snow showers', '❄️'],
  95: ['Thunderstorm', '⛈️'], 96: ['Thunderstorm, hail', '⛈️'], 99: ['Thunderstorm, hail', '⛈️'],
};
const wmo = (c) => WMO[c] || ['—', '🌡️'];
const CACHE_MS = 30 * 60 * 1000;

export async function searchCities(name) {
  const r = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=6&language=en&format=json`,
  );
  if (!r.ok) throw new Error('City search failed');
  const j = await r.json();
  return (j.results || []).map((c) => ({
    name: c.name,
    region: [c.admin1, c.country].filter(Boolean).join(', '),
    lat: c.latitude,
    lon: c.longitude,
  }));
}

async function fetchForecast(city, unit) {
  const key = `hp.weather.${city.lat},${city.lon},${unit}`;
  try {
    const cached = JSON.parse(localStorage.getItem(key) || 'null');
    if (cached && Date.now() - cached.ts < CACHE_MS) return cached.data;
  } catch {}
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}` +
    `&current=temperature_2m,weather_code,apparent_temperature,wind_speed_10m` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min&forecast_days=5&timezone=auto` +
    (unit === 'f' ? '&temperature_unit=fahrenheit&wind_speed_unit=mph' : '');
  const r = await fetch(url);
  if (!r.ok) throw new Error('Weather unavailable');
  const data = await r.json();
  localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }));
  return data;
}

function weatherCard() {
  const body = h('div', { class: 'weather-body' });
  const card = h('section', { class: 'widget weather' }, body);
  const city = store.state.weatherCity;
  const s = store.settings;
  const openSettings = () => document.dispatchEvent(new CustomEvent('open-settings', { detail: 'widgets' }));
  if (s.privacy) {
    body.append(h('p', { class: 'widget-msg' }, 'Weather is off while strict privacy mode is on.'));
    return card;
  }
  if (!city) {
    body.append(
      h('p', { class: 'widget-msg' }, 'Choose a city to see the five-day forecast.'),
      h('button', { class: 'btn small', onclick: openSettings }, 'Choose city'),
    );
    return card;
  }
  body.append(h('p', { class: 'widget-msg' }, 'Loading weather…'));
  fetchForecast(city, s.weatherUnit)
    .then((d) => {
      const [desc, emoji] = wmo(d.current.weather_code);
      const deg = '°';
      const days = d.daily.time.map((t, i) => {
        const date = new Date(t + 'T12:00');
        return h('div', { class: 'day' },
          h('span', { class: 'day-name' }, i === 0 ? 'Today' : date.toLocaleDateString('en', { weekday: 'short' })),
          h('span', { class: 'day-emoji', title: wmo(d.daily.weather_code[i])[0] }, wmo(d.daily.weather_code[i])[1]),
          h('span', { class: 'day-temp' },
            h('b', {}, Math.round(d.daily.temperature_2m_max[i]) + deg),
            h('span', {}, Math.round(d.daily.temperature_2m_min[i]) + deg),
          ),
        );
      });
      body.replaceChildren(
        h('div', { class: 'weather-now' },
          h('div', { class: 'weather-emoji' }, emoji),
          h('div', {},
            h('div', { class: 'weather-temp' }, Math.round(d.current.temperature_2m) + deg + (s.weatherUnit === 'f' ? 'F' : 'C')),
            h('div', { class: 'weather-desc' }, desc),
          ),
          h('button', { class: 'weather-city', title: 'Change city', onclick: openSettings },
            h('b', {}, city.name),
            h('span', {}, `Feels ${Math.round(d.current.apparent_temperature)}${deg}`),
          ),
        ),
        h('div', { class: 'weather-days' }, days),
      );
    })
    .catch((e) => {
      body.replaceChildren(h('p', { class: 'widget-msg' }, `${city.name}: ${e.message || 'weather unavailable'}.`));
    });
  return card;
}

// ---- Tasks ----
function todoCard() {
  const list = h('ul', { class: 'todo-list' });
  const input = h('input', { class: 'widget-input', type: 'text', placeholder: 'Add a task…', maxlength: '300' });
  const footer = h('div', { class: 'todo-foot' });

  const draw = () => {
    const todos = store.state.todos;
    list.replaceChildren(
      ...todos.map((t) => {
        const cb = h('input', { type: 'checkbox', checked: !!t.done });
        cb.addEventListener('change', () => {
          store.update((st) => {
            const x = st.todos.find((y) => y.id === t.id);
            if (x) x.done = cb.checked;
          }, { render: false });
          draw();
        });
        const text = h('span', { class: 'todo-text', contenteditable: 'true', spellcheck: 'false' }, t.text);
        text.addEventListener('keydown', (e) => e.key === 'Enter' && (e.preventDefault(), text.blur()));
        text.addEventListener('blur', () => {
          const v = text.textContent.trim();
          store.update((st) => {
            const x = st.todos.find((y) => y.id === t.id);
            if (!x) return;
            if (v) x.text = v;
            else st.todos = st.todos.filter((y) => y.id !== t.id);
          }, { render: false });
          draw();
        });
        return h('li', { class: 'todo' + (t.done ? ' done' : '') },
          h('label', { class: 'check' }, cb, h('span', { class: 'checkmark' })),
          text,
          h('button', {
            class: 'todo-del',
            title: 'Delete',
            onclick: () => {
              store.update((st) => (st.todos = st.todos.filter((y) => y.id !== t.id)), { render: false });
              draw();
            },
          }, '✕'),
        );
      }),
    );
    const left = todos.filter((t) => !t.done).length;
    const done = todos.length - left;
    footer.replaceChildren(
      h('span', {}, todos.length ? `${left} left` : 'Nothing to do'),
      done
        ? h('button', {
            class: 'link-btn',
            onclick: () => {
              store.update((st) => (st.todos = st.todos.filter((y) => !y.done)), { render: false });
              draw();
            },
          }, `Clear ${done} done`)
        : null,
    );
  };
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || !input.value.trim()) return;
    const text = input.value.trim();
    input.value = '';
    store.update((st) => st.todos.push({ id: uid('t_'), text, done: false }), { render: false });
    draw();
  });
  draw();
  return h('section', { class: 'widget todo-widget' }, h('h4', { class: 'widget-title' }, 'Tasks'), input, list, footer);
}

// ---- Notes ----
function notesCard() {
  const ta = h('textarea', { class: 'notes-area', placeholder: 'Quick notes…', spellcheck: 'true' });
  ta.value = store.state.notes;
  const status = h('span', { class: 'notes-status' });
  const save = debounce(() => {
    store.update((st) => (st.notes = ta.value), { render: false });
    status.textContent = 'Saved';
    setTimeout(() => (status.textContent = ''), 1200);
  }, 500);
  ta.addEventListener('input', save);
  ta.addEventListener('blur', () => save.flush());
  return h('section', { class: 'widget notes-widget' },
    h('h4', { class: 'widget-title' }, 'Notes', status),
    ta,
  );
}

const BUILDERS = { weather: weatherCard, todo: todoCard, notes: notesCard };

// Which container each widget goes to per layout.
const PLACEMENT = {
  centered: { weather: 'wb', todo: 'wb', notes: 'wb' },
  right: { weather: 'wr', todo: 'wr', notes: 'wr' },
  left: { weather: 'wl', todo: 'wl', notes: 'wl' },
  split: { weather: 'wl', todo: 'wr', notes: 'wr' },
  top: { weather: 'wt', todo: 'wt', notes: 'wt' },
  dock: { weather: 'wr', todo: 'wr', notes: 'wr' },
  minimal: { weather: 'wr', todo: 'wr', notes: 'wr' },
};

matchMedia('(max-width: 1100px)').addEventListener('change', () => renderWidgets());

export function renderWidgets() {
  const s = store.settings;
  // Don't rebuild a widget the user is typing in.
  const focused = document.activeElement?.closest?.('.widget');
  const narrow = matchMedia('(max-width: 1100px)').matches && s.layout !== 'minimal' && s.layout !== 'top';
  const place = narrow ? PLACEMENT.centered : PLACEMENT[s.layout] || PLACEMENT.centered;
  const containers = { wl: [], wr: [], wt: [], wb: [] };
  for (const key of ['weather', 'todo', 'notes']) {
    if (!s[key]) continue;
    const existing = focused && focused.classList.contains(key === 'todo' ? 'todo-widget' : key === 'notes' ? 'notes-widget' : 'weather') ? focused : null;
    containers[place[key]].push(existing || BUILDERS[key]());
  }
  for (const [id, cards] of Object.entries(containers)) {
    const el = document.getElementById(id);
    el.replaceChildren(...cards);
    el.hidden = !cards.length;
  }
  document.body.classList.toggle('has-widgets', ['weather', 'todo', 'notes'].some((k) => s[k]));
}
