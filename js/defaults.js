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
  { id: 'indigo', name: 'Indigo wash', tone: 'dark' },
  { id: 'waves', name: 'Waves', tone: 'dark' },
  { id: 'bubbles', name: 'Bubbles', tone: 'dark' },
  { id: 'lava', name: 'Lava lamp', tone: 'dark' },
  { id: 'snow', name: 'Snowfall', tone: 'dark' },
  { id: 'rain', name: 'Night rain', tone: 'dark' },
  { id: 'grid', name: 'Synthwave', tone: 'dark' },
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
  { id: 'centered', name: 'Centered', desc: 'Everything in one column, widgets below' },
  { id: 'right', name: 'Widgets right', desc: 'Shortcuts in the middle, widgets in a right column' },
  { id: 'left', name: 'Widgets left', desc: 'Widgets in a left column' },
  { id: 'split', name: 'Split', desc: 'Weather on the left, tasks and notes on the right' },
  { id: 'top', name: 'Top bar', desc: 'Compact widgets in a row above the clock' },
  { id: 'dock', name: 'Dock', desc: 'Essentials in a dock at the bottom, widgets on the right' },
  { id: 'minimal', name: 'Minimal', desc: 'Clock and search only; shortcuts and widgets on demand' },
];

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
  layout: 'centered',
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
  bgColor: '#20263a',
  bgImage: '',
  bgDim: 0,
  bgBlur: 0,
  bgSpeed: 1,
  // Widgets
  weather: false,
  weatherUnit: 'c',
  todo: false,
  notes: false,
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
    v: 1,
    updatedAt: 0,
    settings: { ...DEFAULT_SETTINGS },
    desks: [desk],
    activeDesk: desk.id,
    todos: [],
    notes: '',
    weatherCity: null,
  };
}
