import { defaultState, DEFAULT_SETTINGS, WIDGET_DEFS, defaultWidgets } from './defaults.js';
import { clone, debounce, uid } from './util.js';

// When opened outside the extension (e.g. as a plain file), fall back to localStorage.
const hasChrome = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
function shimArea(prefix) {
  return {
    async get(keys) {
      const out = {};
      const all = keys == null;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k.startsWith(prefix)) continue;
        const key = k.slice(prefix.length);
        if (all || [].concat(keys).includes(key)) out[key] = JSON.parse(localStorage.getItem(k));
      }
      return out;
    },
    async set(obj) {
      for (const [k, v] of Object.entries(obj)) localStorage.setItem(prefix + k, JSON.stringify(v));
    },
    async remove(keys) {
      for (const k of [].concat(keys)) localStorage.removeItem(prefix + k);
    },
  };
}
const local = hasChrome ? chrome.storage.local : shimArea('hp.local.');
const sync = hasChrome && chrome.storage.sync ? chrome.storage.sync : shimArea('hp.sync.');

const STATE_KEY = 'state';
const IMAGES_KEY = 'images';
const SNAP_KEY = 'snapshots';
const META_KEY = 'meta';
const CHUNK_BYTES = 7000; // per-item limit is 8192 bytes, keep headroom for the key and JSON quoting
const MAX_SNAPSHOTS = 3;
const SNAPSHOT_EVERY = 60 * 60 * 1000;

function deviceId() {
  let id = localStorage.getItem('hp.device');
  if (!id) {
    id = uid('dev_');
    localStorage.setItem('hp.device', id);
  }
  return id;
}
const DEVICE = deviceId();
const enc = new TextEncoder();
const byteLen = (s) => enc.encode(s).length;

function migrate(st) {
  const base = defaultState();
  if (!st || typeof st !== 'object') return base;
  st.settings = { ...DEFAULT_SETTINGS, ...(st.settings || {}) };
  const rot = st.settings.bgRotation || {};
  st.settings.bgRotation = { ...DEFAULT_SETTINGS.bgRotation, ...rot, items: Array.isArray(rot.items) ? [...rot.items] : [] };
  if (!Array.isArray(st.desks) || !st.desks.length) st.desks = base.desks;
  for (const d of st.desks) {
    d.essentials = Array.isArray(d.essentials) ? d.essentials : [];
    d.folders = Array.isArray(d.folders) ? d.folders : [];
    for (const f of d.folders) f.items = Array.isArray(f.items) ? f.items : [];
  }
  if (!st.desks.some((d) => d.id === st.activeDesk)) st.activeDesk = st.desks[0].id;
  st.todos = Array.isArray(st.todos) ? st.todos : [];
  st.notes = typeof st.notes === 'string' ? st.notes : '';
  st.weatherCity = st.weatherCity || null;
  st.focus = st.focus || null;
  st.countdowns = Array.isArray(st.countdowns) ? st.countdowns : [];
  st.clocks = Array.isArray(st.clocks) ? st.clocks : base.clocks;
  st.habits = Array.isArray(st.habits) ? st.habits : [];
  // v1 stored widgets as three booleans and showed them below the grid.
  if (!Array.isArray(st.settings.widgets)) {
    st.settings.widgets = defaultWidgets(st.settings);
    if ((st.v || 1) < 2 && st.settings.layout === 'centered') st.settings.layout = 'split';
  }
  for (const def of WIDGET_DEFS) {
    if (!st.settings.widgets.some((w) => w.id === def.id)) st.settings.widgets.push({ id: def.id, on: false, side: def.side });
  }
  st.settings.widgets = st.settings.widgets.filter((w) => WIDGET_DEFS.some((d) => d.id === w.id));
  for (const k of ['weather', 'todo', 'notes']) delete st.settings[k];
  st.v = 2;
  st.updatedAt = st.updatedAt || 0;
  return st;
}

function chunk(str) {
  const parts = [];
  let cur = '';
  let curBytes = 0;
  for (const ch of str) {
    const b = byteLen(JSON.stringify(ch)) - 2;
    if (curBytes + b > CHUNK_BYTES) {
      parts.push(cur);
      cur = '';
      curBytes = 0;
    }
    cur += ch;
    curBytes += b;
  }
  if (cur) parts.push(cur);
  return parts;
}

async function readSync() {
  try {
    const all = await sync.get(null);
    const meta = all[META_KEY];
    if (!meta || !meta.n) return null;
    let str = '';
    for (let i = 0; i < meta.n; i++) {
      if (typeof all['c' + i] !== 'string') return null;
      str += all['c' + i];
    }
    const st = JSON.parse(str);
    st._partial = !!meta.partial;
    return { state: st, meta };
  } catch (e) {
    console.warn('Sync read failed', e);
    return null;
  }
}

// Remote state replaces shared data but keeps things that belong to this computer.
function mergeRemote(localState, remote) {
  const next = migrate(clone(remote));
  if (remote._partial) {
    next.todos = localState.todos;
    next.notes = localState.notes;
  }
  delete next._partial;
  if (next.desks.some((d) => d.id === localState.activeDesk)) next.activeDesk = localState.activeDesk;
  return next;
}

export const store = {
  state: null,
  images: {},
  snapshots: [],
  syncInfo: { status: 'idle', lastSync: 0, bytes: 0, error: '', partial: false },
  listeners: new Set(),

  async init() {
    const loc = await local.get([STATE_KEY, IMAGES_KEY, SNAP_KEY, 'lastSync']);
    this.images = loc[IMAGES_KEY] || {};
    this.snapshots = loc[SNAP_KEY] || [];
    this.syncInfo.lastSync = loc.lastSync || 0;
    let st = loc[STATE_KEY] ? migrate(loc[STATE_KEY]) : null;
    const syncOn = st ? st.settings.sync : true;
    if (syncOn) {
      const remote = await readSync();
      if (remote && (!st || remote.state.updatedAt > st.updatedAt)) {
        st = mergeRemote(st || defaultState(), remote.state);
        this.syncInfo.lastSync = remote.meta.ts;
      }
    }
    this.state = st || defaultState();
    if (!loc[STATE_KEY]) {
      this.state.updatedAt = Date.now();
      await local.set({ [STATE_KEY]: this.state });
    }
    if (hasChrome) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'sync' && changes[META_KEY]) this.onRemoteChange(changes[META_KEY].newValue);
      });
    }
    this.measureSync();
  },

  async onRemoteChange(meta) {
    if (!meta || meta.device === DEVICE || !this.state.settings.sync) return;
    const remote = await readSync();
    if (!remote || remote.state.updatedAt <= this.state.updatedAt) return;
    this.state = mergeRemote(this.state, remote.state);
    this.syncInfo.lastSync = remote.meta.ts;
    await local.set({ [STATE_KEY]: this.state, lastSync: remote.meta.ts });
    this.emit({ remote: true });
  },

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  },
  emit(info = {}) {
    for (const fn of this.listeners) fn(info);
  },

  get settings() {
    return this.state.settings;
  },
  get desk() {
    return this.state.desks.find((d) => d.id === this.state.activeDesk) || this.state.desks[0];
  },

  // Change state through a mutator; persists locally and to sync.
  update(mutator, { render = true, localOnly = false } = {}) {
    this.maybeAutoSnapshot();
    mutator(this.state);
    this.state.updatedAt = Date.now();
    this.saveLocal();
    if (!localOnly) this.scheduleSync();
    if (render) this.emit();
  },

  setSetting(key, value) {
    this.update((s) => {
      s.settings[key] = value;
    });
  },

  saveLocal: debounce(function () {
    local.set({ [STATE_KEY]: store.state });
  }, 250),

  scheduleSync: debounce(function () {
    store.pushSync();
  }, 2500),

  async pushSync() {
    if (!this.state.settings.sync) return;
    this.syncInfo.status = 'syncing';
    this.emit({ syncOnly: true });
    try {
      const full = clone(this.state);
      let payload = JSON.stringify(full);
      let partial = false;
      // Sync storage holds ~100 KB; if tasks and notes push it over, sync everything else.
      if (byteLen(payload) > 90000) {
        delete full.todos;
        delete full.notes;
        payload = JSON.stringify(full);
        partial = true;
      }
      if (byteLen(payload) > 95000) throw new Error('Your data is larger than Chrome sync allows (about 100 KB).');
      const parts = chunk(payload);
      const prev = (await sync.get(META_KEY))[META_KEY];
      const items = { [META_KEY]: { n: parts.length, ts: Date.now(), device: DEVICE, partial } };
      parts.forEach((p, i) => (items['c' + i] = p));
      await sync.set(items);
      if (prev && prev.n > parts.length) {
        const stale = [];
        for (let i = parts.length; i < prev.n; i++) stale.push('c' + i);
        await sync.remove(stale);
      }
      this.syncInfo = { ...this.syncInfo, status: 'ok', lastSync: Date.now(), error: '', partial };
      local.set({ lastSync: this.syncInfo.lastSync });
    } catch (e) {
      this.syncInfo = { ...this.syncInfo, status: 'error', error: e.message || String(e) };
    }
    await this.measureSync();
    this.emit({ syncOnly: true });
  },

  async pullSync() {
    const remote = await readSync();
    if (!remote) return false;
    this.state = mergeRemote(this.state, remote.state);
    this.syncInfo.lastSync = remote.meta.ts;
    await local.set({ [STATE_KEY]: this.state, lastSync: remote.meta.ts });
    this.emit();
    return true;
  },

  async measureSync() {
    try {
      this.syncInfo.bytes = hasChrome && chrome.storage.sync ? await chrome.storage.sync.getBytesInUse(null) : 0;
    } catch {
      this.syncInfo.bytes = 0;
    }
  },

  // Uploaded images stay on this computer (too big for Chrome sync).
  async saveImage(dataUrl) {
    const id = uid('img_');
    this.images[id] = dataUrl;
    await local.set({ [IMAGES_KEY]: this.images });
    return id;
  },
  async deleteImage(id) {
    if (!id || !this.images[id]) return;
    delete this.images[id];
    await local.set({ [IMAGES_KEY]: this.images });
  },

  // Snapshots: the last three versions, taken hourly while editing and before risky actions.
  async snapshot(reason = 'Automatic') {
    this.snapshots.unshift({ ts: Date.now(), reason, state: clone(this.state) });
    this.snapshots = this.snapshots.slice(0, MAX_SNAPSHOTS);
    await local.set({ [SNAP_KEY]: this.snapshots });
  },
  maybeAutoSnapshot() {
    const last = this.snapshots[0];
    if (!last || Date.now() - last.ts > SNAPSHOT_EVERY) this.snapshot('Automatic');
  },
  async restoreSnapshot(i) {
    const snap = this.snapshots[i];
    if (!snap) return;
    const restored = clone(snap.state);
    await this.snapshot('Before restore');
    this.replace(restored);
  },

  replace(newState) {
    this.state = migrate(newState);
    this.state.updatedAt = Date.now();
    this.saveLocal.flush();
    this.scheduleSync();
    this.emit();
  },

  exportJson() {
    return JSON.stringify({ app: 'homepage', exportedAt: new Date().toISOString(), state: this.state, images: this.images }, null, 2);
  },
  async importJson(text) {
    const data = JSON.parse(text);
    const st = data.state || data;
    if (!st.desks && !st.settings) throw new Error('This file is not a Homepage export.');
    await this.snapshot('Before import');
    if (data.images) {
      this.images = { ...this.images, ...data.images };
      await local.set({ [IMAGES_KEY]: this.images });
    }
    this.replace(st);
  },
  async resetAll() {
    await this.snapshot('Before reset');
    this.replace(defaultState());
  },
};
