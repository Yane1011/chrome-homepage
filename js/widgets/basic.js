// Weather, to do and notes.
import { store } from '../store.js';
import { h, uid, debounce } from '../util.js';
import { card, withData, needsCity, openWidgetSettings } from './common.js';

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

export function weather() {
  const body = h('div', { class: 'weather-body' });
  const el = card('weather', null, body);
  if (needsCity(store, body, 'Weather')) return el;
  const city = store.state.weatherCity;
  const unit = store.settings.weatherUnit;
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}` +
    `&current=temperature_2m,weather_code,apparent_temperature` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min&forecast_days=5&timezone=auto` +
    (unit === 'f' ? '&temperature_unit=fahrenheit' : '');
  withData(body, url, 30 * 60 * 1000, (d) => {
    const [desc, emoji] = wmo(d.current.weather_code);
    const deg = '°';
    body.replaceChildren(
      h('div', { class: 'weather-now' },
        h('div', { class: 'weather-emoji' }, emoji),
        h('div', {},
          h('div', { class: 'weather-temp' }, Math.round(d.current.temperature_2m) + deg + unit.toUpperCase()),
          h('div', { class: 'weather-desc' }, desc),
        ),
        h('button', { class: 'weather-city', title: 'Change city', onclick: openWidgetSettings },
          h('b', {}, city.name),
          h('span', {}, `Feels ${Math.round(d.current.apparent_temperature)}${deg}`),
        ),
      ),
      h('div', { class: 'weather-days' },
        d.daily.time.map((t, i) =>
          h('div', { class: 'day' },
            h('span', { class: 'day-name' }, i === 0 ? 'Today' : new Date(t + 'T12:00').toLocaleDateString('en', { weekday: 'short' })),
            h('span', { class: 'day-emoji', title: wmo(d.daily.weather_code[i])[0] }, wmo(d.daily.weather_code[i])[1]),
            h('span', { class: 'day-temp' },
              h('b', {}, Math.round(d.daily.temperature_2m_max[i]) + deg),
              h('span', {}, Math.round(d.daily.temperature_2m_min[i]) + deg),
            ),
          ),
        ),
      ),
    );
  }, { loading: 'Loading weather…' });
  return el;
}

export function todo() {
  const list = h('ul', { class: 'todo-list' });
  const input = h('input', { class: 'widget-input', type: 'text', placeholder: 'Add a task…', maxlength: '300' });
  const footer = h('div', { class: 'todo-foot' });
  const save = (fn) => {
    store.update(fn, { render: false });
    draw();
  };

  function draw() {
    const todos = store.state.todos;
    list.replaceChildren(
      ...todos.map((t) => {
        const cb = h('input', { type: 'checkbox', checked: !!t.done });
        cb.addEventListener('change', () => save((st) => {
          const x = st.todos.find((y) => y.id === t.id);
          if (x) x.done = cb.checked;
        }));
        const text = h('span', { class: 'todo-text', contenteditable: 'true', spellcheck: 'false' }, t.text);
        text.addEventListener('keydown', (e) => e.key === 'Enter' && (e.preventDefault(), text.blur()));
        text.addEventListener('blur', () => {
          const v = text.textContent.trim();
          save((st) => {
            const x = st.todos.find((y) => y.id === t.id);
            if (!x) return;
            if (v) x.text = v;
            else st.todos = st.todos.filter((y) => y.id !== t.id);
          });
        });
        return h('li', { class: 'todo' + (t.done ? ' done' : '') },
          h('label', { class: 'check' }, cb, h('span', { class: 'checkmark' })),
          text,
          h('button', { class: 'row-del', title: 'Delete', onclick: () => save((st) => (st.todos = st.todos.filter((y) => y.id !== t.id))) }, '✕'),
        );
      }),
    );
    const left = todos.filter((t) => !t.done).length;
    const done = todos.length - left;
    footer.replaceChildren(h('span', {}, todos.length ? `${left} left` : 'Nothing to do'));
    if (done) footer.append(h('button', { class: 'link-btn', onclick: () => save((st) => (st.todos = st.todos.filter((y) => !y.done))) }, `Clear ${done} done`));
  }
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || !input.value.trim()) return;
    const text = input.value.trim();
    input.value = '';
    save((st) => st.todos.push({ id: uid('t_'), text, done: false }));
  });
  draw();
  return card('todo', 'To do', [input, list, footer]);
}

export function notes() {
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
  return card('notes', 'Notes', ta, { actions: [status] });
}
