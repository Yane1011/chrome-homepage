// Operations on the active desk's shortcuts and folders.
import { store } from './store.js';
import { uid, normalizeUrl, titleFromUrl } from './util.js';

// A container is 'ess' (the essentials row) or a folder id.
export function listOf(desk, container) {
  if (container === 'ess') return desk.essentials;
  const f = desk.folders.find((x) => x.id === container);
  return f ? f.items : null;
}

export function locate(desk, id) {
  let i = desk.essentials.findIndex((s) => s.id === id);
  if (i >= 0) return { container: 'ess', list: desk.essentials, index: i, item: desk.essentials[i] };
  for (const f of desk.folders) {
    i = f.items.findIndex((s) => s.id === id);
    if (i >= 0) return { container: f.id, folder: f, list: f.items, index: i, item: f.items[i] };
  }
  return null;
}

export function findFolder(desk, id) {
  return desk.folders.find((f) => f.id === id);
}

export function allShortcuts(desk = store.desk) {
  const out = desk.essentials.map((s) => ({ ...s, where: 'Essentials' }));
  for (const f of desk.folders) for (const s of f.items) out.push({ ...s, where: f.name });
  return out;
}

export function makeShortcut({ title, url, icon }) {
  const u = normalizeUrl(url);
  return { id: uid('s_'), title: (title || '').trim() || titleFromUrl(u), url: u, icon: icon || { type: 'auto' } };
}

export function addShortcut(container, data, index) {
  const s = makeShortcut(data);
  store.update(() => {
    const list = listOf(store.desk, container);
    if (!list) return;
    if (index == null) list.push(s);
    else list.splice(index, 0, s);
  });
  return s;
}

export function updateShortcut(id, patch, newContainer) {
  store.update(() => {
    const desk = store.desk;
    const loc = locate(desk, id);
    if (!loc) return;
    Object.assign(loc.item, patch);
    if (patch.url != null) loc.item.url = normalizeUrl(patch.url);
    if (newContainer && newContainer !== loc.container) {
      loc.list.splice(loc.index, 1);
      listOf(desk, newContainer)?.push(loc.item);
    }
  });
}

export function removeShortcut(id) {
  let removed = null;
  store.update(() => {
    const loc = locate(store.desk, id);
    if (!loc) return;
    removed = { item: loc.item, container: loc.container, index: loc.index };
    loc.list.splice(loc.index, 1);
  });
  return removed;
}

export function restoreShortcut(removed) {
  store.update(() => {
    const list = listOf(store.desk, removed.container) || store.desk.essentials;
    list.splice(Math.min(removed.index, list.length), 0, removed.item);
  });
}

// Move a shortcut to `container` at `index` (index is in the target list before removal).
export function moveShortcut(id, container, index) {
  store.update(() => {
    const desk = store.desk;
    const loc = locate(desk, id);
    const target = listOf(desk, container);
    if (!loc || !target) return;
    loc.list.splice(loc.index, 1);
    let i = index == null ? target.length : index;
    if (loc.list === target && loc.index < i) i--;
    target.splice(Math.max(0, Math.min(i, target.length)), 0, loc.item);
  });
}

export function moveToDesk(id, deskId) {
  store.update((st) => {
    const loc = locate(store.desk, id);
    const dest = st.desks.find((d) => d.id === deskId);
    if (!loc || !dest) return;
    loc.list.splice(loc.index, 1);
    dest.essentials.push(loc.item);
  });
}

export function addFolder(name, items = []) {
  const f = { id: uid('f_'), name: (name || '').trim() || 'New folder', items };
  store.update(() => store.desk.folders.push(f));
  return f;
}

export function renameFolder(id, name) {
  store.update(() => {
    const f = findFolder(store.desk, id);
    if (f) f.name = name.trim() || f.name;
  });
}

export function removeFolder(id) {
  store.snapshot('Before deleting a folder');
  store.update(() => {
    const d = store.desk;
    d.folders = d.folders.filter((f) => f.id !== id);
  });
}

export function moveFolder(id, index) {
  store.update(() => {
    const d = store.desk;
    const from = d.folders.findIndex((f) => f.id === id);
    if (from < 0) return;
    const [f] = d.folders.splice(from, 1);
    let i = from < index ? index - 1 : index;
    d.folders.splice(Math.max(0, Math.min(i, d.folders.length)), 0, f);
  });
}
