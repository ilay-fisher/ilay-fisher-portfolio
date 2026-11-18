import { magnetPull } from './magnetic';
import { isAtRest, springStep, SPRING_SNAPPY, type SpringState } from './spring';

const SELECTOR = '[data-magnetic]';
const RANGE = 44;
const STRENGTH = 0.28;
const MAX = 9;

interface Item {
  el: HTMLElement;
  x: SpringState;
  y: SpringState;
  tx: number;
  ty: number;
}

/**
 * Magnetic pull for every `[data-magnetic]` element: when a mouse comes within its field the
 * element leans toward it on a spring and settles back on release. Uses the independent
 * `translate` property so it never fights the press squash (`scale`) or other transforms.
 * One delegated listener and one rAF loop that sleeps when everything is at rest. Returns a cleanup.
 */
export function startMagnetic(): () => void {
  const items = new Map<HTMLElement, Item>();
  let raf = 0;
  let last = 0;

  const itemFor = (el: HTMLElement): Item => {
    let it = items.get(el);
    if (!it) {
      it = { el, x: { x: 0, v: 0 }, y: { x: 0, v: 0 }, tx: 0, ty: 0 };
      items.set(el, it);
    }
    return it;
  };

  const frame = (t: number) => {
    raf = 0;
    const dt = last ? (t - last) / 1000 : 0;
    last = t;
    let busy = false;
    for (const it of items.values()) {
      it.x = springStep(it.x, it.tx, dt, SPRING_SNAPPY);
      it.y = springStep(it.y, it.ty, dt, SPRING_SNAPPY);
      const rest = isAtRest(it.x, it.tx, 0.02) && isAtRest(it.y, it.ty, 0.02);
      if (rest && it.tx === 0 && it.ty === 0) {
        it.el.style.removeProperty('translate');
        items.delete(it.el);
        continue;
      }
      it.el.style.translate = `${it.x.x.toFixed(2)}px ${it.y.x.toFixed(2)}px`;
      if (!rest) busy = true;
    }
    if (busy) raf = requestAnimationFrame(frame);
    else last = 0;
  };
  const wake = () => {
    if (!raf) raf = requestAnimationFrame(frame);
  };

  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    const near = document.querySelectorAll<HTMLElement>(SELECTOR);
    near.forEach((el) => {
      const r = el.getBoundingClientRect();
      const off = magnetPull({
        dx: e.clientX - (r.left + r.width / 2),
        dy: e.clientY - (r.top + r.height / 2),
        halfW: r.width / 2,
        halfH: r.height / 2,
        range: RANGE,
        strength: STRENGTH,
        max: MAX,
      });
      if (off.x === 0 && off.y === 0 && !items.has(el)) return;
      const it = itemFor(el);
      it.tx = off.x;
      it.ty = off.y;
    });
    wake();
  };
  const release = () => {
    for (const it of items.values()) {
      it.tx = 0;
      it.ty = 0;
    }
    wake();
  };

  document.addEventListener('pointermove', onMove, { passive: true });
  document.documentElement.addEventListener('pointerleave', release);
  window.addEventListener('blur', release);
  return () => {
    cancelAnimationFrame(raf);
    document.removeEventListener('pointermove', onMove);
    document.documentElement.removeEventListener('pointerleave', release);
    window.removeEventListener('blur', release);
    for (const it of items.values()) it.el.style.removeProperty('translate');
    items.clear();
  };
}
