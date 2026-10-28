// Backgrounds: gradients, solid colour, your own image, code-drawn animated scenes and topographic maps,
// optionally rotating through several on an interval or by time of day.
import { store } from './store.js';
import { GRADIENTS, ANIMATED, TOPOS } from './defaults.js';
import { $ } from './util.js';

let raf = 0;
let painter = null;
let running = null;

const KEYS = { gradient: 'bgGradient', animated: 'bgAnimated', topo: 'bgTopo', image: 'bgImage', color: 'bgColor' };

// The background picked in settings, as a rotation item.
export function currentChoice(s = store.settings) {
  return { type: s.bgType, value: s[KEYS[s.bgType]] };
}

export function bgName(item) {
  if (item.type === 'gradient') return (GRADIENTS.find((g) => g.id === item.value) || {}).name || 'Gradient';
  if (item.type === 'animated') return (ANIMATED.find((g) => g.id === item.value) || {}).name || 'Animated';
  if (item.type === 'topo') return 'Topography · ' + ((TOPOS.find((g) => g.id === item.value) || {}).name || '');
  if (item.type === 'color') return 'Colour ' + item.value;
  return 'Your image';
}

function validItem(it) {
  if (!it || !KEYS[it.type] || !it.value) return false;
  if (it.type === 'image' && it.value.startsWith('img_')) return !!store.images[it.value];
  return true;
}

// Small deterministic random in [0, 1) for a slot number, so every open tab agrees.
function slotRand(n) {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

let sessionPick = null;
export function effectiveBg() {
  const s = store.settings;
  const r = s.bgRotation || {};
  const items = r.mode && r.mode !== 'off' ? (r.items || []).filter(validItem) : [];
  if (!items.length) return currentChoice(s);
  if (r.mode === 'schedule') {
    const now = new Date();
    const mins = now.getHours() * 60 + now.getMinutes();
    const toMin = (t) => {
      const [hh, mm] = (t || '00:00').split(':').map(Number);
      return hh * 60 + mm;
    };
    const sorted = [...items].sort((x, y) => toMin(x.from) - toMin(y.from));
    let pick = sorted[sorted.length - 1];
    for (const it of sorted) if (toMin(it.from) <= mins) pick = it;
    return pick;
  }
  // Interval: 0 means "each new tab".
  if (!r.every) {
    if (sessionPick == null || sessionPick >= items.length) sessionPick = Math.floor(Math.random() * items.length);
    return items[sessionPick];
  }
  const period = r.every * 60e3;
  const local = Date.now() - new Date().getTimezoneOffset() * 60e3;
  const slot = Math.floor(local / period);
  if (!r.shuffle || items.length < 2) return items[slot % items.length];
  let i = Math.floor(slotRand(slot) * items.length);
  if (i === Math.floor(slotRand(slot - 1) * items.length)) i = (i + 1) % items.length;
  return items[i];
}

export function bgSignature() {
  return JSON.stringify(effectiveBg());
}

export function currentTone() {
  const bg = effectiveBg();
  if (bg.type === 'gradient') return (GRADIENTS.find((g) => g.id === bg.value) || GRADIENTS[0]).tone;
  if (bg.type === 'animated') return (ANIMATED.find((a) => a.id === bg.value) || ANIMATED[0]).tone;
  if (bg.type === 'topo') return (TOPOS.find((a) => a.id === bg.value) || TOPOS[0]).tone;
  if (bg.type === 'color') return luminance(bg.value) > 0.6 ? 'light' : 'dark';
  return 'dark';
}

function luminance(hex) {
  const n = parseInt((hex || '#000').slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export function applyBackground() {
  const s = store.settings;
  const cur = effectiveBg();
  const bg = $('#bg');
  const canvas = $('#bg-canvas');
  bg.style.filter = s.bgBlur ? `blur(${s.bgBlur}px)` : '';
  bg.style.inset = s.bgBlur ? `-${s.bgBlur * 2}px` : '0';
  canvas.style.filter = s.bgBlur ? `blur(${s.bgBlur}px)` : '';
  $('#bg-dim').style.background = `rgba(0,0,0,${(s.bgDim || 0) / 100})`;

  if (cur.type === 'gradient') {
    bg.style.background = (GRADIENTS.find((g) => g.id === cur.value) || GRADIENTS[0]).css;
  } else if (cur.type === 'color') {
    bg.style.background = cur.value;
  } else if (cur.type === 'image') {
    const src = cur.value.startsWith('img_') ? store.images[cur.value] : cur.value;
    bg.style.background = src ? `#111 url("${src.replace(/"/g, '%22')}") center / cover no-repeat` : GRADIENTS[0].css;
  } else {
    bg.style.background = '#000';
  }

  if (cur.type === 'animated' || cur.type === 'topo') {
    canvas.hidden = false;
    const still = cur.type === 'topo' && !!(TOPOS.find((t) => t.id === cur.value) || {}).still;
    if (running !== cur.value) start(cur.value, still);
  } else {
    stop();
    canvas.hidden = true;
  }
}

function stop() {
  cancelAnimationFrame(raf);
  raf = 0;
  painter = null;
  running = null;
  window.onresize = null;
}

function start(id, still = false) {
  stop();
  const canvas = $('#bg-canvas');
  const ctx = canvas.getContext('2d');
  const make = PAINTERS[id] || PAINTERS.aurora;
  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    painter && painter.resize && painter.resize(innerWidth, innerHeight);
    if (still && painter) painter.draw(0, innerWidth, innerHeight);
  };
  painter = make(ctx, innerWidth, innerHeight);
  running = id;
  resize();
  window.onresize = resize;
  if (still) return;
  let t0 = performance.now();
  let t = 0;
  const loop = (now) => {
    const s = store.settings;
    const moving = s.animations && !matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dt = Math.min(64, now - t0) / 1000;
    t0 = now;
    if (moving) t += dt * (s.bgSpeed || 1);
    painter.draw(t, innerWidth, innerHeight);
    raf = moving ? requestAnimationFrame(loop) : 0;
  };
  raf = requestAnimationFrame(loop);
}

// Resume after the tab becomes visible again or animation settings change.
export function resumeAnimation() {
  const cur = effectiveBg();
  const still = cur.type === 'topo' && !!(TOPOS.find((t) => t.id === cur.value) || {}).still;
  if (running && !raf && painter && !still) {
    const id = running;
    running = null;
    start(id);
  }
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    cancelAnimationFrame(raf);
    raf = 0;
  } else resumeAnimation();
});

// ---- Painters ----
const rand = (a, b) => a + Math.random() * (b - a);
const TAU = Math.PI * 2;

function blobs(colors, base, opts = {}) {
  return (ctx, W, H) => {
    const items = colors.map((c, i) => ({
      c, ph: rand(0, TAU), sp: rand(0.05, 0.12) * (opts.speed || 1), r: rand(0.35, 0.6), ox: rand(0.1, 0.9), oy: rand(0.1, 0.9), i,
    }));
    return {
      draw(t, W, H) {
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = base;
        ctx.fillRect(0, 0, W, H);
        ctx.globalCompositeOperation = opts.blend || 'lighter';
        const m = Math.max(W, H);
        for (const b of items) {
          const x = (b.ox + Math.sin(t * b.sp * 2 + b.ph) * 0.25) * W;
          const y = (b.oy + Math.cos(t * b.sp * 1.6 + b.ph * 1.3) * 0.25) * H;
          const r = b.r * m;
          const g = ctx.createRadialGradient(x, y, 0, x, y, r);
          g.addColorStop(0, b.c);
          g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, W, H);
        }
        ctx.globalCompositeOperation = 'source-over';
      },
    };
  };
}

function particles({ count, base, draw: drawP, init, link }) {
  return (ctx, W, H) => {
    let ps = [];
    const seed = (W, H) => {
      const n = Math.round(count * (W * H) / (1440 * 900));
      ps = Array.from({ length: Math.max(20, n) }, () => init(W, H));
    };
    seed(W, H);
    return {
      resize: seed,
      draw(t, W, H) {
        if (typeof base === 'function') base(ctx, W, H, t);
        else {
          ctx.fillStyle = base;
          ctx.fillRect(0, 0, W, H);
        }
        if (link) link(ctx, ps, t, W, H);
        for (const p of ps) drawP(ctx, p, t, W, H);
      },
    };
  };
}

function linear(ctx, H, stops) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  return g;
}

// Floating-ink rings, as in the Japanese marbling art.
function suminagashi(bg, strong, weak) {
  return (ctx) => ({
    draw(t, W, H) {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
      const cx = W * 0.5 + Math.sin(t * 0.05) * W * 0.1;
      const cy = H * 0.5 + Math.cos(t * 0.04) * H * 0.1;
      const m = Math.hypot(W, H);
      for (let i = 0; i < 26; i++) {
        const r = (i * 42 + t * 6) % (m * 0.75);
        ctx.beginPath();
        for (let a = 0; a <= TAU + 0.01; a += 0.05) {
          const wob = Math.sin(a * 3 + t * 0.2 + i) * 14 + Math.sin(a * 7 - t * 0.15) * 6;
          const x = cx + Math.cos(a) * (r + wob);
          const y = cy + Math.sin(a) * (r + wob) * 0.85;
          a === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.strokeStyle = i % 3 === 0 ? strong : weak;
        ctx.lineWidth = i % 3 === 0 ? 2.5 : 1;
        ctx.stroke();
      }
    },
  });
}

// ---- Topographic contours: fBm value noise + marching squares ----
function makeNoise(seed) {
  const hash = (x, y, z) => {
    let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1442695041) + Math.imul(seed, 144665);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const sm = (t) => t * t * (3 - 2 * t);
  const lerp = (a, b, t) => a + (b - a) * t;
  const noise = (x, y, z) => {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = sm(x - xi), yf = sm(y - yi), zf = sm(z - zi);
    const c = (dx, dy, dz) => hash(xi + dx, yi + dy, zi + dz);
    return lerp(
      lerp(lerp(c(0, 0, 0), c(1, 0, 0), xf), lerp(c(0, 1, 0), c(1, 1, 0), xf), yf),
      lerp(lerp(c(0, 0, 1), c(1, 0, 1), xf), lerp(c(0, 1, 1), c(1, 1, 1), xf), yf),
      zf,
    );
  };
  return (x, y, z) => noise(x, y, z) * 0.55 + noise(x * 2.03, y * 2.03, z * 1.7) * 0.28 + noise(x * 4.1, y * 4.1, z * 2.3) * 0.17;
}

// Segment pairs per marching-squares case. Edges: 0 top, 1 right, 2 bottom, 3 left.
const MS = [[], [[3, 2]], [[2, 1]], [[3, 1]], [[0, 1]], [[3, 0], [2, 1]], [[0, 2]], [[3, 0]], [[3, 0]], [[0, 2]], [[0, 1], [3, 2]], [[0, 1]], [[3, 1]], [[2, 1]], [[3, 2]], []];

function contours({ bg, line, index, hue, glow = false, alpha = 0.45, seed = 1, speed = 0, levels = 20, grid }) {
  return (ctx) => {
    const noise = makeNoise(seed);
    let last = -1;
    return {
      draw(t, W, H) {
        // Animated maps redraw at ~20 fps; that is plenty for slow drift.
        const now = performance.now();
        if (speed && last > 0 && now - last < 50) return;
        last = now;
        const unit = Math.min(W, H);
        const cell = Math.max(3, Math.round(unit / (speed ? 85 : 120)));
        const cols = Math.ceil(W / cell) + 1;
        const rows = Math.ceil(H / cell) + 1;
        const z = t * speed;
        const f = new Float32Array(cols * rows);
        let lo = Infinity, hi = -Infinity;
        for (let j = 0; j < rows; j++)
          for (let i = 0; i < cols; i++) {
            const v = noise((i * cell) / unit * 2.2 + seed, (j * cell) / unit * 2.2, z);
            f[j * cols + i] = v;
            if (v < lo) lo = v;
            if (v > hi) hi = v;
          }
        const g = ctx.createRadialGradient(W * 0.5, H * 0.45, 0, W * 0.5, H * 0.5, Math.hypot(W, H) * 0.6);
        g.addColorStop(0, bg[0]);
        g.addColorStop(1, bg[1]);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        if (grid) {
          ctx.strokeStyle = grid;
          ctx.lineWidth = 1;
          ctx.beginPath();
          const gs = unit / 12;
          for (let x = 0; x < W; x += gs) (ctx.moveTo(x, 0), ctx.lineTo(x, H));
          for (let y = 0; y < H; y += gs) (ctx.moveTo(0, y), ctx.lineTo(W, y));
          ctx.stroke();
        }
        const lw = Math.max(0.6, unit / 900);
        ctx.lineJoin = 'round';
        for (let k = 1; k < levels; k++) {
          const th = lo + ((hi - lo) * k) / levels;
          const major = k % 5 === 0;
          ctx.beginPath();
          for (let j = 0; j < rows - 1; j++)
            for (let i = 0; i < cols - 1; i++) {
              const a = f[j * cols + i], b = f[j * cols + i + 1], c = f[(j + 1) * cols + i + 1], d = f[(j + 1) * cols + i];
              const idx = (a > th ? 8 : 0) | (b > th ? 4 : 0) | (c > th ? 2 : 0) | (d > th ? 1 : 0);
              if (idx === 0 || idx === 15) continue;
              const x = i * cell, y = j * cell;
              const pt = (e) => {
                if (e === 0) return [x + ((th - a) / (b - a)) * cell, y];
                if (e === 1) return [x + cell, y + ((th - b) / (c - b)) * cell];
                if (e === 2) return [x + ((th - d) / (c - d)) * cell, y + cell];
                return [x, y + ((th - a) / (d - a)) * cell];
              };
              for (const [e1, e2] of MS[idx]) {
                const p1 = pt(e1), p2 = pt(e2);
                ctx.moveTo(p1[0], p1[1]);
                ctx.lineTo(p2[0], p2[1]);
              }
            }
          let color;
          if (hue) {
            const hh = hue[0] + ((hue[1] - hue[0]) * k) / levels;
            color = `hsla(${hh}, 90%, 62%, ${major ? Math.min(1, alpha * 1.8) : alpha * 0.6})`;
          } else color = major ? index : line;
          if (glow) {
            ctx.strokeStyle = color.replace(/[\d.]+\)$/, '0.08)');
            ctx.lineWidth = lw * 6;
            ctx.stroke();
          }
          ctx.strokeStyle = color;
          ctx.lineWidth = major ? lw * 1.6 : lw;
          ctx.stroke();
        }
      },
    };
  };
}

const PAINTERS = {
  aurora: blobs(['rgba(46,255,170,.55)', 'rgba(0,140,255,.5)', 'rgba(150,60,255,.45)', 'rgba(0,255,220,.35)'], '#030b1a'),
  nebula: blobs(['rgba(255,60,170,.45)', 'rgba(120,60,255,.5)', 'rgba(40,120,255,.4)', 'rgba(255,140,60,.25)', 'rgba(80,0,120,.6)'], '#07020f'),
  gold: blobs(['rgba(255,200,80,.55)', 'rgba(200,130,20,.5)', 'rgba(255,230,160,.35)', 'rgba(120,70,0,.6)'], '#1a1003', { speed: 0.7 }),
  malachite: blobs(['rgba(0,160,100,.6)', 'rgba(0,90,60,.7)', 'rgba(60,220,160,.35)', 'rgba(0,50,40,.8)'], '#02160f', { speed: 0.6 }),
  velvet: blobs(['rgba(160,10,40,.6)', 'rgba(90,0,30,.7)', 'rgba(220,60,80,.35)', 'rgba(40,0,15,.8)'], '#120005', { speed: 0.6 }),
  indigo: blobs(['rgba(40,60,160,.6)', 'rgba(20,30,100,.7)', 'rgba(90,110,210,.35)', 'rgba(10,15,60,.8)'], '#050818', { speed: 0.5 }),
  lava: blobs(['rgba(255,80,0,.8)', 'rgba(255,0,90,.7)', 'rgba(255,170,0,.6)', 'rgba(170,0,60,.7)'], '#1a0008', { speed: 1.4, blend: 'screen' }),
  suminagashi: suminagashi('#f4f1ea', 'rgba(30,40,70,.55)', 'rgba(30,40,70,.18)'),
  suminagashiNoir: suminagashi('#09090b', 'rgba(235,235,242,.5)', 'rgba(235,235,242,.13)'),
  suminagashiGold: suminagashi('#0b0906', 'rgba(222,180,90,.6)', 'rgba(222,180,90,.14)'),
  marble: (ctx) => ({
    draw(t, W, H) {
      ctx.fillStyle = '#0b0b0d';
      ctx.fillRect(0, 0, W, H);
      ctx.lineCap = 'round';
      for (let i = 0; i < 14; i++) {
        ctx.beginPath();
        const y0 = (i / 14) * H * 1.4 - H * 0.2;
        for (let x = -20; x <= W + 20; x += 12) {
          const y = y0 + x * 0.35 + Math.sin(x * 0.004 + i * 1.7 + t * 0.08) * 60 + Math.sin(x * 0.013 + i) * 14;
          x === -20 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `rgba(230,225,215,${i % 4 === 0 ? 0.22 : 0.07})`;
        ctx.lineWidth = i % 4 === 0 ? 1.6 : 0.8;
        ctx.stroke();
      }
    },
  }),
  constellations: particles({
    count: 90,
    base: (ctx, W, H) => {
      ctx.fillStyle = linear(ctx, H, ['#020617', '#0b1534', '#14204a']);
      ctx.fillRect(0, 0, W, H);
    },
    init: (W, H) => ({ x: rand(0, W), y: rand(0, H), vx: rand(-12, 12), vy: rand(-12, 12), r: rand(0.8, 2) }),
    link(ctx, ps, t, W, H) {
      for (const p of ps) {
        p.x = (p.x + p.vx * 0.016 + W) % W;
        p.y = (p.y + p.vy * 0.016 + H) % H;
      }
      ctx.lineWidth = 0.7;
      for (let i = 0; i < ps.length; i++)
        for (let j = i + 1; j < ps.length; j++) {
          const d = Math.hypot(ps[i].x - ps[j].x, ps[i].y - ps[j].y);
          if (d < 130) {
            ctx.strokeStyle = `rgba(160,190,255,${(1 - d / 130) * 0.35})`;
            ctx.beginPath();
            ctx.moveTo(ps[i].x, ps[i].y);
            ctx.lineTo(ps[j].x, ps[j].y);
            ctx.stroke();
          }
        }
    },
    draw(ctx, p) {
      ctx.fillStyle = 'rgba(220,230,255,.9)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, TAU);
      ctx.fill();
    },
  }),
  starfield: particles({
    count: 400,
    base: '#000208',
    init: (W, H) => ({ x: rand(-1, 1), y: rand(-1, 1), z: rand(0.05, 1) }),
    draw(ctx, p, t, W, H) {
      p.z -= 0.0025;
      if (p.z <= 0.02) Object.assign(p, { x: rand(-1, 1), y: rand(-1, 1), z: 1 });
      const sx = W / 2 + (p.x / p.z) * W * 0.3;
      const sy = H / 2 + (p.y / p.z) * H * 0.3;
      const r = (1 - p.z) * 2;
      ctx.fillStyle = `rgba(255,255,255,${1 - p.z})`;
      ctx.fillRect(sx, sy, r, r);
    },
  }),
  bubbles: particles({
    count: 40,
    base: (ctx, W, H) => {
      ctx.fillStyle = linear(ctx, H, ['#0a2a4a', '#0d4a6e', '#0f6b8a']);
      ctx.fillRect(0, 0, W, H);
    },
    init: (W, H) => ({ x: rand(0, W), y: rand(0, H), r: rand(6, 40), v: rand(10, 40), ph: rand(0, TAU) }),
    draw(ctx, p, t, W, H) {
      p.y -= p.v * 0.016;
      if (p.y < -p.r * 2) Object.assign(p, { y: H + p.r * 2, x: rand(0, W) });
      const x = p.x + Math.sin(t + p.ph) * 12;
      ctx.strokeStyle = 'rgba(255,255,255,.25)';
      ctx.fillStyle = 'rgba(255,255,255,.05)';
      ctx.beginPath();
      ctx.arc(x, p.y, p.r, 0, TAU);
      ctx.fill();
      ctx.stroke();
    },
  }),
  snow: particles({
    count: 220,
    base: (ctx, W, H) => {
      ctx.fillStyle = linear(ctx, H, ['#0e1a2b', '#23344d', '#3b4f6b']);
      ctx.fillRect(0, 0, W, H);
    },
    init: (W, H) => ({ x: rand(0, W), y: rand(0, H), r: rand(0.8, 3), v: rand(20, 60), ph: rand(0, TAU) }),
    draw(ctx, p, t, W, H) {
      p.y += p.v * 0.016;
      if (p.y > H + 5) Object.assign(p, { y: -5, x: rand(0, W) });
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      ctx.beginPath();
      ctx.arc(p.x + Math.sin(t * 0.8 + p.ph) * 20, p.y, p.r, 0, TAU);
      ctx.fill();
    },
  }),
  rain: particles({
    count: 300,
    base: (ctx, W, H) => {
      ctx.fillStyle = linear(ctx, H, ['#05070d', '#0d1424', '#1a2236']);
      ctx.fillRect(0, 0, W, H);
    },
    init: (W, H) => ({ x: rand(0, W), y: rand(0, H), l: rand(8, 22), v: rand(500, 900) }),
    draw(ctx, p, t, W, H) {
      p.y += p.v * 0.016;
      p.x -= p.v * 0.0025;
      if (p.y > H) Object.assign(p, { y: -p.l, x: rand(0, W + 100) });
      ctx.strokeStyle = 'rgba(170,190,230,.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.l * 0.15, p.y + p.l);
      ctx.stroke();
    },
  }),
  waves: (ctx) => ({
    draw(t, W, H) {
      ctx.fillStyle = linear(ctx, H, ['#0b1d3a', '#123a6b', '#1d5f99']);
      ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        const base = H * (0.45 + i * 0.1);
        ctx.moveTo(0, H);
        for (let x = 0; x <= W; x += 10) {
          ctx.lineTo(x, base + Math.sin(x * 0.006 + t * (0.4 + i * 0.1) + i) * (22 + i * 6));
        }
        ctx.lineTo(W, H);
        ctx.fillStyle = `rgba(120,190,255,${0.06 + i * 0.03})`;
        ctx.fill();
      }
    },
  }),
  grid: (ctx) => ({
    draw(t, W, H) {
      ctx.fillStyle = linear(ctx, H, ['#120024', '#3a0a4f', '#ff3e88']);
      ctx.fillRect(0, 0, W, H);
      const hz = H * 0.55;
      ctx.fillStyle = 'rgba(255,190,90,.9)';
      ctx.beginPath();
      ctx.arc(W / 2, hz, Math.min(W, H) * 0.16, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#12001f';
      ctx.fillRect(0, hz, W, H - hz);
      ctx.strokeStyle = 'rgba(255,60,200,.7)';
      ctx.lineWidth = 1.2;
      for (let i = -20; i <= 20; i++) {
        ctx.beginPath();
        ctx.moveTo(W / 2 + i * 12, hz);
        ctx.lineTo(W / 2 + i * W * 0.12, H);
        ctx.stroke();
      }
      const off = (t * 0.6) % 1;
      for (let k = 0; k < 14; k++) {
        const z = (k + off) / 14;
        const y = hz + (H - hz) * z * z;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }
    },
  }),
  fireflies: particles({
    count: 70,
    base: (ctx, W, H) => {
      ctx.fillStyle = linear(ctx, H, ['#020b08', '#062018', '#0b2e1f']);
      ctx.fillRect(0, 0, W, H);
    },
    init: (W, H) => ({ x: rand(0, W), y: rand(0, H), ph: rand(0, TAU), sp: rand(0.3, 1), r: rand(1.5, 3) }),
    draw(ctx, p, t, W, H) {
      const x = p.x + Math.sin(t * 0.3 * p.sp + p.ph) * 40;
      const y = p.y + Math.cos(t * 0.25 * p.sp + p.ph * 2) * 30;
      const glow = (Math.sin(t * 2 * p.sp + p.ph) + 1) / 2;
      const g = ctx.createRadialGradient(x, y, 0, x, y, p.r * 8);
      g.addColorStop(0, `rgba(220,255,120,${0.9 * glow})`);
      g.addColorStop(1, 'rgba(220,255,120,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - p.r * 8, y - p.r * 8, p.r * 16, p.r * 16);
    },
  }),
  matrix: (ctx) => {
    const chars = 'アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789ABCDEF';
    let cols = [];
    const size = 16;
    return {
      resize(W, H) {
        cols = Array.from({ length: Math.ceil(W / size) }, () => ({ y: rand(-H, 0), v: rand(60, 160) }));
      },
      draw(t, W, H) {
        if (!cols.length) this.resize(W, H);
        ctx.fillStyle = '#000503';
        ctx.fillRect(0, 0, W, H);
        ctx.font = `${size}px ui-monospace, monospace`;
        cols.forEach((c, i) => {
          c.y += c.v * 0.016;
          if (c.y - 20 * size > H) Object.assign(c, { y: rand(-200, 0), v: rand(60, 160) });
          for (let k = 0; k < 20; k++) {
            const y = c.y - k * size;
            if (y < -size || y > H + size) continue;
            const ch = chars[(Math.floor(y / size) * 7 + i * 13 + Math.floor(t * 4) * (k === 0 ? 1 : 0)) % chars.length];
            ctx.fillStyle = k === 0 ? 'rgba(220,255,230,.95)' : `rgba(0,255,120,${0.75 * (1 - k / 20)})`;
            ctx.fillText(ch, i * size, y);
          }
        });
      },
    };
  },
  plasma: (ctx) => {
    const off = document.createElement('canvas');
    off.width = 96;
    off.height = 60;
    const octx = off.getContext('2d');
    const img = octx.createImageData(off.width, off.height);
    return {
      draw(t, W, H) {
        const { width: w, height: h, } = off;
        for (let y = 0; y < h; y++)
          for (let x = 0; x < w; x++) {
            const v = Math.sin(x * 0.08 + t * 0.7) + Math.sin(y * 0.1 - t * 0.5) + Math.sin((x + y) * 0.05 + t * 0.3) + Math.sin(Math.hypot(x - w / 2, y - h / 2) * 0.12 - t);
            const i = (y * w + x) * 4;
            img.data[i] = 90 + 80 * Math.sin(v * Math.PI * 0.5);
            img.data[i + 1] = 30 + 40 * Math.sin(v * Math.PI * 0.5 + 2);
            img.data[i + 2] = 140 + 100 * Math.sin(v * Math.PI * 0.5 + 4);
            img.data[i + 3] = 255;
          }
        octx.putImageData(img, 0, 0);
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(off, 0, 0, W, H);
      },
    };
  },
  ribbons: (ctx) => ({
    draw(t, W, H) {
      ctx.fillStyle = linear(ctx, H, ['#010409', '#03111f', '#062433']);
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      const colors = ['rgba(40,255,170,', 'rgba(60,160,255,', 'rgba(170,90,255,'];
      for (let k = 0; k < 3; k++) {
        for (let x = 0; x <= W; x += 6) {
          const y = H * (0.3 + k * 0.08) + Math.sin(x * 0.004 + t * (0.3 + k * 0.1) + k) * 60 + Math.sin(x * 0.011 - t * 0.2) * 25;
          const hgt = 120 + Math.sin(x * 0.006 + t * 0.4 + k * 2) * 60;
          const g = ctx.createLinearGradient(0, y - hgt, 0, y);
          g.addColorStop(0, colors[k] + '0)');
          g.addColorStop(1, colors[k] + '.16)');
          ctx.fillStyle = g;
          ctx.fillRect(x, y - hgt, 6, hgt);
        }
      }
      ctx.globalCompositeOperation = 'source-over';
    },
  }),
  galaxy: particles({
    count: 900,
    base: (ctx, W, H) => {
      const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.7);
      g.addColorStop(0, '#1a0f2e');
      g.addColorStop(1, '#020107');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    },
    init: () => {
      const arm = Math.floor(rand(0, 3));
      const d = Math.pow(Math.random(), 1.6);
      return { d, a: arm * (TAU / 3) + d * 5 + rand(-0.35, 0.35), s: rand(0.6, 1.8), c: Math.random() };
    },
    draw(ctx, p, t, W, H) {
      const R = Math.min(W, H) * 0.48;
      const a = p.a + t * 0.04 * (1.2 - p.d);
      const x = W / 2 + Math.cos(a) * p.d * R * 1.4;
      const y = H / 2 + Math.sin(a) * p.d * R * 0.75;
      ctx.fillStyle = p.c > 0.85 ? 'rgba(255,190,240,.9)' : p.c > 0.6 ? 'rgba(170,190,255,.8)' : `rgba(255,255,255,${0.35 + (1 - p.d) * 0.5})`;
      ctx.fillRect(x, y, p.s, p.s);
    },
  }),
  meteors: (ctx) => {
    const stars = Array.from({ length: 260 }, () => ({ x: Math.random(), y: Math.random(), r: rand(0.3, 1.4), ph: rand(0, TAU) }));
    const trails = [];
    return {
      draw(t, W, H) {
        ctx.fillStyle = linear(ctx, H, ['#00010a', '#060a22', '#141433']);
        ctx.fillRect(0, 0, W, H);
        for (const s of stars) {
          ctx.fillStyle = `rgba(255,255,255,${0.4 + 0.4 * Math.sin(t * 1.5 + s.ph)})`;
          ctx.fillRect(s.x * W, s.y * H, s.r, s.r);
        }
        if (Math.random() < 0.025) trails.push({ x: rand(W * 0.2, W * 1.1), y: rand(-50, H * 0.4), life: 1, v: rand(8, 14) });
        for (let i = trails.length - 1; i >= 0; i--) {
          const m = trails[i];
          m.x -= m.v;
          m.y += m.v * 0.55;
          m.life -= 0.015;
          if (m.life <= 0) {
            trails.splice(i, 1);
            continue;
          }
          const g = ctx.createLinearGradient(m.x, m.y, m.x + 120, m.y - 66);
          g.addColorStop(0, `rgba(255,255,255,${m.life})`);
          g.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.strokeStyle = g;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(m.x, m.y);
          ctx.lineTo(m.x + 120, m.y - 66);
          ctx.stroke();
        }
      },
    };
  },
  topo: (ctx) => ({
    draw(t, W, H) {
      ctx.fillStyle = '#0e1512';
      ctx.fillRect(0, 0, W, H);
      ctx.lineWidth = 1;
      for (let k = 0; k < 34; k++) {
        ctx.beginPath();
        const base = (k / 34) * H * 1.2 - H * 0.1;
        for (let x = -10; x <= W + 10; x += 8) {
          const y = base + Math.sin(x * 0.006 + k * 0.35 + t * 0.12) * 40 + Math.sin(x * 0.0021 - k * 0.2 - t * 0.07) * 70 + Math.cos(x * 0.013 + k) * 8;
          x === -10 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.strokeStyle = k % 5 === 0 ? 'rgba(160,220,180,.35)' : 'rgba(160,220,180,.12)';
        ctx.stroke();
      }
    },
  }),
  embers: particles({
    count: 140,
    base: (ctx, W, H) => {
      ctx.fillStyle = linear(ctx, H, ['#050100', '#1a0602', '#3d0f02']);
      ctx.fillRect(0, 0, W, H);
    },
    init: (W, H) => ({ x: rand(0, W), y: rand(0, H), v: rand(20, 70), r: rand(0.8, 2.6), ph: rand(0, TAU) }),
    draw(ctx, p, t, W, H) {
      p.y -= p.v * 0.016;
      if (p.y < -10) Object.assign(p, { y: H + 10, x: rand(0, W) });
      const x = p.x + Math.sin(t * 1.3 + p.ph) * 18;
      const life = p.y / H;
      ctx.fillStyle = `rgba(255,${120 + 100 * (1 - life)},40,${0.3 + life * 0.7})`;
      ctx.shadowColor = 'rgba(255,120,30,.8)';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(x, p.y, p.r, 0, TAU);
      ctx.fill();
      ctx.shadowBlur = 0;
    },
  }),
  sakura: particles({
    count: 60,
    base: (ctx, W, H) => {
      ctx.fillStyle = linear(ctx, H, ['#fdeef3', '#f7dbe6', '#eed3e8']);
      ctx.fillRect(0, 0, W, H);
    },
    init: (W, H) => ({ x: rand(0, W), y: rand(0, H), v: rand(20, 50), s: rand(5, 10), ph: rand(0, TAU), rot: rand(0, TAU) }),
    draw(ctx, p, t, W, H) {
      p.y += p.v * 0.016;
      p.rot += 0.01;
      if (p.y > H + 20) Object.assign(p, { y: -20, x: rand(0, W) });
      const x = p.x + Math.sin(t * 0.8 + p.ph) * 40;
      ctx.save();
      ctx.translate(x, p.y);
      ctx.rotate(p.rot + Math.sin(t + p.ph));
      ctx.scale(1, 0.6 + 0.4 * Math.sin(t * 2 + p.ph));
      ctx.fillStyle = 'rgba(240,140,170,.75)';
      ctx.beginPath();
      ctx.ellipse(0, 0, p.s, p.s * 0.6, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    },
  }),
  ripples: (ctx) => {
    const drops = [];
    return {
      draw(t, W, H) {
        ctx.fillStyle = linear(ctx, H, ['#04202b', '#073441', '#0b4a57']);
        ctx.fillRect(0, 0, W, H);
        if (Math.random() < 0.04 || !drops.length) drops.push({ x: rand(0, W), y: rand(0, H), r: 0, max: rand(120, 260) });
        for (let i = drops.length - 1; i >= 0; i--) {
          const d = drops[i];
          d.r += 1.2;
          const a = 1 - d.r / d.max;
          if (a <= 0) {
            drops.splice(i, 1);
            continue;
          }
          for (let k = 0; k < 3; k++) {
            const rr = d.r - k * 14;
            if (rr <= 0) continue;
            ctx.strokeStyle = `rgba(170,230,240,${a * (0.5 - k * 0.15)})`;
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.ellipse(d.x, d.y, rr, rr * 0.55, 0, 0, TAU);
            ctx.stroke();
          }
        }
      },
    };
  },
  dunes: (ctx) => ({
    draw(t, W, H) {
      ctx.fillStyle = linear(ctx, H, ['#f6c48a', '#f0a36b', '#d9785a']);
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(255,240,200,.85)';
      ctx.beginPath();
      ctx.arc(W * 0.75, H * 0.28, Math.min(W, H) * 0.07, 0, TAU);
      ctx.fill();
      const layers = ['#d98a5c', '#c06f48', '#a2573a', '#7d412d', '#5a2e22'];
      layers.forEach((c, i) => {
        ctx.beginPath();
        const base = H * (0.5 + i * 0.1);
        ctx.moveTo(0, H);
        for (let x = 0; x <= W; x += 10) {
          ctx.lineTo(x, base + Math.sin(x * (0.002 + i * 0.0006) + t * 0.05 * (i + 1) + i * 1.7) * (40 - i * 4) + Math.sin(x * 0.009 + i) * 6);
        }
        ctx.lineTo(W, H);
        ctx.fillStyle = c;
        ctx.fill();
      });
    },
  }),
  hexgrid: (ctx) => ({
    draw(t, W, H) {
      ctx.fillStyle = '#05070f';
      ctx.fillRect(0, 0, W, H);
      const r = 26;
      const w = r * Math.sqrt(3);
      for (let row = -1; row * r * 1.5 < H + r; row++) {
        for (let col = -1; col * w < W + w; col++) {
          const x = col * w + (row % 2 ? w / 2 : 0);
          const y = row * r * 1.5;
          const d = Math.hypot(x - W / 2, y - H / 2);
          const a = (Math.sin(d * 0.012 - t * 1.2) + 1) / 2;
          ctx.beginPath();
          for (let k = 0; k < 6; k++) {
            const ang = Math.PI / 6 + (k * Math.PI) / 3;
            const px = x + Math.cos(ang) * (r - 2);
            const py = y + Math.sin(ang) * (r - 2);
            k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
          }
          ctx.closePath();
          ctx.strokeStyle = `rgba(80,160,255,${0.08 + a * 0.35})`;
          ctx.lineWidth = 1;
          ctx.stroke();
          if (a > 0.92) {
            ctx.fillStyle = `rgba(80,160,255,${(a - 0.92) * 1.5})`;
            ctx.fill();
          }
        }
      }
    },
  }),
  mesh: blobs(['rgba(255,170,200,.8)', 'rgba(160,200,255,.8)', 'rgba(255,220,160,.7)', 'rgba(190,160,255,.7)'], '#f6f1fb', { speed: 0.8, blend: 'multiply' }),
  ocean: blobs(['rgba(0,120,200,.5)', 'rgba(0,200,200,.35)', 'rgba(0,60,140,.6)', 'rgba(60,220,255,.25)'], '#010c1c', { speed: 0.5 }),
  topoMidnight: contours({ bg: ['#0d1428', '#060a16'], line: 'rgba(140,170,255,.16)', index: 'rgba(150,180,255,.42)', seed: 11 }),
  topoCharcoal: contours({ bg: ['#1a1b1e', '#0c0d0f'], line: 'rgba(255,255,255,.1)', index: 'rgba(255,255,255,.3)', seed: 23 }),
  topoEmerald: contours({ bg: ['#0a2219', '#03100b'], line: 'rgba(110,230,170,.14)', index: 'rgba(120,240,180,.38)', seed: 37 }),
  topoCopper: contours({ bg: ['#17110c', '#080604'], line: 'rgba(210,140,90,.15)', index: 'rgba(225,150,95,.45)', seed: 41 }),
  topoViolet: contours({ bg: ['#1d1033', '#0b0617'], line: 'rgba(190,160,255,.15)', index: 'rgba(200,170,255,.4)', seed: 53 }),
  topoBlueprint: contours({ bg: ['#123a66', '#0a2546'], line: 'rgba(255,255,255,.16)', index: 'rgba(255,255,255,.42)', seed: 67, grid: 'rgba(255,255,255,.05)' }),
  topoSlate: contours({ bg: ['#252c36', '#141920'], line: 'rgba(170,190,215,.13)', index: 'rgba(180,200,225,.35)', seed: 71 }),
  topoOnyx: contours({ bg: ['#101010', '#050505'], line: 'rgba(255,255,255,.07)', index: 'rgba(212,175,95,.55)', seed: 83 }),
  topoPaper: contours({ bg: ['#f3eee4', '#e6dfd1'], line: 'rgba(120,85,50,.18)', index: 'rgba(120,85,50,.45)', seed: 97 }),
  topoFlow: contours({ bg: ['#0e1630', '#060914'], line: 'rgba(130,170,255,.16)', index: 'rgba(140,180,255,.42)', seed: 5, speed: 0.05 }),
  topoNeon: contours({ bg: ['#07070d', '#000'], hue: [185, 300], glow: true, seed: 13, speed: 0.06, alpha: 0.55 }),
  topoEmber: contours({ bg: ['#1c0703', '#070100'], line: 'rgba(255,120,60,.16)', index: 'rgba(255,140,70,.5)', seed: 29, speed: 0.05 }),
  topoAurora: contours({ bg: ['#04121a', '#01060a'], hue: [140, 280], seed: 31, speed: 0.04, alpha: 0.4 }),
  topoTide: contours({ bg: ['#06232a', '#020d10'], line: 'rgba(90,220,220,.14)', index: 'rgba(110,235,235,.42)', seed: 43, speed: 0.03, levels: 22 }),
  topoMono: contours({ bg: ['#0a0a0a', '#000'], line: 'rgba(255,255,255,.12)', index: 'rgba(255,255,255,.4)', seed: 59, speed: 0.035 }),
  topoDeepSea: contours({ bg: ['#04102a', '#000510'], hue: [200, 235], seed: 61, speed: 0.025, alpha: 0.35, levels: 26 }),
};

// Small static previews for the picker.
export function previewAnimated(id, canvas) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const p = (PAINTERS[id] || PAINTERS.aurora)(ctx, W, H);
  p.draw(id === 'starfield' || id.startsWith('topo') ? 0 : 3, W, H);
  if (id === 'starfield') for (let i = 0; i < 60; i++) p.draw(i * 0.016, W, H);
}
