// Backgrounds: gradients, solid colour, your own image, and code-drawn animated scenes.
import { store } from './store.js';
import { GRADIENTS, ANIMATED } from './defaults.js';
import { $ } from './util.js';

let raf = 0;
let painter = null;
let running = null;

export function currentTone() {
  const s = store.settings;
  if (s.bgType === 'gradient') return (GRADIENTS.find((g) => g.id === s.bgGradient) || GRADIENTS[0]).tone;
  if (s.bgType === 'animated') return (ANIMATED.find((a) => a.id === s.bgAnimated) || ANIMATED[0]).tone;
  if (s.bgType === 'color') return luminance(s.bgColor) > 0.6 ? 'light' : 'dark';
  return 'dark';
}

function luminance(hex) {
  const n = parseInt((hex || '#000').slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export function applyBackground() {
  const s = store.settings;
  const bg = $('#bg');
  const canvas = $('#bg-canvas');
  bg.style.filter = s.bgBlur ? `blur(${s.bgBlur}px)` : '';
  bg.style.inset = s.bgBlur ? `-${s.bgBlur * 2}px` : '0';
  $('#bg-dim').style.background = `rgba(0,0,0,${(s.bgDim || 0) / 100})`;

  let key = s.bgType;
  if (s.bgType === 'gradient') {
    bg.style.background = (GRADIENTS.find((g) => g.id === s.bgGradient) || GRADIENTS[0]).css;
  } else if (s.bgType === 'color') {
    bg.style.background = s.bgColor;
  } else if (s.bgType === 'image') {
    const src = s.bgImage.startsWith('img_') ? store.images[s.bgImage] : s.bgImage;
    bg.style.background = src ? `#111 url("${src.replace(/"/g, '%22')}") center / cover no-repeat` : GRADIENTS[0].css;
  } else if (s.bgType === 'animated') {
    bg.style.background = '#000';
    key = 'animated:' + s.bgAnimated;
  }

  if (s.bgType === 'animated') {
    canvas.hidden = false;
    if (running !== key) start(s.bgAnimated);
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
}

function start(id) {
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
  };
  painter = make(ctx, innerWidth, innerHeight);
  running = 'animated:' + id;
  resize();
  window.onresize = resize;
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
  if (running && !raf && painter) {
    const id = running.split(':')[1];
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

const PAINTERS = {
  aurora: blobs(['rgba(46,255,170,.55)', 'rgba(0,140,255,.5)', 'rgba(150,60,255,.45)', 'rgba(0,255,220,.35)'], '#030b1a'),
  nebula: blobs(['rgba(255,60,170,.45)', 'rgba(120,60,255,.5)', 'rgba(40,120,255,.4)', 'rgba(255,140,60,.25)', 'rgba(80,0,120,.6)'], '#07020f'),
  gold: blobs(['rgba(255,200,80,.55)', 'rgba(200,130,20,.5)', 'rgba(255,230,160,.35)', 'rgba(120,70,0,.6)'], '#1a1003', { speed: 0.7 }),
  malachite: blobs(['rgba(0,160,100,.6)', 'rgba(0,90,60,.7)', 'rgba(60,220,160,.35)', 'rgba(0,50,40,.8)'], '#02160f', { speed: 0.6 }),
  velvet: blobs(['rgba(160,10,40,.6)', 'rgba(90,0,30,.7)', 'rgba(220,60,80,.35)', 'rgba(40,0,15,.8)'], '#120005', { speed: 0.6 }),
  indigo: blobs(['rgba(40,60,160,.6)', 'rgba(20,30,100,.7)', 'rgba(90,110,210,.35)', 'rgba(10,15,60,.8)'], '#050818', { speed: 0.5 }),
  lava: blobs(['rgba(255,80,0,.8)', 'rgba(255,0,90,.7)', 'rgba(255,170,0,.6)', 'rgba(170,0,60,.7)'], '#1a0008', { speed: 1.4, blend: 'screen' }),
  suminagashi: (ctx) => ({
    draw(t, W, H) {
      ctx.fillStyle = '#f4f1ea';
      ctx.fillRect(0, 0, W, H);
      const cx = W * 0.5 + Math.sin(t * 0.05) * W * 0.1;
      const cy = H * 0.5 + Math.cos(t * 0.04) * H * 0.1;
      const m = Math.hypot(W, H);
      for (let i = 0; i < 26; i++) {
        const r = ((i * 42 + t * 6) % (m * 0.75));
        ctx.beginPath();
        for (let a = 0; a <= TAU + 0.01; a += 0.05) {
          const wob = Math.sin(a * 3 + t * 0.2 + i) * 14 + Math.sin(a * 7 - t * 0.15) * 6;
          const x = cx + Math.cos(a) * (r + wob);
          const y = cy + Math.sin(a) * (r + wob) * 0.85;
          a === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.strokeStyle = i % 3 === 0 ? 'rgba(30,40,70,.55)' : 'rgba(30,40,70,.18)';
        ctx.lineWidth = i % 3 === 0 ? 2.5 : 1;
        ctx.stroke();
      }
    },
  }),
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
};

// Small static previews for the picker.
export function previewAnimated(id, canvas) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const p = (PAINTERS[id] || PAINTERS.aurora)(ctx, W, H);
  p.draw(id === 'starfield' ? 0 : 3, W, H);
  if (id === 'starfield') for (let i = 0; i < 60; i++) p.draw(i * 0.016, W, H);
}
