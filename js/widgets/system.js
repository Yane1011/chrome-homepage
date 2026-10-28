// CPU and memory of this computer, via chrome.system.*.
import { h } from '../util.js';
import { card, sparkline, meter } from './common.js';

const HISTORY = 40;
const gb = (n) => (n / 1024 ** 3).toFixed(1) + ' GB';

export function cpu() {
  const body = h('div', { class: 'sys-body' });
  const el = card('cpu', 'CPU', body);
  if (typeof chrome === 'undefined' || !chrome.system?.cpu) {
    body.append(h('p', { class: 'widget-msg' }, 'CPU info isn’t available in this browser.'));
    return el;
  }
  let prev = null;
  const hist = [];
  let info = null;
  const sample = async () => {
    info = await chrome.system.cpu.getInfo();
    const cur = info.processors.map((p) => p.usage);
    if (prev) {
      const per = cur.map((u, i) => {
        const dt = u.total - prev[i].total;
        return dt > 0 ? 1 - (u.idle - prev[i].idle) / dt : 0;
      });
      const avg = per.reduce((a, b) => a + b, 0) / per.length;
      hist.push(avg * 100);
      if (hist.length > HISTORY) hist.shift();
      draw(avg, per);
    } else draw(null, []);
    prev = cur;
  };
  const draw = (avg, per) => {
    const model = (info.modelName || '').replace(/\(R\)|\(TM\)|CPU|@.*$/gi, '').replace(/\s+/g, ' ').trim();
    body.replaceChildren(...[
      h('div', { class: 'sys-big' }, h('b', {}, avg == null ? '…' : `${Math.round(avg * 100)}%`), h('span', {}, `${info.numOfProcessors} cores · ${info.archName.replace(/_/g, '-')}`)),
      hist.length > 1 ? sparkline(hist, { min: 0, max: 100 }) : h('div', { class: 'spark-placeholder' }),
      per.length ? h('div', { class: 'cores' }, per.map((p, i) => h('span', { class: 'core', title: `Core ${i + 1}: ${Math.round(p * 100)}%` }, h('i', { style: { height: Math.max(4, p * 100) + '%' } })))) : null,
      model ? h('p', { class: 'widget-sub' }, model) : null,
    ].filter(Boolean));
  };
  sample();
  let n = 0;
  el._tick = () => {
    if (++n % 2 === 0) sample();
  };
  return el;
}

export function memory() {
  const body = h('div', { class: 'sys-body' });
  const el = card('memory', 'Memory', body);
  if (typeof chrome === 'undefined' || !chrome.system?.memory) {
    body.append(h('p', { class: 'widget-msg' }, 'Memory info isn’t available in this browser.'));
    return el;
  }
  const hist = [];
  const sample = async () => {
    const m = await chrome.system.memory.getInfo();
    const used = m.capacity - m.availableCapacity;
    const pct = (used / m.capacity) * 100;
    hist.push(pct);
    if (hist.length > HISTORY) hist.shift();
    body.replaceChildren(
      h('div', { class: 'sys-big' }, h('b', {}, `${Math.round(pct)}%`), h('span', {}, `${gb(used)} of ${gb(m.capacity)} used`)),
      meter(pct),
      hist.length > 1 ? sparkline(hist, { min: 0, max: 100 }) : h('div', { class: 'spark-placeholder' }),
      h('p', { class: 'widget-sub' }, `${gb(m.availableCapacity)} free`),
    );
  };
  sample();
  let n = 0;
  el._tick = () => {
    if (++n % 3 === 0) sample();
  };
  return el;
}
