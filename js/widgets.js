// Widget registry and placement. Each widget builds a card; cards with `_tick` are ticked every second
// (or ten times a second when `_fast` is set, for the stopwatch).
import { store } from './store.js';
import { $$ } from './util.js';
import { WIDGET_DEFS } from './defaults.js';
import { weather, todo, notes } from './widgets/basic.js';
import { focus, countdown, habits, calendar } from './widgets/planning.js';
import { clocks, timer } from './widgets/time.js';
import { sun, tides } from './widgets/nature.js';
import { cpu, memory } from './widgets/system.js';

export { searchCities } from './widgets/basic.js';

const BUILDERS = { weather, todo, notes, focus, countdown, clocks, timer, habits, calendar, sun, tides, cpu, memory };

const NARROW = matchMedia('(max-width: 1100px)');

// Which container each widget goes to. Beside-grid uses each widget's own side.
function containerFor(w, layout) {
  if (NARROW.matches || layout === 'minimal') return 'wr';
  switch (layout) {
    case 'split': return w.side === 'left' ? 'wl' : 'wr';
    case 'left': return 'wl';
    case 'right':
    case 'dock': return 'wr';
    case 'top': return 'wt';
    default: return 'wb';
  }
}

export function enabledWidgets() {
  return (store.settings.widgets || []).filter((w) => w.on && BUILDERS[w.id]);
}

export function renderWidgets() {
  const s = store.settings;
  // Don't rebuild a widget the user is typing in.
  const focused = document.activeElement?.closest?.('.widget');
  const containers = { wl: [], wr: [], wt: [], wb: [] };
  for (const w of enabledWidgets()) {
    const keep = focused && focused.dataset.widget === w.id ? focused : null;
    containers[containerFor(w, s.layout)].push(keep || BUILDERS[w.id]());
  }
  for (const [id, cards] of Object.entries(containers)) {
    const el = document.getElementById(id);
    el.replaceChildren(...cards);
    el.hidden = !cards.length;
  }
  const any = enabledWidgets().length > 0;
  document.body.classList.toggle('has-widgets', any);
  document.body.classList.toggle('narrow', NARROW.matches);
  if (!any) document.body.classList.remove('drawer-open');
}

// Rebuild one widget in place (e.g. the calendar after a countdown changes).
export function refreshWidget(id) {
  const old = document.querySelector(`.widget[data-widget="${id}"]`);
  if (old && BUILDERS[id]) old.replaceWith(BUILDERS[id]());
}

NARROW.addEventListener('change', () => renderWidgets());

let fastCount = 0;
setInterval(() => {
  fastCount = (fastCount + 1) % 10;
  for (const el of $$('.widget')) {
    if (!el._tick) continue;
    if (el._fast || fastCount === 0) {
      try {
        el._tick();
      } catch (e) {
        console.warn('Widget tick failed', e);
      }
    }
  }
}, 100);

export { WIDGET_DEFS };
