import { uid } from './util.js';

// Gradient backgrounds. `tone` decides text colour when the theme follows the background.
export const GRADIENTS = [
  { id: 'blue', name: 'Blue', tone: 'dark', css: 'linear-gradient(160deg, #1e3c72 0%, #2a5298 45%, #6a8fd8 100%)' },
  { id: 'plum', name: 'Plum', tone: 'dark', css: 'linear-gradient(155deg, #2b1036 0%, #6b2c70 50%, #c06c84 100%)' },
  { id: 'night', name: 'Night', tone: 'dark', css: 'linear-gradient(170deg, #0b1020 0%, #1b2140 55%, #2e2a52 100%)' },
  { id: 'lagoon', name: 'Lagoon', tone: 'dark', css: 'linear-gradient(150deg, #0f4c5c 0%, #138a8a 50%, #59c3c3 100%)' },
  { id: 'ember', name: 'Ember', tone: 'dark', css: 'linear-gradient(155deg, #3a0d0d 0%, #a4161a 45%, #f48c06 100%)' },
  { id: 'dawn', name: 'Dawn', tone: 'light', css: 'linear-gradient(165deg, #fdfbfb 0%, #f3e7e9 45%, #e3eeff 100%)' },
  { id: 'mint', name: 'Mint', tone: 'light', css: 'linear-gradient(160deg, #e0f7ef 0%, #c4ecdf 50%, #a8dfe8 100%)' },
  { id: 'peach', name: 'Peach', tone: 'light', css: 'linear-gradient(160deg, #ffecd2 0%, #fcb69f 100%)' },
  { id: 'ocean', name: 'Ocean', tone: 'dark', css: 'linear-gradient(160deg, #021b3a 0%, #034078 50%, #1282a2 100%)' },
  { id: 'forest', name: 'Forest', tone: 'dark', css: 'linear-gradient(160deg, #0b2b1f 0%, #1d4d33 50%, #4f7a4a 100%)' },
  { id: 'sunset', name: 'Sunset', tone: 'dark', css: 'linear-gradient(165deg, #2c3e75 0%, #a4508b 55%, #f7a072 100%)' },
  { id: 'slate', name: 'Slate', tone: 'dark', css: 'linear-gradient(160deg, #1f2933 0%, #3e4c59 55%, #616e7c 100%)' },
  { id: 'mist', name: 'Mist', tone: 'light', css: 'linear-gradient(165deg, #f2f4f8 0%, #dfe6f0 55%, #c9d6e8 100%)' },
];

// Code-drawn backgrounds; each id maps to a painter in backgrounds.js.
export const ANIMATED = [
  { id: 'aurora', name: 'Aurora', tone: 'dark' },
  { id: 'nebula', name: 'Nebula', tone: 'dark' },
  { id: 'constellations', name: 'Constellations', tone: 'dark' },
  { id: 'starfield', name: 'Starfield', tone: 'dark' },
  { id: 'gold', name: 'Gold', tone: 'dark' },
  { id: 'malachite', name: 'Malachite', tone: 'dark' },
  { id: 'marble', name: 'Black marble', tone: 'dark' },
  { id: 'velvet', name: 'Garnet velvet', tone: 'dark' },
  { id: 'suminagashi', name: 'Suminagashi', tone: 'light' },
  { id: 'suminagashiNoir', name: 'Black suminagashi', tone: 'dark' },
  { id: 'suminagashiGold', name: 'Gold suminagashi', tone: 'dark' },
  { id: 'indigo', name: 'Indigo wash', tone: 'dark' },
  { id: 'waves', name: 'Waves', tone: 'dark' },
  { id: 'bubbles', name: 'Bubbles', tone: 'dark' },
  { id: 'lava', name: 'Lava lamp', tone: 'dark' },
  { id: 'snow', name: 'Snowfall', tone: 'dark' },
  { id: 'rain', name: 'Night rain', tone: 'dark' },
  { id: 'grid', name: 'Synthwave', tone: 'dark' },
  { id: 'fireflies', name: 'Fireflies', tone: 'dark' },
  { id: 'matrix', name: 'Code rain', tone: 'dark' },
  { id: 'plasma', name: 'Plasma', tone: 'dark' },
  { id: 'ribbons', name: 'Northern lights', tone: 'dark' },
  { id: 'galaxy', name: 'Galaxy', tone: 'dark' },
  { id: 'meteors', name: 'Meteor shower', tone: 'dark' },
  { id: 'topo', name: 'Topography', tone: 'dark' },
  { id: 'embers', name: 'Embers', tone: 'dark' },
  { id: 'sakura', name: 'Sakura', tone: 'light' },
  { id: 'ripples', name: 'Ripples', tone: 'dark' },
  { id: 'dunes', name: 'Dunes', tone: 'dark' },
  { id: 'hexgrid', name: 'Hex pulse', tone: 'dark' },
  { id: 'mesh', name: 'Pastel mesh', tone: 'light' },
  { id: 'ocean', name: 'Deep ocean', tone: 'dark' },
];

// Topographic contour maps, drawn with real contour lines over a noise field.
// `still` ones are drawn once; the others slowly morph.
export const TOPOS = [
  { id: 'topoMidnight', name: 'Midnight', tone: 'dark', still: true },
  { id: 'topoCharcoal', name: 'Charcoal', tone: 'dark', still: true },
  { id: 'topoEmerald', name: 'Emerald', tone: 'dark', still: true },
  { id: 'topoCopper', name: 'Copper', tone: 'dark', still: true },
  { id: 'topoViolet', name: 'Violet', tone: 'dark', still: true },
  { id: 'topoBlueprint', name: 'Blueprint', tone: 'dark', still: true },
  { id: 'topoSlate', name: 'Slate', tone: 'dark', still: true },
  { id: 'topoOnyx', name: 'Onyx & gold', tone: 'dark', still: true },
  { id: 'topoPaper', name: 'Paper', tone: 'light', still: true },
  { id: 'topoFlow', name: 'Flow', tone: 'dark' },
  { id: 'topoNeon', name: 'Neon', tone: 'dark' },
  { id: 'topoEmber', name: 'Ember', tone: 'dark' },
  { id: 'topoAurora', name: 'Aurora', tone: 'dark' },
  { id: 'topoTide', name: 'Tide', tone: 'dark' },
  { id: 'topoMono', name: 'Mono', tone: 'dark' },
  { id: 'topoDeepSea', name: 'Deep sea', tone: 'dark' },
  // Flowing lines: long wavy lines that never cross.
  { id: 'linesPine', name: 'Pine', tone: 'dark', still: true, kind: 'lines' },
  { id: 'linesGraphite', name: 'Graphite', tone: 'dark', still: true, kind: 'lines' },
  { id: 'linesNavy', name: 'Navy', tone: 'dark', still: true, kind: 'lines' },
  { id: 'linesPlum', name: 'Plum', tone: 'dark', still: true, kind: 'lines' },
  { id: 'linesRust', name: 'Rust', tone: 'dark', still: true, kind: 'lines' },
  { id: 'linesSteel', name: 'Steel', tone: 'dark', still: true, kind: 'lines' },
  { id: 'linesInk', name: 'Ink & gold', tone: 'dark', still: true, kind: 'lines' },
  { id: 'linesMoss', name: 'Moss', tone: 'dark', still: true, kind: 'lines' },
  { id: 'linesPineDrift', name: 'Pine', tone: 'dark', kind: 'lines' },
  { id: 'linesNavyDrift', name: 'Navy', tone: 'dark', kind: 'lines' },
  { id: 'linesGraphiteDrift', name: 'Graphite', tone: 'dark', kind: 'lines' },
  { id: 'linesTealDrift', name: 'Teal', tone: 'dark', kind: 'lines' },
  { id: 'linesRoseDrift', name: 'Rose', tone: 'dark', kind: 'lines' },
  { id: 'linesGoldDrift', name: 'Gold', tone: 'dark', kind: 'lines' },
  { id: 'linesNeonDrift', name: 'Neon', tone: 'dark', kind: 'lines' },
];

export const ENGINES = {
  default: { name: 'Browser default', url: null },
  google: { name: 'Google', url: 'https://www.google.com/search?q=%s' },
  bing: { name: 'Bing', url: 'https://www.bing.com/search?q=%s' },
  duckduckgo: { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=%s' },
  brave: { name: 'Brave Search', url: 'https://search.brave.com/search?q=%s' },
  ecosia: { name: 'Ecosia', url: 'https://www.ecosia.org/search?q=%s' },
  startpage: { name: 'Startpage', url: 'https://www.startpage.com/do/search?q=%s' },
  qwant: { name: 'Qwant', url: 'https://www.qwant.com/?q=%s' },
  custom: { name: 'Custom…', url: null },
};

export const LAYOUTS = [
  { id: 'split', name: 'Beside grid', desc: 'Widgets on the left and right of the grid, centred vertically' },
  { id: 'right', name: 'Widgets right', desc: 'All widgets in a column on the right' },
  { id: 'left', name: 'Widgets left', desc: 'All widgets in a column on the left' },
  { id: 'centered', name: 'Widgets below', desc: 'Everything in one column, widgets under the folders' },
  { id: 'top', name: 'Top bar', desc: 'Compact widgets in a row above the clock' },
  { id: 'dock', name: 'Dock', desc: 'Essentials in a dock at the bottom, widgets on the right' },
  { id: 'minimal', name: 'Minimal', desc: 'Clock and search only; shortcuts and widgets on demand' },
];

// Every widget, with the side it takes in the "Beside grid" layout.
export const WIDGET_DEFS = [
  { id: 'weather', name: 'Weather', desc: 'Five-day forecast for a city', side: 'left' },
  { id: 'focus', name: 'Today’s focus', desc: 'One thing to get done today', side: 'right' },
  { id: 'todo', name: 'To do', desc: 'A simple task list', side: 'right' },
  { id: 'notes', name: 'Notes', desc: 'Quick notes, saved as you type', side: 'right' },
  { id: 'countdown', name: 'Countdown', desc: 'Days left until your dates', side: 'left' },
  { id: 'clocks', name: 'World clocks', desc: 'The time in other cities', side: 'left' },
  { id: 'timer', name: 'Timer', desc: 'Countdown timer and stopwatch', side: 'right' },
  { id: 'habits', name: 'Habits', desc: 'Tick off daily habits and keep streaks', side: 'right' },
  { id: 'calendar', name: 'Calendar', desc: 'This month at a glance', side: 'left' },
  { id: 'sun', name: 'Sun and moon', desc: 'Sunrise, sunset and moon phase', side: 'left' },
  { id: 'tides', name: 'Tides', desc: 'High and low tides for a coastal city', side: 'left' },
  { id: 'cpu', name: 'CPU', desc: 'Processor usage of this computer', side: 'right' },
  { id: 'memory', name: 'Memory', desc: 'RAM usage of this computer', side: 'right' },
];

export function defaultWidgets(old = {}) {
  return WIDGET_DEFS.map((w) => ({ id: w.id, on: !!old[w.id], side: w.side }));
}

export const DEFAULT_SETTINGS = {
  // General
  name: '',
  greeting: true,
  showClock: true,
  clock24: true,
  showSeconds: false,
  showDate: true,
  openInNewTab: false,
  tabTitle: 'New Tab',
  confirmDelete: true,
  privacy: false,
  // Interface
  theme: 'auto',
  layout: 'split',
  font: 'system',
  clockSize: 96,
  iconSize: 'medium',
  iconStyle: 'rounded',
  showLabels: true,
  folderPreview: 4,
  showEssentials: true,
  showFolders: true,
  columns: 0,
  glassBlur: 18,
  glassOpacity: 14,
  accent: '#4f7cff',
  animations: true,
  // Search
  showSearch: true,
  engine: 'default',
  customEngine: '',
  filterShortcuts: true,
  searchNewTab: false,
  searchPlaceholder: 'Search or type a shortcut…',
  // Background
  bgType: 'gradient',
  bgGradient: 'blue',
  bgAnimated: 'aurora',
  bgTopo: 'topoMidnight',
  // Rotation: several backgrounds that change on an interval or by time of day.
  bgRotation: { mode: 'off', every: 60, shuffle: false, items: [] },
  bgColor: '#20263a',
  bgImage: '',
  bgDim: 0,
  bgBlur: 0,
  bgSpeed: 1,
  // Widgets
  widgets: null, // [{ id, on, side }] in display order; filled from WIDGET_DEFS
  weatherUnit: 'c',
  weekStart: 'mon',
  timerSound: true,
  widgetOpacity: 14,
  // Desks
  showDeskSwitcher: true,
  // Account
  sync: true,
};

const sc = (title, url) => ({ id: uid('s_'), title, url, icon: { type: 'auto' } });

export function defaultDesk(name = 'Home') {
  return {
    id: uid('d_'),
    name,
    essentials: [
      sc('Google', 'https://www.google.com'),
      sc('YouTube', 'https://www.youtube.com'),
      sc('Gmail', 'https://mail.google.com'),
      sc('Calendar', 'https://calendar.google.com'),
      sc('Drive', 'https://drive.google.com'),
      sc('GitHub', 'https://github.com'),
    ],
    folders: [
      {
        id: uid('f_'),
        name: 'Work',
        items: [
          sc('Notion', 'https://www.notion.so'),
          sc('Slack', 'https://slack.com'),
          sc('Figma', 'https://www.figma.com'),
          sc('Trello', 'https://trello.com'),
          sc('Linear', 'https://linear.app'),
        ],
      },
      {
        id: uid('f_'),
        name: 'Social',
        items: [
          sc('Reddit', 'https://www.reddit.com'),
          sc('X', 'https://x.com'),
          sc('Instagram', 'https://www.instagram.com'),
          sc('LinkedIn', 'https://www.linkedin.com'),
        ],
      },
      {
        id: uid('f_'),
        name: 'News',
        items: [
          sc('BBC', 'https://www.bbc.com/news'),
          sc('The Verge', 'https://www.theverge.com'),
          sc('Hacker News', 'https://news.ycombinator.com'),
          sc('Reuters', 'https://www.reuters.com'),
        ],
      },
      {
        id: uid('f_'),
        name: 'Media',
        items: [
          sc('Netflix', 'https://www.netflix.com'),
          sc('Spotify', 'https://open.spotify.com'),
          sc('Twitch', 'https://www.twitch.tv'),
          sc('Prime Video', 'https://www.primevideo.com'),
        ],
      },
      {
        id: uid('f_'),
        name: 'Tools',
        items: [
          sc('ChatGPT', 'https://chatgpt.com'),
          sc('Claude', 'https://claude.ai'),
          sc('Translate', 'https://translate.google.com'),
          sc('Maps', 'https://maps.google.com'),
        ],
      },
      {
        id: uid('f_'),
        name: 'Shopping',
        items: [
          sc('Amazon', 'https://www.amazon.com'),
          sc('eBay', 'https://www.ebay.com'),
          sc('AliExpress', 'https://www.aliexpress.com'),
        ],
      },
    ],
  };
}

export function emptyDesk(name) {
  return { id: uid('d_'), name, essentials: [], folders: [] };
}

export function defaultState() {
  const desk = defaultDesk();
  return {
    v: 2,
    updatedAt: 0,
    settings: { ...structuredClone(DEFAULT_SETTINGS), widgets: defaultWidgets() },
    desks: [desk],
    activeDesk: desk.id,
    todos: [],
    notes: '',
    weatherCity: null,
    focus: null,
    countdowns: [],
    clocks: [
      { id: uid('c_'), tz: 'America/New_York', label: 'New York' },
      { id: uid('c_'), tz: 'Europe/London', label: 'London' },
      { id: uid('c_'), tz: 'Asia/Tokyo', label: 'Tokyo' },
    ],
    habits: [],
  };
}
