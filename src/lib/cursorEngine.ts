import {
  classifyTarget,
  cursorShape,
  initialCursor,
  reduceCursor,
  rotationTarget,
  shouldHug,
  type CursorEvent,
  type CursorState,
  type CursorTarget,
} from './cursor';
import { isAtRest, springStep, SPRING_SNAPPY, type SpringConfig, type SpringState } from './spring';

/** The DOM nodes the engine drives (rendered by the PageFx component). */
export interface CursorNodes {
  root: HTMLElement;
  ring: HTMLElement;
  ticks: HTMLElement;
  core: HTMLElement;
  label: HTMLElement;
}

const FOLLOW: SpringConfig = { stiffness: 320, damping: 27 };
const ROTATE: SpringConfig = { stiffness: 140, damping: 14 };
const FADE: SpringConfig = { stiffness: 380, damping: 36 };

type Key = 'x' | 'y' | 'w' | 'h' | 'r' | 'core' | 'ring' | 'label' | 'ticks' | 'rot';
const CONFIG: Record<Key, SpringConfig> = {
  x: FOLLOW,
  y: FOLLOW,
  w: SPRING_SNAPPY,
  h: SPRING_SNAPPY,
  r: SPRING_SNAPPY,
  core: SPRING_SNAPPY,
  ring: FADE,
  label: FADE,
  ticks: FADE,
  rot: ROTATE,
};

/**
 * Starts the cursor: one pointer listener set and a single rAF loop that runs only while the
 * cursor is visible or still settling. The ring's width, height and radius are written per frame
 * on a fixed, contained element (the one documented exception to "transform and opacity only",
 * because a hugging ring must follow the control's rounded rectangle exactly).
 * Returns a cleanup. The native cursor is hidden (`html.has-cursor`) only after the first real
 * mouse move, and is restored on leave and cleanup. Never intercepts events.
 */
export function startCursor(nodes: CursorNodes): () => void {
  const html = document.documentElement;
  let state: CursorState = initialCursor;
  const pointer = { x: -100, y: -100 };
  let lastX = pointer.x;
  let vx = 0;
  let target: CursorTarget = { mode: 'default', label: null, element: null };
  let elementRadius = 12;
  let raf = 0;
  let lastT = 0;
  let placed = false;
  let shownLabel = '';

  const springs = {} as Record<Key, SpringState>;
  (Object.keys(CONFIG) as Key[]).forEach((k) => (springs[k] = { x: 0, v: 0 }));

  const send = (e: CursorEvent) => {
    state = reduceCursor(state, e);
  };

  const setTarget = (el: Element | null) => {
    const next = classifyTarget(el);
    if (next.element === target.element && next.mode === target.mode) return;
    target = next;
    if (next.mode === 'hug' && next.element) {
      const radius = parseFloat(getComputedStyle(next.element).borderTopLeftRadius);
      elementRadius = Number.isFinite(radius) ? radius : 12;
    }
  };

  const frame = (t: number) => {
    raf = 0;
    const dt = lastT ? (t - lastT) / 1000 : 0;
    lastT = t;

    let mode = state.mode;
    let rect: DOMRect | null = null;
    if (mode === 'hug' && state.element?.isConnected) {
      rect = state.element.getBoundingClientRect();
      if (!shouldHug(rect)) {
        mode = 'default';
        rect = null;
      }
    } else if (mode === 'hug') {
      mode = 'default';
    }
    const shape = cursorShape({
      mode,
      pointer,
      rect,
      elementRadius,
      pressed: state.pressed,
    });
    const visible = state.visible;
    const goals: Record<Key, number> = {
      x: shape.x,
      y: shape.y,
      w: shape.w,
      h: shape.h,
      r: shape.radius,
      core: visible ? shape.coreScale : 0,
      ring: visible ? shape.ringOpacity : 0,
      label: visible ? shape.labelOpacity : 0,
      ticks: visible && (mode === 'default' || mode === 'verb') ? 1 : 0,
      rot: rotationTarget(mode, vx),
    };
    if (!placed && visible) {
      // first appearance: start at the pointer instead of flying in from the corner
      springs.x = { x: shape.x, v: 0 };
      springs.y = { x: shape.y, v: 0 };
      springs.w = { x: shape.w, v: 0 };
      springs.h = { x: shape.h, v: 0 };
      springs.r = { x: shape.radius, v: 0 };
      placed = true;
    }
    if (!visible) placed = false;

    let moving = visible;
    (Object.keys(CONFIG) as Key[]).forEach((k) => {
      springs[k] = springStep(springs[k], goals[k], dt, CONFIG[k]);
      if (!isAtRest(springs[k], goals[k], k === 'rot' ? 0.05 : 0.02)) moving = true;
    });
    vx *= 0.85;

    const { x, y, w, h, r } = {
      x: springs.x.x,
      y: springs.y.x,
      w: Math.max(0, springs.w.x),
      h: Math.max(0, springs.h.x),
      r: Math.max(0, springs.r.x),
    };
    const place = `translate3d(${(x - w / 2).toFixed(2)}px, ${(y - h / 2).toFixed(2)}px, 0) rotate(${springs.rot.x.toFixed(2)}deg)`;
    for (const el of [nodes.ring, nodes.ticks]) {
      el.style.width = `${w.toFixed(2)}px`;
      el.style.height = `${h.toFixed(2)}px`;
      el.style.transform = place;
    }
    nodes.ring.style.borderRadius = `${r.toFixed(2)}px`;
    nodes.ring.style.opacity = String(Math.max(0, Math.min(1, springs.ring.x)));
    nodes.ticks.style.opacity = String(Math.max(0, Math.min(1, springs.ticks.x)));
    nodes.core.style.transform = `translate3d(${pointer.x.toFixed(2)}px, ${pointer.y.toFixed(2)}px, 0) scale(${Math.max(0, springs.core.x).toFixed(3)})`;
    nodes.label.style.transform = `translate3d(${(x + (w / 2) * 0.72 + 8).toFixed(2)}px, ${(y + (h / 2) * 0.72 + 8).toFixed(2)}px, 0)`;
    nodes.label.style.opacity = String(Math.max(0, Math.min(1, springs.label.x)));
    nodes.root.dataset.visible = String(visible);
    nodes.root.dataset.mode = mode;
    nodes.root.dataset.pressed = String(state.pressed);
    const text = state.label ?? '';
    if (text && text !== shownLabel) {
      shownLabel = text;
      nodes.label.textContent = text;
    }

    if (moving) raf = requestAnimationFrame(frame);
    else lastT = 0;
  };
  const wake = () => {
    if (!raf) raf = requestAnimationFrame(frame);
  };

  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    if (!state.visible) html.classList.add('has-cursor');
    vx = vx * 0.6 + (e.clientX - lastX) * 60 * 0.4;
    lastX = e.clientX;
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    setTarget(e.target instanceof Element ? e.target : null);
    send({ type: 'move', pointerType: e.pointerType, target });
    wake();
  };
  const onDown = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    send({ type: 'down' });
    wake();
  };
  const onUp = () => {
    send({ type: 'up' });
    wake();
  };
  const onLeave = () => {
    send({ type: 'leave' });
    html.classList.remove('has-cursor');
    wake();
  };
  const onTouch = () => {
    // a touch after mouse use: give the native behaviour back
    if (state.visible) onLeave();
  };

  document.addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('pointerdown', onDown, { passive: true });
  document.addEventListener('pointerup', onUp, { passive: true });
  document.addEventListener('pointercancel', onUp, { passive: true });
  document.documentElement.addEventListener('pointerleave', onLeave);
  document.addEventListener('touchstart', onTouch, { passive: true });
  window.addEventListener('blur', onLeave);

  return () => {
    cancelAnimationFrame(raf);
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerdown', onDown);
    document.removeEventListener('pointerup', onUp);
    document.removeEventListener('pointercancel', onUp);
    document.documentElement.removeEventListener('pointerleave', onLeave);
    document.removeEventListener('touchstart', onTouch);
    window.removeEventListener('blur', onLeave);
    html.classList.remove('has-cursor');
  };
}
