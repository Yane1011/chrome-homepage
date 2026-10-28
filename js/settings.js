// Settings panel: General, Interface, Search, Background, Widgets, Desks, Data, Account,
// with a search box that finds any option across all sections.
import { store } from './store.js';
import { h, $, $$, uid, toast, download, pickFile, fileToDataUrl, formatBytes, timeAgo, debounce } from './util.js';
import { GRADIENTS, ANIMATED, TOPOS, ENGINES, LAYOUTS, WIDGET_DEFS, emptyDesk } from './defaults.js';
import { previewAnimated, effectiveBg, currentChoice, bgName } from './backgrounds.js';
import { searchCities } from './widgets.js';
import { confirmDialog, promptDialog } from './dialogs.js';
import { importBookmarksDialog } from './bookmarks.js';

const ICONS = {
  general: '<path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
  interface: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  background: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
  widgets: '<path d="M17.5 19H9a7 7 0 1 1 6.7-9h1.8a4.5 4.5 0 1 1 0 9Z"/>',
  desks: '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
  data: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5"/><path d="M3 12c0 1.7 4 3 9 3s9-1.3 9-3"/>',
  account: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
};

const svgIcon = (name) => {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('class', 'nav-icon');
  s.innerHTML = ICONS[name];
  return s;
};

const opt = (pairs) => pairs.map(([value, label]) => ({ value, label }));

// type: toggle | select | segmented | range | text | color | custom
const SECTIONS = [
  {
    id: 'general',
    title: 'General',
    items: [
      { key: 'greeting', label: 'Show greeting', desc: '“Good morning” above the clock', type: 'toggle' },
      { key: 'name', label: 'Your name', desc: 'Used in the greeting', type: 'text', placeholder: 'Optional', when: (s) => s.greeting },
      { key: 'showClock', label: 'Show clock', type: 'toggle' },
      { key: 'clock24', label: 'Clock format', type: 'segmented', options: opt([[true, '24-hour'], [false, '12-hour']]), when: (s) => s.showClock },
      { key: 'showSeconds', label: 'Show seconds', type: 'toggle', when: (s) => s.showClock },
      { key: 'showDate', label: 'Show date', type: 'toggle' },
      { key: 'openInNewTab', label: 'Open shortcuts in a new tab', type: 'toggle', keywords: 'links target' },
      { key: 'tabTitle', label: 'Tab title', desc: 'The name shown on the browser tab', type: 'text' },
      { key: 'confirmDelete', label: 'Ask before deleting', desc: 'Confirm before deleting folders', type: 'toggle' },
      { key: 'privacy', label: 'Strict privacy mode', desc: 'Block icon and weather requests. Icons come only from Chrome’s own cache.', type: 'toggle', keywords: 'favicon network tracking' },
      { label: 'Language', desc: 'English', type: 'info', keywords: 'locale' },
      { label: 'Keyboard shortcuts', type: 'custom', render: shortcutsHelp, keywords: 'hotkeys keys' },
    ],
  },
  {
    id: 'interface',
    title: 'Interface',
    items: [
      { key: 'layout', label: 'Layout', desc: 'How the page and widgets are arranged', type: 'custom', render: layoutPicker, keywords: 'interface arrangement column dock minimal split' },
      { key: 'theme', label: 'Theme', type: 'segmented', options: opt([['auto', 'Match background'], ['light', 'Light'], ['dark', 'Dark']]), keywords: 'dark mode light mode' },
      { key: 'accent', label: 'Accent colour', type: 'color' },
      { key: 'font', label: 'Font', type: 'select', options: opt([['system', 'System'], ['rounded', 'Rounded'], ['serif', 'Serif'], ['mono', 'Monospace'], ['condensed', 'Condensed']]) },
      { key: 'clockSize', label: 'Clock size', type: 'range', min: 40, max: 180, step: 4, unit: 'px', when: (s) => s.showClock },
      { key: 'iconSize', label: 'Icon size', type: 'segmented', options: opt([['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']]) },
      { key: 'iconStyle', label: 'Icon style', type: 'segmented', options: opt([['rounded', 'Rounded'], ['circle', 'Circle'], ['flat', 'Flat']]), keywords: 'shape' },
      { key: 'showLabels', label: 'Show names under icons', type: 'toggle', keywords: 'labels titles' },
      { key: 'showEssentials', label: 'Show essentials', desc: 'The pinned row of everyday sites', type: 'toggle', keywords: 'pinned' },
      { key: 'showFolders', label: 'Show folders', type: 'toggle' },
      { key: 'folderPreview', label: 'Folder preview', desc: 'Icons shown on each folder tile', type: 'segmented', options: opt([[4, '4 icons'], [9, '9 icons']]) },
      { key: 'columns', label: 'Folders per row', desc: '0 = automatic', type: 'range', min: 0, max: 10, step: 1 },
      { key: 'glassBlur', label: 'Glass blur', type: 'range', min: 0, max: 40, step: 1, unit: 'px', keywords: 'frosted transparency' },
      { key: 'glassOpacity', label: 'Glass opacity', type: 'range', min: 0, max: 60, step: 1, unit: '%', keywords: 'frosted transparency' },
      { key: 'animations', label: 'Animations', desc: 'Motion for folders and animated backgrounds', type: 'toggle', keywords: 'motion' },
    ],
  },
  {
    id: 'search',
    title: 'Search',
    items: [
      { key: 'showSearch', label: 'Show search bar', type: 'toggle' },
      { key: 'engine', label: 'Search engine', type: 'select', options: Object.entries(ENGINES).map(([value, e]) => ({ value, label: e.name })), keywords: 'google bing duckduckgo' },
      { key: 'customEngine', label: 'Custom search URL', desc: 'Use %s where the search terms go', type: 'text', placeholder: 'https://example.com/search?q=%s', when: (s) => s.engine === 'custom' },
      { key: 'filterShortcuts', label: 'Find shortcuts as you type', desc: 'Enter opens the first match; Shift+Enter searches the web', type: 'toggle', keywords: 'filter' },
      { key: 'searchNewTab', label: 'Open web searches in a new tab', type: 'toggle' },
      { key: 'searchPlaceholder', label: 'Placeholder text', type: 'text' },
    ],
  },
  {
    id: 'background',
    title: 'Background',
    items: [
      { key: 'bgType', label: 'Type', type: 'segmented', options: opt([['gradient', 'Gradient'], ['animated', 'Animated'], ['topo', 'Topography'], ['image', 'Image'], ['color', 'Colour']]), keywords: 'wallpaper' },
      { key: 'bgGradient', label: 'Gradients', type: 'custom', render: gradientPicker, when: (s) => s.bgType === 'gradient', keywords: 'wallpaper colour' },
      { key: 'bgAnimated', label: 'Animated backgrounds', type: 'custom', render: animatedPicker, when: (s) => s.bgType === 'animated', keywords: 'wallpaper motion live' },
      { key: 'bgTopo', label: 'Topographic maps', desc: 'Static maps, then slowly moving ones', type: 'custom', render: topoPicker, when: (s) => s.bgType === 'topo', keywords: 'wallpaper contour map lines topography dark' },
      { key: 'bgSpeed', label: 'Animation speed', type: 'range', min: 0.2, max: 3, step: 0.1, unit: '×', when: (s) => s.bgType === 'animated' || s.bgType === 'topo' },
      { key: 'bgImage', label: 'Your image', type: 'custom', render: imagePicker, when: (s) => s.bgType === 'image', keywords: 'wallpaper photo upload' },
      { key: 'bgColor', label: 'Colour', type: 'color', when: (s) => s.bgType === 'color' },
      { key: 'bgRotation', label: 'Rotate backgrounds', desc: 'Show several backgrounds in turn, every so often or at set times of day', type: 'custom', render: rotationEditor, keywords: 'wallpaper change cycle schedule slideshow rotation timer' },
      { key: 'bgDim', label: 'Dim', type: 'range', min: 0, max: 80, step: 1, unit: '%', keywords: 'darken' },
      { key: 'bgBlur', label: 'Blur', type: 'range', min: 0, max: 30, step: 1, unit: 'px' },
    ],
  },
  {
    id: 'widgets',
    title: 'Widgets',
    items: [
      { label: 'Your widgets', desc: 'Turn widgets on, choose their side, and drag the arrows to reorder. On narrow windows they move into a drawer.', type: 'custom', render: widgetManager, keywords: WIDGET_DEFS.map((w) => w.name + ' ' + w.desc).join(' ') + ' todo tasks forecast pomodoro stopwatch' },
      { key: 'weatherCity', label: 'City', desc: 'Used by Weather, Sun and moon, and Tides', type: 'custom', render: cityPicker, when: () => usesCity(), keywords: 'location' },
      { key: 'weatherUnit', label: 'Temperature units', type: 'segmented', options: opt([['c', '°C'], ['f', '°F']]), when: () => widgetOn('weather'), keywords: 'celsius fahrenheit' },
      { key: 'weekStart', label: 'Week starts on', type: 'segmented', options: opt([['mon', 'Monday'], ['sun', 'Sunday']]), when: () => widgetOn('calendar') || widgetOn('habits') },
      { key: 'timerSound', label: 'Timer sound', desc: 'Chime when the timer ends', type: 'toggle', when: () => widgetOn('timer') },
      { key: 'layout', label: 'Widget placement', desc: 'Also in Interface › Layout', type: 'custom', render: layoutPicker, keywords: 'layout position' },
    ],
  },
  {
    id: 'desks',
    title: 'Desks',
    items: [
      { label: 'Your desks', desc: 'Each desk has its own essentials and folders, for example Work and Personal.', type: 'custom', render: deskManager, keywords: 'workspaces spaces profiles' },
      { key: 'showDeskSwitcher', label: 'Show desk switcher', desc: 'At the bottom of the page when you have more than one desk', type: 'toggle' },
    ],
  },
  {
    id: 'data',
    title: 'Data',
    items: [
      { label: 'Import bookmarks', desc: 'Pick which Chrome bookmark folders to bring in. Others are ignored.', type: 'custom', render: bookmarksRow, keywords: 'import chrome' },
      { label: 'Export', desc: 'Save everything to a JSON file', type: 'custom', render: exportRow, keywords: 'backup download json' },
      { label: 'Import from file', desc: 'Replace your data with a JSON export', type: 'custom', render: importRow, keywords: 'restore upload json' },
      { label: 'Snapshots', desc: 'The last three versions, saved automatically', type: 'custom', render: snapshotsRow, keywords: 'undo restore backup history' },
      { label: 'Reset', desc: 'Delete all shortcuts, folders and settings', type: 'custom', render: resetRow, keywords: 'erase clear delete' },
    ],
  },
  {
    id: 'account',
    title: 'Account',
    items: [
      { label: 'Sync status', type: 'custom', render: syncStatus, keywords: 'google chrome sync' },
      { key: 'sync', label: 'Sync with Chrome', desc: 'Keep desks, folders, shortcuts, settings, tasks and notes the same on every computer signed in to Chrome with your account', type: 'toggle', keywords: 'cloud' },
      { label: 'Storage', type: 'custom', render: storageUsage, keywords: 'quota space' },
    ],
  },
];

let modal = null;
let current = 'general';
let query = '';

export function openSettings(section) {
  if (section && SECTIONS.some((s) => s.id === section)) current = section;
  if (modal) return render();
  const searchIn = h('input', { class: 'settings-search', type: 'search', placeholder: 'Search settings…', spellcheck: 'false' });
  searchIn.addEventListener('input', () => {
    query = searchIn.value.trim().toLowerCase();
    render();
  });
  const nav = h('nav', { class: 'settings-nav' });
  const content = h('div', { class: 'settings-content' });
  const box = h('div', { class: 'settings' },
    h('div', { class: 'settings-head' },
      h('h2', {}, 'Settings'),
      searchIn,
      h('button', { class: 'icon-btn close', title: 'Close', onclick: closeSettings }, '✕'),
    ),
    h('div', { class: 'settings-body' }, nav, content),
  );
  const backdrop = h('div', { class: 'settings-backdrop', onmousedown: closeSettings });
  modal = h('div', { class: 'settings-wrap' }, backdrop, box);
  $('#modal-root').append(modal);
  requestAnimationFrame(() => modal && modal.classList.add('open'));
  document.addEventListener('keydown', onKey, true);
  query = '';
  render();
  setTimeout(() => searchIn.focus(), 50);
}

function onKey(e) {
  // Let nested dialogs close first.
  if (e.key === 'Escape' && $('#modal-root').lastElementChild === modal) {
    e.stopPropagation();
    if (query) {
      const s = $('.settings-search', modal);
      s.value = query = '';
      render();
    } else closeSettings();
  }
}

export function closeSettings() {
  if (!modal) return;
  const m = modal;
  modal = null;
  document.removeEventListener('keydown', onKey, true);
  m.classList.remove('open');
  setTimeout(() => m.remove(), 180);
}

export function isSettingsOpen() {
  return !!modal;
}

// A field committing on blur (e.g. a text box) re-renders the panel while the mouse is down on
// something else, which would swallow that click. Hold the render until the press is over.
let pressing = false;
let pending = false;
document.addEventListener('pointerdown', () => (pressing = true), true);
document.addEventListener('pointerup', () => {
  pressing = false;
  if (pending) {
    pending = false;
    setTimeout(refreshSettings, 0);
  }
}, true);

// Called on every state change while open.
export function refreshSettings() {
  if (!modal) return;
  if (pressing) {
    pending = true;
    return;
  }
  // Don't rebuild while the user is typing in a text field.
  const a = document.activeElement;
  if (a && modal.contains(a) && a.matches('input[type=text], input:not([type]), textarea') && !a.classList.contains('settings-search')) return;
  render();
}

function matches(item, section) {
  const hay = [item.label, item.desc, item.keywords, section.title].filter(Boolean).join(' ').toLowerCase();
  return query.split(/\s+/).every((w) => hay.includes(w));
}

function render() {
  if (!modal) return;
  const s = store.settings;
  const nav = $('.settings-nav', modal);
  const content = $('.settings-content', modal);
  const scroll = content.scrollTop;
  nav.replaceChildren(
    ...SECTIONS.map((sec) =>
      h('button', {
        class: 'nav-item' + (!query && sec.id === current ? ' active' : ''),
        onclick: () => {
          current = sec.id;
          query = '';
          $('.settings-search', modal).value = '';
          render();
          content.scrollTop = 0;
        },
      }, svgIcon(sec.id), h('span', {}, sec.title)),
    ),
  );
  const blocks = [];
  if (query) {
    for (const sec of SECTIONS) {
      const rows = sec.items.filter((it) => matches(it, sec) && (!it.when || it.when(s)));
      if (rows.length) blocks.push(h('h3', { class: 'section-title' }, sec.title), ...rows.map(row));
    }
    if (!blocks.length) blocks.push(h('p', { class: 'settings-empty' }, `No settings match “${query}”.`));
  } else {
    const sec = SECTIONS.find((x) => x.id === current);
    blocks.push(h('h3', { class: 'section-title big' }, sec.title));
    for (const it of sec.items) if (!it.when || it.when(s)) blocks.push(row(it));
  }
  content.replaceChildren(...blocks);
  content.scrollTop = scroll;
}

function row(it) {
  const s = store.settings;
  const set = (v) => store.setSetting(it.key, v);
  let control = null;
  let wide = false;
  switch (it.type) {
    case 'toggle':
      control = h('label', { class: 'switch' },
        h('input', { type: 'checkbox', checked: !!s[it.key], onchange: (e) => set(e.target.checked) }),
        h('span', { class: 'slider' }),
      );
      break;
    case 'select': {
      control = h('select', { class: 'input', onchange: (e) => set(e.target.value) },
        it.options.map((o) => h('option', { value: o.value }, o.label)),
      );
      control.value = s[it.key];
      break;
    }
    case 'segmented':
      control = h('div', { class: 'segmented' },
        it.options.map((o) =>
          h('button', { class: s[it.key] === o.value ? 'active' : '', onclick: () => set(o.value) }, o.label),
        ),
      );
      break;
    case 'range': {
      const out = h('span', { class: 'range-val' }, fmtRange(s[it.key], it));
      const input = h('input', { type: 'range', min: it.min, max: it.max, step: it.step, value: s[it.key] });
      input.value = s[it.key];
      const commit = debounce((v) => set(v), 60);
      input.addEventListener('input', () => {
        const v = Number(input.value);
        out.textContent = fmtRange(v, it);
        commit(v);
      });
      control = h('div', { class: 'range' }, input, out);
      break;
    }
    case 'text': {
      control = h('input', { class: 'input', type: 'text', value: s[it.key] || '', placeholder: it.placeholder || '' });
      control.addEventListener('change', () => set(control.value));
      control.addEventListener('keydown', (e) => e.key === 'Enter' && control.blur());
      break;
    }
    case 'color': {
      // Picker and hex field stay in step; the hex field accepts #abc or #aabbcc, with or without '#'.
      const picker = h('input', { class: 'color-input', type: 'color', value: s[it.key] });
      const hex = h('input', { class: 'input hex-input', type: 'text', value: s[it.key], maxlength: '7', spellcheck: 'false', 'aria-label': `${it.label} hex` });
      picker.addEventListener('input', debounce(() => {
        hex.value = picker.value;
        hex.classList.remove('invalid');
        set(picker.value);
      }, 80));
      const commitHex = () => {
        const v = normalizeHex(hex.value);
        hex.classList.toggle('invalid', !v);
        if (!v) return;
        hex.value = v;
        picker.value = v;
        if (v !== store.settings[it.key]) set(v);
      };
      hex.addEventListener('input', () => normalizeHex(hex.value) && commitHex());
      hex.addEventListener('change', commitHex);
      hex.addEventListener('keydown', (e) => e.key === 'Enter' && hex.blur());
      control = h('div', { class: 'color-row' }, picker, hex);
      break;
    }
    case 'info':
      control = h('span', { class: 'info-val' }, it.desc);
      return h('div', { class: 'setting' }, h('div', { class: 'setting-text' }, h('div', { class: 'setting-label' }, it.label)), control);
    case 'custom':
      control = it.render(it);
      wide = true;
      break;
  }
  return h('div', { class: 'setting' + (wide ? ' wide' : '') },
    h('div', { class: 'setting-text' },
      h('div', { class: 'setting-label' }, it.label),
      it.desc ? h('div', { class: 'setting-desc' }, it.desc) : null,
    ),
    control,
  );
}

function normalizeHex(v) {
  let x = (v || '').trim().replace(/^#/, '').toLowerCase();
  if (/^[0-9a-f]{3}$/.test(x)) x = x.split('').map((c) => c + c).join('');
  return /^[0-9a-f]{6}$/.test(x) ? '#' + x : null;
}

function fmtRange(v, it) {
  if (it.key === 'columns' && !v) return 'Auto';
  return (it.step < 1 ? Number(v).toFixed(1) : v) + (it.unit || '');
}

// ---- Custom controls ----
const widgetOn = (id) => (store.settings.widgets || []).some((w) => w.id === id && w.on);
const usesCity = () => ['weather', 'sun', 'tides'].some(widgetOn);

function widgetManager() {
  const list = store.settings.widgets;
  const split = store.settings.layout === 'split';
  const change = (fn) => store.update((st) => fn(st.settings.widgets));
  return h('div', { class: 'wm-list' },
    list.map((w, i) => {
      const def = WIDGET_DEFS.find((d) => d.id === w.id);
      return h('div', { class: 'wm-row' + (w.on ? ' on' : '') },
        h('label', { class: 'switch' },
          h('input', { type: 'checkbox', checked: w.on, onchange: (e) => change((ws) => (ws[i].on = e.target.checked)) }),
          h('span', { class: 'slider' }),
        ),
        h('div', { class: 'wm-text' }, h('b', {}, def.name), h('span', {}, def.desc)),
        split
          ? h('div', { class: 'segmented tiny', title: 'Side of the grid' },
              [['left', 'Left'], ['right', 'Right']].map(([v, l]) =>
                h('button', { class: w.side === v ? 'active' : '', onclick: () => change((ws) => (ws[i].side = v)) }, l),
              ),
            )
          : null,
        h('div', { class: 'wm-order' },
          h('button', { class: 'icon-btn', title: 'Move up', disabled: i === 0, onclick: () => change((ws) => ws.splice(i - 1, 0, ws.splice(i, 1)[0])) }, '↑'),
          h('button', { class: 'icon-btn', title: 'Move down', disabled: i === list.length - 1, onclick: () => change((ws) => ws.splice(i + 1, 0, ws.splice(i, 1)[0])) }, '↓'),
        ),
      );
    }),
  );
}

function layoutPicker() {
  const s = store.settings;
  return h('div', { class: 'layout-grid' },
    LAYOUTS.map((l) =>
      h('button', {
        class: 'layout-card' + (s.layout === l.id ? ' active' : ''),
        title: l.desc,
        onclick: () => store.setSetting('layout', l.id),
      },
        h('span', { class: `layout-thumb lt-${l.id}` }, h('i', { class: 'a' }), h('i', { class: 'b' }), h('i', { class: 'c' }), h('i', { class: 'd' })),
        h('span', { class: 'layout-name' }, l.name),
      ),
    ),
  );
}

function gradientPicker() {
  const s = store.settings;
  return h('div', { class: 'bg-grid' },
    GRADIENTS.map((g) =>
      h('button', {
        class: 'bg-swatch' + (s.bgGradient === g.id ? ' active' : ''),
        style: { background: g.css },
        title: g.name,
        onclick: () => store.update((st) => { st.settings.bgType = 'gradient'; st.settings.bgGradient = g.id; }),
      }, h('span', { class: 'bg-name' + (g.tone === 'light' ? ' dark-text' : '') }, g.name)),
    ),
  );
}

function animatedPicker() {
  const s = store.settings;
  return h('div', { class: 'bg-grid' },
    ANIMATED.map((a) => {
      const c = h('canvas', { width: 160, height: 100 });
      requestAnimationFrame(() => previewAnimated(a.id, c));
      return h('button', {
        class: 'bg-swatch' + (s.bgAnimated === a.id ? ' active' : ''),
        title: a.name,
        onclick: () => store.update((st) => { st.settings.bgType = 'animated'; st.settings.bgAnimated = a.id; }),
      }, c, h('span', { class: 'bg-name' + (a.tone === 'light' ? ' dark-text' : '') }, a.name));
    }),
  );
}

function topoPicker() {
  const s = store.settings;
  const swatch = (a) => {
    const c = h('canvas', { width: 160, height: 100 });
    requestAnimationFrame(() => previewAnimated(a.id, c));
    return h('button', {
      class: 'bg-swatch' + (s.bgTopo === a.id ? ' active' : ''),
      title: a.name + (a.still ? '' : ' (animated)'),
      onclick: () => store.update((st) => { st.settings.bgType = 'topo'; st.settings.bgTopo = a.id; }),
    }, c, h('span', { class: 'bg-name' + (a.tone === 'light' ? ' dark-text' : '') }, a.name, a.still ? '' : ' ∿'));
  };
  return h('div', { class: 'stack' },
    h('div', { class: 'bg-group' }, 'Static'),
    h('div', { class: 'bg-grid' }, TOPOS.filter((a) => a.still).map(swatch)),
    h('div', { class: 'bg-group' }, 'Animated'),
    h('div', { class: 'bg-grid' }, TOPOS.filter((a) => !a.still).map(swatch)),
  );
}

const EVERY = [[0, 'Each new tab'], [1, '1 minute'], [5, '5 minutes'], [15, '15 minutes'], [30, '30 minutes'], [60, '1 hour'], [180, '3 hours'], [360, '6 hours'], [720, '12 hours'], [1440, 'Day']];
const SCHEDULE_DEFAULTS = ['07:00', '12:00', '18:00', '22:00', '03:00', '09:00', '15:00', '20:00'];

function bgThumb(item) {
  if (item.type === 'animated' || item.type === 'topo') {
    const c = h('canvas', { class: 'rot-thumb', width: 64, height: 40 });
    requestAnimationFrame(() => previewAnimated(item.value, c));
    return c;
  }
  let bg = '#000';
  if (item.type === 'gradient') bg = (GRADIENTS.find((g) => g.id === item.value) || GRADIENTS[0]).css;
  else if (item.type === 'color') bg = item.value;
  else if (item.type === 'image') {
    const src = item.value.startsWith('img_') ? store.images[item.value] : item.value;
    bg = src ? `center / cover url("${src}")` : '#333';
  }
  return h('span', { class: 'rot-thumb', style: { background: bg } });
}

function rotationEditor() {
  const r = store.settings.bgRotation;
  const change = (fn) => store.update((st) => fn(st.settings.bgRotation));
  const now = effectiveBg();
  const rows = r.items.map((it, i) =>
    h('div', { class: 'rot-row' + (r.mode !== 'off' && JSON.stringify(it) === JSON.stringify(now) ? ' current' : '') },
      bgThumb(it),
      h('span', { class: 'rot-name' }, bgName(it)),
      r.mode === 'schedule'
        ? h('input', {
            class: 'input rot-time', type: 'time', value: it.from || '00:00', title: 'Starts at',
            onchange: (e) => change((rr) => (rr.items[i].from = e.target.value || '00:00')),
          })
        : null,
      h('div', { class: 'wm-order' },
        h('button', { class: 'icon-btn', title: 'Move up', disabled: i === 0, onclick: () => change((rr) => rr.items.splice(i - 1, 0, rr.items.splice(i, 1)[0])) }, '↑'),
        h('button', { class: 'icon-btn', title: 'Move down', disabled: i === r.items.length - 1, onclick: () => change((rr) => rr.items.splice(i + 1, 0, rr.items.splice(i, 1)[0])) }, '↓'),
        h('button', { class: 'icon-btn danger', title: 'Remove', onclick: () => change((rr) => rr.items.splice(i, 1)) }, '✕'),
      ),
    ),
  );
  const cur = currentChoice();
  const already = r.items.some((it) => it.type === cur.type && it.value === cur.value);
  const every = h('select', { class: 'input', onchange: (e) => change((rr) => (rr.every = Number(e.target.value))) },
    EVERY.map(([v, l]) => h('option', { value: v }, l)),
  );
  every.value = String(r.every);
  return h('div', { class: 'stack' },
    h('div', { class: 'segmented' },
      [['off', 'Off'], ['interval', 'Every…'], ['schedule', 'By time of day']].map(([v, l]) =>
        h('button', { class: r.mode === v ? 'active' : '', onclick: () => change((rr) => (rr.mode = v)) }, l),
      ),
    ),
    r.mode === 'interval'
      ? h('div', { class: 'row-inline rot-opts' },
          h('span', { class: 'hint' }, 'Change every'),
          every,
          h('label', { class: 'rot-shuffle' },
            h('input', { type: 'checkbox', checked: !!r.shuffle, onchange: (e) => change((rr) => (rr.shuffle = e.target.checked)) }),
            ' Shuffle',
          ),
        )
      : null,
    r.mode === 'schedule' ? h('p', { class: 'hint' }, 'Each background starts at its time and stays until the next one.') : null,
    rows.length ? h('div', { class: 'rot-list' }, rows) : h('p', { class: 'hint' }, 'Pick a background above, then add it here. Add as many as you like.'),
    h('div', { class: 'row-inline' },
      h('button', {
        class: 'btn',
        disabled: already || !cur.value,
        title: already ? 'Already in the list' : '',
        onclick: () => change((rr) => rr.items.push({ ...cur, from: SCHEDULE_DEFAULTS[rr.items.length % SCHEDULE_DEFAULTS.length] })),
      }, `+ Add “${bgName(cur)}”`),
    ),
    r.mode !== 'off' && r.items.length ? h('p', { class: 'hint' }, `Showing now: ${bgName(now)}`) : null,
  );
}

function imagePicker() {
  const s = store.settings;
  const url = h('input', { class: 'input', type: 'text', placeholder: 'Image URL (https://…)', value: s.bgImage.startsWith('img_') ? '' : s.bgImage });
  url.addEventListener('change', () => store.setSetting('bgImage', url.value.trim()));
  const src = s.bgImage.startsWith('img_') ? store.images[s.bgImage] : s.bgImage;
  return h('div', { class: 'stack' },
    src ? h('div', { class: 'bg-preview', style: { backgroundImage: `url("${src}")` } }) : null,
    h('div', { class: 'row-inline' },
      url,
      h('button', {
        class: 'btn',
        onclick: async () => {
          const file = await pickFile('image/*');
          if (!file) return;
          const data = await fileToDataUrl(file, 2560, 0.85);
          const old = s.bgImage;
          const ref = await store.saveImage(data);
          store.setSetting('bgImage', ref);
          // Keep the old upload if the rotation still uses it.
          if (old.startsWith('img_') && !store.settings.bgRotation.items.some((it) => it.value === old)) store.deleteImage(old);
        },
      }, 'Upload…'),
    ),
    h('p', { class: 'hint' }, 'Uploaded images stay on this computer; image links sync.'),
  );
}

function cityPicker() {
  const city = store.state.weatherCity;
  const input = h('input', { class: 'input', type: 'text', placeholder: 'Search for a city…' });
  const list = h('div', { class: 'city-results' });
  const run = debounce(async () => {
    const q = input.value.trim();
    if (q.length < 2) return list.replaceChildren();
    if (store.settings.privacy) return list.replaceChildren(h('p', { class: 'hint' }, 'Turn off strict privacy mode to search cities.'));
    try {
      const res = await searchCities(q);
      list.replaceChildren(
        ...(res.length
          ? res.map((c) =>
              h('button', {
                class: 'city',
                onclick: () => {
                  store.update((st) => (st.weatherCity = c));
                  input.value = '';
                  list.replaceChildren();
                  input.blur();
                  render();
                },
              }, h('b', {}, c.name), h('span', {}, c.region)),
            )
          : [h('p', { class: 'hint' }, 'No cities found.')]),
      );
    } catch {
      list.replaceChildren(h('p', { class: 'hint' }, 'Could not reach the city search.'));
    }
  }, 300);
  input.addEventListener('input', run);
  return h('div', { class: 'stack' },
    city ? h('div', { class: 'current-city' }, '📍 ', h('b', {}, city.name), city.region ? ` · ${city.region}` : '') : null,
    input,
    list,
  );
}

function deskManager() {
  const st = store.state;
  const list = h('div', { class: 'desk-list' },
    st.desks.map((d, i) =>
      h('div', { class: 'desk-row' + (d.id === st.activeDesk ? ' active' : '') },
        h('button', { class: 'desk-name', title: 'Switch to this desk', onclick: () => store.update((s) => (s.activeDesk = d.id), { localOnly: true }) },
          h('span', { class: 'dot' }), d.name,
          h('span', { class: 'desk-count' }, `${d.essentials.length + d.folders.reduce((n, f) => n + f.items.length, 0)} shortcuts · ${d.folders.length} folders`),
        ),
        h('div', { class: 'desk-actions' },
          h('button', { class: 'icon-btn', title: 'Move up', disabled: i === 0, onclick: () => moveDesk(i, -1) }, '↑'),
          h('button', { class: 'icon-btn', title: 'Move down', disabled: i === st.desks.length - 1, onclick: () => moveDesk(i, 1) }, '↓'),
          h('button', {
            class: 'icon-btn', title: 'Rename',
            onclick: async () => {
              const n = await promptDialog('Rename desk', d.name);
              if (n && n.trim()) store.update(() => (d.name = n.trim()));
            },
          }, '✎'),
          h('button', {
            class: 'icon-btn', title: 'Duplicate',
            onclick: () => store.update((s) => {
              const copy = JSON.parse(JSON.stringify(d));
              copy.id = uid('d_');
              copy.name = d.name + ' copy';
              const re = (o) => (o.id = uid(o.id.slice(0, 2)));
              copy.essentials.forEach(re);
              copy.folders.forEach((f) => { re(f); f.items.forEach(re); });
              s.desks.splice(i + 1, 0, copy);
            }),
          }, '⧉'),
          h('button', {
            class: 'icon-btn danger', title: 'Delete', disabled: st.desks.length === 1,
            onclick: async () => {
              if (!(await confirmDialog(`Delete the desk “${d.name}” and everything on it?`, { force: true }))) return;
              await store.snapshot('Before deleting a desk');
              store.update((s) => {
                s.desks = s.desks.filter((x) => x.id !== d.id);
                if (s.activeDesk === d.id) s.activeDesk = s.desks[0].id;
              });
            },
          }, '✕'),
        ),
      ),
    ),
  );
  return h('div', { class: 'stack' },
    list,
    h('div', { class: 'row-inline' },
      h('button', {
        class: 'btn',
        onclick: async () => {
          const n = await promptDialog('New desk', '', { ok: 'Create', placeholder: 'e.g. Work' });
          if (!n || !n.trim()) return;
          const d = emptyDesk(n.trim());
          store.update((s) => {
            s.desks.push(d);
            s.activeDesk = d.id;
          });
        },
      }, '+ New desk'),
    ),
    h('p', { class: 'hint' }, 'Switch desks with Alt+← / Alt+→ or the switcher at the bottom of the page.'),
  );
}

function moveDesk(i, dir) {
  store.update((s) => {
    const [d] = s.desks.splice(i, 1);
    s.desks.splice(i + dir, 0, d);
  });
}

function bookmarksRow() {
  return h('div', { class: 'row-inline' }, h('button', { class: 'btn', onclick: importBookmarksDialog }, 'Choose folders…'));
}

function exportRow() {
  return h('div', { class: 'row-inline' },
    h('button', {
      class: 'btn',
      onclick: () => download(`homepage-${new Date().toISOString().slice(0, 10)}.json`, store.exportJson()),
    }, 'Export JSON'),
  );
}

function importRow() {
  return h('div', { class: 'row-inline' },
    h('button', {
      class: 'btn',
      onclick: async () => {
        const file = await pickFile('application/json,.json');
        if (!file) return;
        if (!(await confirmDialog('Replace all your current data with this file? A snapshot is saved first.', { ok: 'Import', danger: false }))) return;
        try {
          await store.importJson(await file.text());
          toast('Data imported');
        } catch (e) {
          toast('Import failed: ' + e.message);
        }
      },
    }, 'Import JSON…'),
  );
}

function snapshotsRow() {
  const snaps = store.snapshots;
  if (!snaps.length) return h('p', { class: 'hint' }, 'No snapshots yet. One is saved every hour while you make changes.');
  return h('div', { class: 'snap-list' },
    snaps.map((sn, i) => {
      const count = sn.state.desks.reduce((n, d) => n + d.essentials.length + d.folders.reduce((m, f) => m + f.items.length, 0), 0);
      return h('div', { class: 'snap' },
        h('div', {},
          h('b', {}, new Date(sn.ts).toLocaleString()),
          h('span', {}, `${sn.reason} · ${sn.state.desks.length} desk${sn.state.desks.length > 1 ? 's' : ''} · ${count} shortcuts`),
        ),
        h('button', {
          class: 'btn small',
          onclick: async () => {
            if (!(await confirmDialog('Restore this snapshot? Your current data is saved as a new snapshot first.', { ok: 'Restore', danger: false, force: true }))) return;
            await store.restoreSnapshot(i);
            toast('Snapshot restored');
          },
        }, 'Restore'),
      );
    }),
  );
}

function resetRow() {
  return h('div', { class: 'row-inline' },
    h('button', {
      class: 'btn danger',
      onclick: async () => {
        if (!(await confirmDialog('Reset everything to the defaults? A snapshot is saved first.', { ok: 'Reset', force: true }))) return;
        await store.resetAll();
        toast('Reset to defaults');
      },
    }, 'Reset everything'),
  );
}

function syncStatus() {
  const info = store.syncInfo;
  const on = store.settings.sync;
  const hasSync = typeof chrome !== 'undefined' && !!chrome.storage?.sync;
  let text;
  let cls = 'ok';
  if (!hasSync) [text, cls] = ['Chrome sync is not available here.', 'off'];
  else if (!on) [text, cls] = ['Sync is off. Your data stays on this computer.', 'off'];
  else if (info.status === 'error') [text, cls] = [`Sync problem: ${info.error}`, 'error'];
  else if (info.status === 'syncing') text = 'Syncing…';
  else text = `Synced ${timeAgo(info.lastSync)}` + (info.partial ? ' (tasks and notes are too large and stay on this computer)' : '');
  return h('div', { class: 'stack' },
    h('div', { class: `sync-pill ${cls}` }, h('span', { class: 'dot' }), text),
    h('p', { class: 'hint' }, 'No separate account is needed. Homepage uses Chrome’s own sync: sign in to Chrome with the same Google account and turn on sync for extensions (Chrome Settings › You and Google › Sync › Extensions).'),
    on && hasSync
      ? h('div', { class: 'row-inline' },
          h('button', { class: 'btn', onclick: () => store.pushSync().then(() => toast('Synced')) }, 'Sync now'),
          h('button', {
            class: 'btn',
            onclick: async () => {
              if (!(await confirmDialog('Replace this computer’s data with the synced copy?', { ok: 'Replace', danger: false, force: true }))) return;
              await store.snapshot('Before pulling sync');
              toast((await store.pullSync()) ? 'Loaded the synced copy' : 'Nothing synced yet');
            },
          }, 'Load synced copy'),
        )
      : null,
  );
}

function storageUsage() {
  const used = store.syncInfo.bytes;
  const max = 102400;
  const pct = Math.min(100, (used / max) * 100);
  const localBytes = new TextEncoder().encode(JSON.stringify(store.state) + JSON.stringify(store.images)).length;
  return h('div', { class: 'stack' },
    h('div', { class: 'meter' }, h('span', { style: { width: pct + '%' } })),
    h('p', { class: 'hint' }, `Chrome sync: ${formatBytes(used)} of ${formatBytes(max)} used. On this computer: ${formatBytes(localBytes)}.`),
  );
}

function shortcutsHelp() {
  const rows = [
    ['/', 'Focus search'],
    ['Enter', 'Open first matching shortcut'],
    ['Shift + Enter', 'Search the web'],
    ['Ctrl/⌘ + Enter', 'Open in a new tab'],
    ['Alt + ← / →', 'Previous / next desk'],
    [',', 'Open settings'],
    ['Esc', 'Close'],
    ['Right-click', 'Edit, move or delete a shortcut or folder'],
  ];
  return h('div', { class: 'kbd-list' }, rows.map(([k, v]) => h('div', {}, h('kbd', {}, k), h('span', {}, v))));
}
