import { store } from './store.js';
import { h, $, ICON_COLORS, colorFor, fileToDataUrl, pickFile, normalizeUrl, titleFromUrl } from './util.js';
import { iconEl } from './icons.js';
import { locate, addShortcut, updateShortcut, removeShortcut, restoreShortcut } from './ops.js';
import { toast } from './util.js';

// ---- Generic modal ----
export function openModal(content, { className = '', onClose } = {}) {
  const root = $('#modal-root');
  const backdrop = h('div', { class: 'modal-backdrop' });
  const box = h('div', { class: 'modal ' + className, role: 'dialog', 'aria-modal': 'true' }, content);
  const wrap = h('div', { class: 'modal-wrap' }, backdrop, box);
  const close = () => {
    wrap.classList.add('closing');
    document.removeEventListener('keydown', onKey, true);
    setTimeout(() => wrap.remove(), 160);
    onClose && onClose();
  };
  const onKey = (e) => {
    if (e.key === 'Escape' && root.lastElementChild === wrap) {
      e.stopPropagation();
      close();
    }
  };
  backdrop.addEventListener('mousedown', close);
  document.addEventListener('keydown', onKey, true);
  root.append(wrap);
  requestAnimationFrame(() => wrap.classList.add('open'));
  return { close, box };
}

export function confirmDialog(message, { ok = 'Delete', danger = true, force = false } = {}) {
  if (!force && !store.settings.confirmDelete && danger) return Promise.resolve(true);
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => {
      if (done) return;
      done = true;
      m.close();
      resolve(v);
    };
    const m = openModal(
      h('div', { class: 'dialog' },
        h('p', { class: 'dialog-msg' }, message),
        h('div', { class: 'dialog-actions' },
          h('button', { class: 'btn', onclick: () => finish(false) }, 'Cancel'),
          h('button', { class: 'btn ' + (danger ? 'danger' : 'primary'), onclick: () => finish(true) }, ok),
        ),
      ),
      { className: 'small', onClose: () => finish(false) },
    );
    setTimeout(() => m.box.querySelector('.btn:last-child').focus(), 30);
  });
}

export function promptDialog(title, value = '', { ok = 'Save', placeholder = '' } = {}) {
  return new Promise((resolve) => {
    let done = false;
    const input = h('input', { class: 'input', type: 'text', value, placeholder });
    const finish = (v) => {
      if (done) return;
      done = true;
      m.close();
      resolve(v);
    };
    input.addEventListener('keydown', (e) => e.key === 'Enter' && finish(input.value));
    const m = openModal(
      h('div', { class: 'dialog' },
        h('h3', {}, title),
        input,
        h('div', { class: 'dialog-actions' },
          h('button', { class: 'btn', onclick: () => finish(null) }, 'Cancel'),
          h('button', { class: 'btn primary', onclick: () => finish(input.value) }, ok),
        ),
      ),
      { className: 'small', onClose: () => finish(null) },
    );
    setTimeout(() => {
      input.focus();
      input.select();
    }, 30);
  });
}

// ---- Shortcut editor ----
export function editShortcut({ id, container = 'ess', index } = {}) {
  const desk = store.desk;
  const loc = id ? locate(desk, id) : null;
  const orig = loc ? loc.item : null;
  const draft = orig
    ? JSON.parse(JSON.stringify(orig))
    : { title: '', url: '', icon: { type: 'auto' } };
  let target = loc ? loc.container : container;

  const urlIn = h('input', { class: 'input', type: 'text', placeholder: 'example.com', value: draft.url, spellcheck: 'false' });
  const titleIn = h('input', { class: 'input', type: 'text', placeholder: 'Name', value: draft.title });
  const preview = h('div', { class: 'edit-preview' });
  const iconOpts = h('div', { class: 'edit-iconopts' });
  const where = h('select', { class: 'input' },
    h('option', { value: 'ess' }, 'Essentials'),
    desk.folders.map((f) => h('option', { value: f.id }, f.name)),
  );
  where.value = target;
  where.addEventListener('change', () => (target = where.value));

  const current = () => ({
    ...draft,
    title: titleIn.value.trim() || (urlIn.value ? titleFromUrl(normalizeUrl(urlIn.value)) : 'Shortcut'),
    url: normalizeUrl(urlIn.value),
  });

  function renderPreview() {
    const sc = current();
    preview.replaceChildren(
      h('div', { class: `tile-icon style-${store.settings.iconStyle}` }, iconEl(sc, 64)),
      h('div', { class: 'edit-preview-label' }, sc.title),
    );
  }

  function renderIconOpts() {
    const type = draft.icon.type;
    const seg = h('div', { class: 'segmented' },
      [['auto', 'Site icon'], ['initials', 'Initials'], ['image', 'Image']].map(([v, label]) =>
        h('button', {
          class: type === v ? 'active' : '',
          onclick: () => {
            draft.icon = { ...draft.icon, type: v };
            renderIconOpts();
            renderPreview();
          },
        }, label),
      ),
    );
    const extra = [];
    if (type === 'initials') {
      const cur = draft.icon.color || colorFor(current().title);
      extra.push(
        h('div', { class: 'swatches' },
          ICON_COLORS.map((c) =>
            h('button', {
              class: 'swatch' + (c === cur ? ' active' : ''),
              style: { background: c },
              title: c,
              onclick: () => {
                draft.icon.color = c;
                renderIconOpts();
                renderPreview();
              },
            }),
          ),
          h('label', { class: 'swatch custom', title: 'Custom colour' },
            h('input', {
              type: 'color',
              value: cur,
              oninput: (e) => {
                draft.icon.color = e.target.value;
                renderPreview();
              },
            }),
          ),
        ),
      );
    }
    if (type === 'image') {
      const src = h('input', {
        class: 'input', type: 'text', placeholder: 'Image URL (https://…)',
        value: draft.icon.ref ? '' : draft.icon.src || '',
        oninput: (e) => {
          draft.icon = { type: 'image', src: e.target.value.trim() };
          renderPreview();
        },
      });
      extra.push(
        h('div', { class: 'row-inline' },
          src,
          h('button', {
            class: 'btn',
            onclick: async () => {
              const file = await pickFile('image/*');
              if (!file) return;
              const data = await fileToDataUrl(file, 256);
              const ref = await store.saveImage(data);
              draft.icon = { type: 'image', ref };
              renderIconOpts();
              renderPreview();
            },
          }, 'Upload…'),
        ),
        draft.icon.ref ? h('p', { class: 'hint' }, 'Uploaded images stay on this computer and are not synced.') : null,
      );
    }
    iconOpts.replaceChildren(seg, ...extra);
  }

  urlIn.addEventListener('input', renderPreview);
  titleIn.addEventListener('input', renderPreview);
  renderPreview();
  renderIconOpts();

  const save = () => {
    const sc = current();
    if (!urlIn.value.trim()) {
      urlIn.focus();
      urlIn.classList.add('invalid');
      return;
    }
    if (orig) updateShortcut(orig.id, { title: sc.title, url: sc.url, icon: sc.icon }, target);
    else addShortcut(target, sc, target === container ? index : undefined);
    m.close();
  };
  for (const el of [urlIn, titleIn]) el.addEventListener('keydown', (e) => e.key === 'Enter' && save());

  const m = openModal(
    h('div', { class: 'dialog editor' },
      h('h3', {}, orig ? 'Edit shortcut' : 'Add shortcut'),
      preview,
      h('label', { class: 'field' }, h('span', {}, 'Address'), urlIn),
      h('label', { class: 'field' }, h('span', {}, 'Name'), titleIn),
      h('div', { class: 'field' }, h('span', {}, 'Icon'), iconOpts),
      h('label', { class: 'field' }, h('span', {}, 'Location'), where),
      h('div', { class: 'dialog-actions' },
        orig
          ? h('button', {
              class: 'btn danger ghost left',
              onclick: () => {
                m.close();
                deleteShortcutWithUndo(orig.id);
              },
            }, 'Delete')
          : null,
        h('button', { class: 'btn', onclick: () => m.close() }, 'Cancel'),
        h('button', { class: 'btn primary', onclick: save }, orig ? 'Save' : 'Add'),
      ),
    ),
  );
  setTimeout(() => (orig ? titleIn : urlIn).focus(), 30);
}

export function deleteShortcutWithUndo(id) {
  const removed = removeShortcut(id);
  if (removed) toast(`Deleted “${removed.item.title}”`, { label: 'Undo', run: () => restoreShortcut(removed) });
}

// ---- Context menu ----
export function contextMenu(e, items) {
  e.preventDefault();
  closeContextMenu();
  const menu = h('div', { class: 'ctx-menu', id: 'ctx' },
    items.filter(Boolean).map((it) =>
      it === '-'
        ? h('div', { class: 'ctx-sep' })
        : h('button', {
            class: 'ctx-item' + (it.danger ? ' danger' : ''),
            onclick: () => {
              closeContextMenu();
              it.run();
            },
          }, it.label),
    ),
  );
  document.body.append(menu);
  const { innerWidth: W, innerHeight: H } = window;
  const r = menu.getBoundingClientRect();
  menu.style.left = Math.min(e.clientX, W - r.width - 8) + 'px';
  menu.style.top = Math.min(e.clientY, H - r.height - 8) + 'px';
  setTimeout(() => {
    document.addEventListener('mousedown', outside, true);
    window.addEventListener('blur', closeContextMenu);
  });
  function outside(ev) {
    if (!menu.contains(ev.target)) closeContextMenu();
  }
  menu._cleanup = () => {
    document.removeEventListener('mousedown', outside, true);
    window.removeEventListener('blur', closeContextMenu);
  };
}

export function closeContextMenu() {
  const m = $('#ctx');
  if (m) {
    m._cleanup && m._cleanup();
    m.remove();
  }
}
