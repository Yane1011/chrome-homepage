// Search bar: filters your shortcuts as you type; Enter opens the first match,
// otherwise searches the web. Shift+Enter always searches the web.
import { store } from './store.js';
import { h, $, hostOf } from './util.js';
import { iconEl } from './icons.js';
import { allShortcuts } from './ops.js';
import { ENGINES } from './defaults.js';

let results = [];
let active = 0;

export function initSearch() {
  const input = $('#search-input');
  const box = $('#search-results');
  input.addEventListener('input', () => {
    active = 0;
    renderResults();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const n = results.length + (input.value.trim() ? 1 : 0);
      if (!n) return;
      active = (active + (e.key === 'ArrowDown' ? 1 : -1) + n) % n;
      highlight();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const q = input.value.trim();
      if (!q) return;
      const newTab = e.metaKey || e.ctrlKey;
      if (!e.shiftKey && active < results.length) openUrl(results[active].url, newTab);
      else if (!e.shiftKey && looksLikeUrl(q)) openUrl(/^[a-z]+:\/\//i.test(q) ? q : 'https://' + q, newTab);
      else webSearch(q, newTab);
    } else if (e.key === 'Escape') {
      if (input.value) {
        input.value = '';
        renderResults();
      } else input.blur();
    }
  });
  input.addEventListener('focus', () => document.body.classList.add('searching'));
  input.addEventListener('blur', () => {
    setTimeout(() => {
      if (!box.contains(document.activeElement)) document.body.classList.remove('searching');
    }, 150);
  });
  applySearchSettings();
}

export function applySearchSettings() {
  const s = store.settings;
  const input = $('#search-input');
  input.placeholder = s.searchPlaceholder || 'Search…';
  $('#search').hidden = !s.showSearch;
  const eng = s.engine === 'custom' ? 'Custom' : ENGINES[s.engine]?.name || 'Browser default';
  $('#search-engine').textContent = eng === 'Browser default' ? '' : eng;
}

function looksLikeUrl(q) {
  return !/\s/.test(q) && (/^[a-z]+:\/\//i.test(q) || /^[\w-]+(\.[\w-]+)+(:\d+)?(\/.*)?$/i.test(q) || /^localhost(:\d+)?/.test(q));
}

function score(sc, q) {
  const t = sc.title.toLowerCase();
  const host = hostOf(sc.url).toLowerCase();
  if (t === q) return 100;
  if (t.startsWith(q)) return 80;
  if (host.startsWith(q)) return 70;
  if (t.split(/\s+/).some((w) => w.startsWith(q))) return 60;
  if (t.includes(q)) return 40;
  if (host.includes(q)) return 30;
  if (sc.where.toLowerCase().startsWith(q)) return 10;
  return 0;
}

function renderResults() {
  const input = $('#search-input');
  const box = $('#search-results');
  const q = input.value.trim().toLowerCase();
  document.body.classList.toggle('has-query', !!q);
  if (!q) {
    results = [];
    box.replaceChildren();
    box.hidden = true;
    return;
  }
  results = store.settings.filterShortcuts
    ? allShortcuts()
        .map((s) => ({ s, k: score(s, q) }))
        .filter((x) => x.k > 0)
        .sort((a, b) => b.k - a.k)
        .slice(0, 7)
        .map((x) => x.s)
    : [];
  if (active > results.length) active = 0;
  const engName = store.settings.engine === 'default' ? 'the web' : (ENGINES[store.settings.engine]?.name || 'the web');
  box.replaceChildren(
    ...results.map((s, i) =>
      h('a', {
        class: 'result',
        href: s.url,
        dataset: { i },
        onmouseenter: () => { active = i; highlight(); },
        onclick: (e) => { e.preventDefault(); openUrl(s.url, e.metaKey || e.ctrlKey); },
      },
        h('span', { class: `result-icon tile-icon style-${store.settings.iconStyle}` }, iconEl(s, 32)),
        h('span', { class: 'result-text' },
          h('span', { class: 'result-title' }, s.title),
          h('span', { class: 'result-url' }, hostOf(s.url)),
        ),
        h('span', { class: 'result-where' }, s.where),
      ),
    ),
    h('a', {
      class: 'result web',
      href: '#',
      dataset: { i: results.length },
      onmouseenter: () => { active = results.length; highlight(); },
      onclick: (e) => { e.preventDefault(); webSearch(input.value.trim(), e.metaKey || e.ctrlKey); },
    },
      h('span', { class: 'result-icon web-icon' }, '⌕'),
      h('span', { class: 'result-text' }, h('span', { class: 'result-title' }, `Search ${engName} for “${input.value.trim()}”`)),
      h('span', { class: 'result-where kbd' }, results.length ? '⇧ Enter' : 'Enter'),
    ),
  );
  box.hidden = false;
  highlight();
}

function highlight() {
  const box = $('#search-results');
  [...box.children].forEach((el, i) => el.classList.toggle('active', i === active));
}

function openUrl(url, newTab) {
  if (newTab || store.settings.openInNewTab) window.open(url, '_blank', 'noopener');
  else location.href = url;
}

function webSearch(q, newTab) {
  const s = store.settings;
  const inNew = newTab || s.searchNewTab;
  let url = null;
  if (s.engine === 'custom' && s.customEngine.includes('%s')) url = s.customEngine;
  else if (ENGINES[s.engine]?.url) url = ENGINES[s.engine].url;
  if (!url && typeof chrome !== 'undefined' && chrome.search?.query) {
    chrome.search.query({ text: q, disposition: inNew ? 'NEW_TAB' : 'CURRENT_TAB' });
    return;
  }
  openUrl((url || ENGINES.google.url).replace('%s', encodeURIComponent(q)), inNew);
}

export function focusSearch() {
  const input = $('#search-input');
  if (!$('#search').hidden) input.focus();
}
