// Import Chrome bookmarks: the user picks folders; each becomes a Homepage folder.
import { store } from './store.js';
import { h, toast } from './util.js';
import { openModal } from './dialogs.js';
import { makeShortcut } from './ops.js';
import { uid } from './util.js';

async function ensurePermission() {
  if (typeof chrome === 'undefined' || !chrome.permissions) return false;
  // The permission is requested only now, when you choose to import.
  return chrome.permissions.request({ permissions: ['bookmarks'] });
}

export async function importBookmarksDialog() {
  let granted = false;
  try {
    granted = await ensurePermission();
  } catch (e) {
    toast('Could not ask for bookmarks permission');
    return;
  }
  if (!granted) {
    toast('Bookmarks permission was not granted');
    return;
  }
  const [root] = await chrome.bookmarks.getTree();
  const folders = []; // flat list of folders with direct links
  const walk = (node, depth, path) => {
    for (const child of node.children || []) {
      if (child.children) {
        const links = child.children.filter((c) => c.url && /^https?:|^file:|^chrome:/i.test(c.url));
        folders.push({ node: child, depth, links, path: [...path, child.title].join(' › ') });
        walk(child, depth + 1, [...path, child.title]);
      }
    }
  };
  walk(root, 0, []);

  const selected = new Set();
  const intoEssentials = { value: false };
  const list = h('div', { class: 'bm-list' },
    folders.map((f) => {
      const cb = h('input', { type: 'checkbox', disabled: !f.links.length });
      cb.addEventListener('change', () => (cb.checked ? selected.add(f) : selected.delete(f)));
      return h('label', { class: 'bm-row', style: { paddingLeft: 10 + f.depth * 18 + 'px' } },
        cb,
        h('span', { class: 'bm-name' }, f.node.title || 'Untitled'),
        h('span', { class: 'bm-count' }, f.links.length ? `${f.links.length}` : 'no links'),
      );
    }),
  );
  const ess = h('input', { type: 'checkbox' });
  ess.addEventListener('change', () => (intoEssentials.value = ess.checked));

  const m = openModal(
    h('div', { class: 'dialog bm-dialog' },
      h('h3', {}, 'Import bookmarks'),
      h('p', { class: 'hint' }, 'Tick the folders to import. Each one becomes a folder on the current desk. Folders you leave unticked are ignored.'),
      list,
      h('label', { class: 'bm-ess' }, ess, ' Put the “Bookmarks bar” links in Essentials instead of a folder'),
      h('div', { class: 'dialog-actions' },
        h('button', { class: 'btn', onclick: () => m.close() }, 'Cancel'),
        h('button', {
          class: 'btn primary',
          onclick: async () => {
            if (!selected.size) return toast('Choose at least one folder');
            await store.snapshot('Before importing bookmarks');
            let n = 0;
            store.update(() => {
              const desk = store.desk;
              for (const f of selected) {
                const items = f.links.map((b) => makeShortcut({ title: b.title, url: b.url }));
                n += items.length;
                // Folder id "1" is Chrome's bookmarks bar.
                if (intoEssentials.value && f.node.id === '1') desk.essentials.push(...items);
                else desk.folders.push({ id: uid('f_'), name: f.node.title || 'Bookmarks', items });
              }
            });
            m.close();
            toast(`Imported ${n} bookmark${n === 1 ? '' : 's'}`);
          },
        }, 'Import'),
      ),
    ),
  );
}
