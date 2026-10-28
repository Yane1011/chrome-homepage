import { store } from './store.js';
import { h, $ } from './util.js';
import { renderEssentials, renderFolders, renderFolderOverlay, closeFolder, isFolderOpen, pageMenu } from './tiles.js';
import { initSearch, applySearchSettings, focusSearch } from './search.js';
import { renderWidgets } from './widgets.js';
import { applyBackground, currentTone, resumeAnimation } from './backgrounds.js';
import { openSettings, refreshSettings, isSettingsOpen } from './settings.js';
import { closeContextMenu } from './dialogs.js';

const FONTS = {
  system: 'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  rounded: 'ui-rounded, "SF Pro Rounded", "Nunito", "Varela Round", "Segoe UI", system-ui, sans-serif',
  serif: 'ui-serif, "Iowan Old Style", "Palatino Linotype", Georgia, Cambria, serif',
  mono: 'ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace',
  condensed: '"Roboto Condensed", "Arial Narrow", "Helvetica Neue", sans-serif',
};
const ICON_PX = { small: 44, medium: 56, large: 72 };

function applyTheme() {
  const s = store.settings;
  const root = document.documentElement;
  const tone = s.theme === 'auto' ? currentTone() : s.theme;
  root.dataset.theme = tone;
  root.dataset.layout = s.layout;
  root.style.setProperty('--font', FONTS[s.font] || FONTS.system);
  root.style.setProperty('--icon', ICON_PX[s.iconSize] + 'px');
  root.style.setProperty('--clock', s.clockSize + 'px');
  root.style.setProperty('--blur', s.glassBlur + 'px');
  root.style.setProperty('--glass-a', String(s.glassOpacity / 100));
  root.style.setProperty('--widget-a', String(s.widgetOpacity / 100));
  root.style.setProperty('--accent', s.accent);
  root.style.setProperty('--cols', s.columns ? String(s.columns) : '');
  root.classList.toggle('fixed-cols', !!s.columns);
  root.classList.toggle('no-anim', !s.animations);
  root.classList.toggle('no-labels', !s.showLabels);
  document.title = s.tabTitle || 'New Tab';
}

// ---- Clock & greeting ----
function greetingText() {
  const hr = new Date().getHours();
  const part = hr < 5 ? 'Good night' : hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
  const name = store.settings.name.trim();
  return name ? `${part}, ${name}` : part;
}

function tickClock() {
  const s = store.settings;
  const now = new Date();
  const clock = $('#clock');
  clock.hidden = !s.showClock;
  if (s.showClock) {
    let hh = now.getHours();
    let suffix = '';
    if (!s.clock24) {
      suffix = hh >= 12 ? 'PM' : 'AM';
      hh = hh % 12 || 12;
    }
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const text = `${s.clock24 ? String(hh).padStart(2, '0') : hh}:${mm}${s.showSeconds ? ':' + ss : ''}`;
    if (clock.dataset.text !== text + suffix) {
      clock.dataset.text = text + suffix;
      clock.replaceChildren(text, suffix ? h('span', { class: 'ampm' }, suffix) : '');
    }
  }
  const sub = $('#subline');
  const parts = [];
  if (s.greeting) parts.push(greetingText());
  if (s.showDate) parts.push(now.toLocaleDateString('en', { weekday: 'long', day: 'numeric', month: 'long' }));
  const t = parts.join(' · ');
  if (sub.textContent !== t) sub.textContent = t;
  sub.hidden = !parts.length;
}

// ---- Desks ----
function renderDesks() {
  const st = store.state;
  const el = $('#desks');
  const show = st.settings.showDeskSwitcher && st.desks.length > 1;
  el.hidden = !show;
  if (!show) return;
  el.replaceChildren(
    ...st.desks.map((d) =>
      h('button', {
        class: 'desk-pill' + (d.id === st.activeDesk ? ' active' : ''),
        onclick: () => switchDesk(d.id),
      }, d.name),
    ),
  );
}

function switchDesk(id) {
  if (id === store.state.activeDesk) return;
  closeFolder();
  store.update((s) => (s.activeDesk = id), { localOnly: true });
  const main = $('#shortcuts');
  if (store.settings.animations) main.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 220 });
}

function stepDesk(dir) {
  const ds = store.state.desks;
  const i = ds.findIndex((d) => d.id === store.state.activeDesk);
  switchDesk(ds[(i + dir + ds.length) % ds.length].id);
}

// ---- Render ----
let widgetSig = '';
function render(info = {}) {
  if (info.syncOnly) return refreshSettings();
  const s = store.settings;
  applyTheme();
  applyBackground();
  applySearchSettings();
  tickClock();
  const ess = $('#essentials');
  ess.hidden = !s.showEssentials;
  if (s.showEssentials) renderEssentials(ess);
  const folders = $('#folders');
  folders.hidden = !s.showFolders;
  if (s.showFolders) renderFolders(folders);
  renderFolderOverlay();
  renderDesks();
  // Widgets rebuild only when something they show changed (avoids refetching weather).
  const sig = JSON.stringify([
    s.layout, s.widgets, s.weatherUnit, s.weekStart, s.clock24, s.privacy, store.state.weatherCity,
  ]);
  if (sig !== widgetSig || info.remote) {
    widgetSig = sig;
    renderWidgets();
  }
  refreshSettings();
  if (s.animations) resumeAnimation();
}

function bindGlobal() {
  document.addEventListener('open-settings', (e) => openSettings(e.detail));
  $('#settings-btn').addEventListener('click', () => openSettings());
  // chrome:// pages can't be opened by a plain link, so go through the tabs API.
  for (const btn of document.querySelectorAll('#corner [data-url]')) {
    const open = (newTab) => {
      const url = btn.dataset.url;
      if (typeof chrome === 'undefined' || !chrome.tabs) return void (location.href = url);
      if (newTab || store.settings.openInNewTab) chrome.tabs.create({ url });
      else chrome.tabs.update({ url });
    };
    btn.addEventListener('click', (e) => open(e.ctrlKey || e.metaKey || e.shiftKey));
    btn.addEventListener('auxclick', (e) => e.button === 1 && open(true));
  }
  $('#widgets-toggle').addEventListener('click', () => document.body.classList.toggle('drawer-open'));
  $('#shortcuts-toggle').addEventListener('click', () => document.body.classList.toggle('show-shortcuts'));
  $('#folder-overlay').addEventListener('mousedown', (e) => {
    if (e.target.id === 'folder-overlay') closeFolder();
  });
  $('#app').addEventListener('contextmenu', (e) => {
    if (e.target.closest('input, textarea, [contenteditable], .widget')) return;
    pageMenu(e);
  });
  document.addEventListener('keydown', (e) => {
    const typing = e.target.closest?.('input, textarea, select, [contenteditable="true"]');
    if (e.key === 'Escape') {
      closeContextMenu();
      if (isFolderOpen() && !document.querySelector('.modal-wrap')) closeFolder();
      document.body.classList.remove('drawer-open');
      return;
    }
    if (typing || isSettingsOpen() || document.querySelector('.modal-wrap')) return;
    if (e.key === '/') {
      e.preventDefault();
      focusSearch();
    } else if (e.key === ',') {
      e.preventDefault();
      openSettings();
    } else if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault();
      stepDesk(e.key === 'ArrowLeft' ? -1 : 1);
    } else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey && store.settings.showSearch && !isFolderOpen()) {
      // Start typing anywhere to search.
      focusSearch();
    }
  });
  setInterval(tickClock, 1000);
}

async function main() {
  await store.init();
  store.subscribe(render);
  initSearch();
  bindGlobal();
  render();
  document.documentElement.classList.add('ready');
}

main();
