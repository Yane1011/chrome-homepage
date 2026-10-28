// Essentials row, folder grid, folder overlay, and drag-and-drop between them.
import { store } from './store.js';
import { h, $, $$, toast } from './util.js';
import { iconEl } from './icons.js';
import { editShortcut, contextMenu, confirmDialog, promptDialog, deleteShortcutWithUndo } from './dialogs.js';
import { findFolder, moveShortcut, moveFolder, addFolder, renameFolder, removeFolder, locate, moveToDesk } from './ops.js';

let openFolderId = null;
let drag = null; // { kind: 'sc' | 'folder', id, container }

function linkTarget() {
  return store.settings.openInNewTab ? '_blank' : '_self';
}

export function shortcutTile(sc, container) {
  const a = h('a', {
    class: 'tile sc',
    href: sc.url,
    target: linkTarget(),
    rel: 'noopener',
    title: `${sc.title}\n${sc.url}`,
    draggable: 'true',
    dataset: { kind: 'sc', id: sc.id, container },
  },
    h('span', { class: `tile-icon style-${store.settings.iconStyle}` }, iconEl(sc, 64)),
    store.settings.showLabels ? h('span', { class: 'tile-label' }, sc.title) : null,
  );
  a.addEventListener('contextmenu', (e) => shortcutMenu(e, sc));
  bindDrag(a);
  return a;
}

function shortcutMenu(e, sc) {
  e.stopPropagation();
  const desk = store.desk;
  const loc = locate(desk, sc.id);
  const otherDesks = store.state.desks.filter((d) => d.id !== desk.id);
  contextMenu(e, [
    { label: 'Open in new tab', run: () => window.open(sc.url, '_blank', 'noopener') },
    { label: 'Edit…', run: () => editShortcut({ id: sc.id }) },
    '-',
    loc.container !== 'ess' && { label: 'Move to Essentials', run: () => moveShortcut(sc.id, 'ess') },
    ...desk.folders
      .filter((f) => f.id !== loc.container)
      .slice(0, 12)
      .map((f) => ({ label: `Move to ${f.name}`, run: () => moveShortcut(sc.id, f.id) })),
    ...otherDesks.map((d) => ({ label: `Move to desk “${d.name}”`, run: () => moveToDesk(sc.id, d.id) })),
    '-',
    { label: 'Delete', danger: true, run: () => deleteShortcutWithUndo(sc.id) },
  ]);
}

function addTile(onclick, label = 'Add') {
  return h('button', { class: 'tile add-tile', title: label, onclick },
    h('span', { class: `tile-icon style-${store.settings.iconStyle} add-icon` }, '+'),
    store.settings.showLabels ? h('span', { class: 'tile-label' }, label) : null,
  );
}

export function renderEssentials(el) {
  const desk = store.desk;
  el.replaceChildren(
    ...desk.essentials.map((s) => shortcutTile(s, 'ess')),
    addTile(() => editShortcut({ container: 'ess' }), 'Add'),
  );
  el.dataset.container = 'ess';
  bindContainer(el);
}

function folderTile(f) {
  const n = store.settings.folderPreview === 9 ? 9 : 4;
  const minis = f.items.slice(0, n).map((s) => h('span', { class: 'mini' }, iconEl(s, 32)));
  const tile = h('div', {
    class: 'tile folder',
    tabindex: '0',
    role: 'button',
    title: `${f.name} · ${f.items.length} shortcut${f.items.length === 1 ? '' : 's'}`,
    draggable: 'true',
    dataset: { kind: 'folder', id: f.id },
  },
    h('span', { class: `folder-icon grid-${n === 9 ? 3 : 2}` }, minis),
    store.settings.showLabels ? h('span', { class: 'tile-label' }, f.name) : null,
  );
  tile.addEventListener('click', () => openFolder(f.id, tile));
  tile.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), openFolder(f.id, tile)));
  tile.addEventListener('contextmenu', (e) => {
    e.stopPropagation();
    contextMenu(e, [
      { label: 'Open', run: () => openFolder(f.id, tile) },
      { label: 'Open all in new tabs', run: () => f.items.forEach((s) => window.open(s.url, '_blank', 'noopener')) },
      { label: 'Add shortcut…', run: () => editShortcut({ container: f.id }) },
      { label: 'Rename…', run: async () => { const n = await promptDialog('Rename folder', f.name); if (n != null) renameFolder(f.id, n); } },
      '-',
      { label: 'Delete folder', danger: true, run: () => deleteFolder(f) },
    ]);
  });
  bindDrag(tile);
  return tile;
}

async function deleteFolder(f) {
  const ok = await confirmDialog(
    f.items.length
      ? `Delete “${f.name}” and its ${f.items.length} shortcut${f.items.length === 1 ? '' : 's'}?`
      : `Delete “${f.name}”?`,
  );
  if (!ok) return;
  if (openFolderId === f.id) closeFolder();
  removeFolder(f.id);
  toast(`Deleted folder “${f.name}”. You can restore it from Settings › Data › Snapshots.`);
}

export async function createFolder() {
  const name = await promptDialog('New folder', '', { ok: 'Create', placeholder: 'Folder name' });
  if (name != null) addFolder(name);
}

export function renderFolders(el) {
  const desk = store.desk;
  el.replaceChildren(
    ...desk.folders.map(folderTile),
    h('button', { class: 'tile add-tile folder-add', title: 'New folder', onclick: createFolder },
      h('span', { class: 'folder-icon add-icon' }, '+'),
      store.settings.showLabels ? h('span', { class: 'tile-label' }, 'New folder') : null,
    ),
  );
  el.dataset.container = 'folders';
  bindContainer(el);
}

// ---- Folder overlay ----
export function openFolder(id, fromEl) {
  openFolderId = id;
  const ov = $('#folder-overlay');
  ov.hidden = false;
  renderFolderOverlay();
  const panel = $('.folder-panel', ov);
  if (fromEl && store.settings.animations) {
    const r = fromEl.getBoundingClientRect();
    const p = panel.getBoundingClientRect();
    const dx = r.left + r.width / 2 - (p.left + p.width / 2);
    const dy = r.top + r.height / 2 - (p.top + p.height / 2);
    panel.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(${Math.max(0.15, r.width / p.width)})`, opacity: 0.2 },
        { transform: 'none', opacity: 1 },
      ],
      { duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)' },
    );
  }
  requestAnimationFrame(() => ov.classList.add('open'));
}

export function closeFolder() {
  const ov = $('#folder-overlay');
  if (ov.hidden) return;
  openFolderId = null;
  ov.classList.remove('open');
  setTimeout(() => {
    if (!openFolderId) ov.hidden = true;
  }, 180);
}

export function isFolderOpen() {
  return !!openFolderId;
}

export function renderFolderOverlay() {
  if (!openFolderId) return;
  const f = findFolder(store.desk, openFolderId);
  const ov = $('#folder-overlay');
  if (!f) return closeFolder();
  const title = h('input', {
    class: 'folder-title',
    value: f.name,
    spellcheck: 'false',
    'aria-label': 'Folder name',
  });
  title.addEventListener('change', () => renameFolder(f.id, title.value));
  title.addEventListener('keydown', (e) => e.key === 'Enter' && title.blur());
  const grid = h('div', { class: 'folder-grid-open', dataset: { container: f.id } },
    ...f.items.map((s) => shortcutTile(s, f.id)),
    addTile(() => editShortcut({ container: f.id }), 'Add'),
  );
  bindContainer(grid);
  const panel = h('div', { class: 'folder-panel' },
    h('div', { class: 'folder-head' },
      title,
      h('div', { class: 'folder-actions' },
        h('button', { class: 'icon-btn', title: 'Delete folder', onclick: () => deleteFolder(f) }, trashSvg()),
        h('button', { class: 'icon-btn', title: 'Close', onclick: closeFolder }, '✕'),
      ),
    ),
    f.items.length ? null : h('p', { class: 'folder-empty' }, 'This folder is empty. Add a shortcut or drag one here.'),
    grid,
  );
  const existing = $('.folder-panel', ov);
  if (existing) existing.replaceWith(panel);
  else ov.append(panel);
}

function trashSvg() {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('width', '16');
  s.setAttribute('height', '16');
  s.innerHTML = '<path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>';
  return s;
}

// ---- Drag and drop ----
function clearMarks() {
  $$('.drop-before, .drop-after, .drop-into, .drop-end').forEach((el) =>
    el.classList.remove('drop-before', 'drop-after', 'drop-into', 'drop-end'),
  );
}

function bindDrag(tile) {
  tile.addEventListener('dragstart', (e) => {
    drag = { kind: tile.dataset.kind, id: tile.dataset.id, container: tile.dataset.container };
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', tile.href || tile.dataset.id);
    setTimeout(() => tile.classList.add('dragging'));
  });
  tile.addEventListener('dragend', () => {
    tile.classList.remove('dragging');
    drag = null;
    clearMarks();
  });
}

function dropPosition(container, e) {
  const tiles = $$(':scope > .tile:not(.add-tile)', container);
  const over = e.target.closest('.tile');
  if (over && over.parentElement === container && !over.classList.contains('add-tile')) {
    const r = over.getBoundingClientRect();
    const relX = (e.clientX - r.left) / r.width;
    if (drag.kind === 'sc' && over.dataset.kind === 'folder' && relX > 0.22 && relX < 0.78) {
      return { into: over };
    }
    const i = tiles.indexOf(over);
    return relX < 0.5 ? { before: over, index: i } : { after: over, index: i + 1 };
  }
  return { end: true, index: tiles.length };
}

function bindContainer(container) {
  if (container._dndBound) return;
  container._dndBound = true;
  container.addEventListener('dragover', (e) => {
    if (!drag) return;
    const kind = container.dataset.container === 'folders' ? 'folder' : 'sc';
    // Shortcuts may be dropped on folders; folders only reorder among folders.
    if (drag.kind === 'folder' && kind !== 'folder') return;
    e.preventDefault();
    clearMarks();
    const pos = dropPosition(container, e);
    if (pos.into) pos.into.classList.add('drop-into');
    else if (drag.kind === kind) {
      if (pos.before) pos.before.classList.add('drop-before');
      else if (pos.after) pos.after.classList.add('drop-after');
      else container.classList.add('drop-end');
    }
  });
  container.addEventListener('dragleave', (e) => {
    if (!container.contains(e.relatedTarget)) clearMarks();
  });
  container.addEventListener('drop', (e) => {
    if (!drag) return;
    e.preventDefault();
    const pos = dropPosition(container, e);
    const target = container.dataset.container;
    const d = drag;
    clearMarks();
    if (pos.into) {
      moveShortcut(d.id, pos.into.dataset.id);
      pulse(pos.into.dataset.id);
    } else if (d.kind === 'folder' && target === 'folders') {
      moveFolder(d.id, pos.index);
    } else if (d.kind === 'sc' && target !== 'folders') {
      moveShortcut(d.id, target, pos.index);
    }
  });
}

function pulse(folderId) {
  requestAnimationFrame(() => {
    const t = $(`.tile.folder[data-id="${folderId}"]`);
    t && t.animate([{ transform: 'scale(1.12)' }, { transform: 'scale(1)' }], { duration: 260 });
  });
}

// Desk-wide empty-space menu.
export function pageMenu(e) {
  contextMenu(e, [
    { label: 'Add shortcut…', run: () => editShortcut({ container: 'ess' }) },
    { label: 'New folder…', run: createFolder },
    '-',
    { label: 'Settings', run: () => document.dispatchEvent(new CustomEvent('open-settings')) },
  ]);
}

export function isDragging() {
  return !!drag;
}

export { locate };
