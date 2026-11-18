import { springStep, type SpringState } from '../../../lib/spring';
import {
  FACE_Y,
  IDLE_AFTER,
  LOOK_SPRING,
  avatarPose,
  indexToLook,
  initIdle,
  lookRange,
  lookToIndex,
  nearestIndex,
  blendFrames,
  pointerToLook,
  pointerToPitch,
  pointerToYaw,
  scrollToLook,
  stepIdle,
} from './avatarLogic';
import {
  blinkDuration,
  blinkPosition,
  eyeMatrix,
  initBlink,
  mulberry32,
  pickBlinkSet,
  stepBlink,
  type BlinkState,
} from './blinkLogic';
import type { AvatarFrames, BlinkAssets } from './avatarLoader';

export interface AvatarEngineOptions {
  /** The avatar stage: receives `data-frame` and is observed for visibility. */
  stage: HTMLElement;
  canvas: HTMLCanvasElement;
  frames: AvatarFrames;
  count: number;
  neutral: number;
  /** The frame closest to the still, where the head starts before turning to face the visitor. */
  stillIndex: number;
  /** Draw only the neutral frame, no listeners, no loop. */
  reduced: boolean;
  /** Called after the first frame is on the canvas. */
  onReady: () => void;
  /** Lid patches cut from real blink footage. Without them the head simply does not blink. */
  blinks?: BlinkAssets | null;
  /** Seed for the blink scheduler (tests); random by default. */
  seed?: number;
  /**
   * Test hook (`?avatarBlink=manual`): no blink is ever scheduled by the clock. One starts, as soon as a recorded blink
   * is in reach of the head angle, only after a `avatar:blink` event on window; there are no doubles.
   */
  blinkManual?: boolean;
}

const TAP_HOLD = 1800;

/**
 * Draws the head-turn onto a canvas. One rAF loop, only while the avatar is on screen. The head is a spring (the
 * site's soft spring) chasing a `look` target: the pointer anywhere on the page on a fine pointer; on touch, the
 * last tap, plus a gentle drift with scroll progress; and, after the pointer has been still for a while, an idle
 * glance around. Frames between two stored frames are cross-faded by the fractional index, so the turn never steps.
 * The tilt and parallax are written as one transform on the canvas.
 *
 * Blinks: at irregular 3 to 7 s intervals (sometimes twice in a row) the nearest recorded blink is played over the
 * head frame: small footage patches of the lids, positioned on each eye by its tracked motion, so the lids move
 * and nothing else does. The stage reports `data-blink` (off, idle or blinking) and counts `data-blink-started` /
 * `data-blink-ended`. No blinks while reduced, off screen, or when no recorded blink is within reach of the angle.
 */
export function startAvatar(o: AvatarEngineOptions): { stop: () => void } {
  const ctx = o.canvas.getContext('2d');
  const first = o.reduced ? o.neutral : o.stillIndex;
  const size = o.frames.find(Boolean)?.naturalWidth || 512;
  o.canvas.width = size;
  o.canvas.height = size;

  const bl = o.reduced ? null : (o.blinks ?? null);
  const anchors = bl ? bl.data.sets.map((x) => x.anchor) : [];
  const reach = bl ? Math.min(...bl.data.sets.map((x) => x.reach)) : 0;
  const rng = mulberry32(o.seed ?? Math.floor(Math.random() * 4294967296));
  const manual = !!o.blinkManual;
  let manualDue = false;
  const firstBlink = (now: number): BlinkState =>
    manual ? { phase: 'wait', until: Infinity, second: false } : initBlink(now, rng);
  let blinkS: BlinkState = firstBlink(0);
  const onBlinkEvent = () => {
    manualDue = true;
  };
  if (manual) window.addEventListener('avatar:blink', onBlinkEvent);
  let active = -1;
  let blinkAt = 0;
  let started = 0;
  let ended = 0;
  o.stage.dataset.blink = bl ? 'idle' : 'off';
  o.stage.dataset.blinkStarted = '0';
  o.stage.dataset.blinkEnded = '0';

  /** Draws the lid patches of set `si` at patch position `pos` over the head frame already on the canvas. */
  const paintBlink = (index: number, si: number, pos: number) => {
    if (!ctx || !bl) return;
    const set = bl.data.sets[si];
    if (!set) return;
    const { pw, ph } = bl.data;
    const lo = Math.floor(pos);
    const f = pos - lo;
    ctx.imageSmoothingQuality = 'high';
    // source-atop: lids land only where the head is, never on the backdrop at the edge of the silhouette
    ctx.globalCompositeOperation = 'source-atop';
    for (const eye of set.eyes) {
      const m = eyeMatrix(eye.eye === 0 ? bl.data.tracks.E0 : bl.data.tracks.E1, index, set.anchor);
      ctx.setTransform(m[0], m[3], m[1], m[4], m[2], m[5]);
      ctx.globalAlpha = 1 - f;
      ctx.drawImage(bl.atlas, lo * pw, eye.row * ph, pw, ph, eye.ox, eye.oy, pw, ph);
      if (f > 0.01 && lo + 1 < set.count) {
        ctx.globalAlpha = f;
        ctx.drawImage(bl.atlas, (lo + 1) * pw, eye.row * ph, pw, ph, eye.ox, eye.oy, pw, ph);
      }
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  };

  const paint = (index: number, blinkPos: number | null = null) => {
    if (!ctx) return;
    const { a, b, t } = blendFrames(index, o.count);
    const fa = o.frames[a];
    const fb = o.frames[b];
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, size, size); // frames carry alpha: never stack on the previous paint
    if (fa && fb && t > 0.01) {
      // exact linear cross-fade of premultiplied pixels: (1 - t) * a + t * b, edges included
      ctx.globalAlpha = 1 - t;
      ctx.drawImage(fa, 0, 0, size, size);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = t;
      ctx.drawImage(fb, 0, 0, size, size);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    } else if (fa) ctx.drawImage(fa, 0, 0, size, size);
    if (blinkPos !== null && active >= 0) paintBlink(index, active, blinkPos);
  };

  if (o.reduced) {
    paint(first);
    o.stage.dataset.frame = String(first);
    o.onReady();
    return { stop: () => {} };
  }

  const fine =
    typeof window.matchMedia === 'function' && window.matchMedia('(pointer: fine)').matches;
  let lookS: SpringState = { x: indexToLook(first, o.count, o.neutral), v: 0 };
  let pitchS: SpringState = { x: 0, v: 0 };
  let px = 0;
  let py = 0;
  let havePointer = false;
  let lastInput = Number.NEGATIVE_INFINITY;
  let tapLook: number | null = null;
  let tapUntil = 0;
  let idle = initIdle(performance.now(), Math.random);
  let visible = false;
  let raf = 0;
  let last = 0;
  let drawnKey = '';
  let shownFrame = -1;
  let poseKey = '';
  let readied = false;

  const endBlink = () => {
    if (active < 0) return;
    active = -1;
    o.stage.dataset.blink = 'idle';
    o.stage.dataset.blinkEnded = String(++ended);
    drawnKey = '';
  };

  const onMove = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return;
    px = e.clientX;
    py = e.clientY;
    havePointer = true;
    lastInput = performance.now();
  };
  const onDown = (e: PointerEvent) => {
    const rect = o.stage.getBoundingClientRect();
    const range = lookRange(window.innerWidth);
    if (e.pointerType === 'touch') {
      tapLook = pointerToLook(e.clientX - (rect.left + rect.width / 2), range);
      tapUntil = performance.now() + TAP_HOLD;
    } else onMove(e);
  };
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerdown', onDown, { passive: true });

  const tick = (t: number) => {
    raf = 0;
    if (!visible) return;
    const dt = last ? (t - last) / 1000 : 0.016;
    last = t;
    const rect = o.stage.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height * FACE_Y;
    const pointerLive = fine && havePointer && t - lastInput < IDLE_AFTER;
    const idleStep = stepIdle(idle, t, pointerLive ? t : Number.NEGATIVE_INFINITY, Math.random);
    idle = idleStep.state;

    let targetLook: number;
    let targetPitch = 0;
    if (pointerLive) {
      targetLook = pointerToYaw(px - cx, py - cy);
      targetPitch = pointerToPitch(py - cy);
    } else if (!fine && tapLook !== null && t < tapUntil) {
      targetLook = tapLook;
    } else {
      const base = fine
        ? 0
        : scrollToLook((window.innerHeight - rect.top) / (window.innerHeight + rect.height));
      targetLook = Math.max(-1, Math.min(1, base + (idleStep.look ?? 0)));
    }

    lookS = springStep(lookS, targetLook, dt, LOOK_SPRING);
    pitchS = springStep(pitchS, targetPitch, dt, LOOK_SPRING);

    const index = lookToIndex(lookS.x, o.count, o.neutral);

    let blinkPos: number | null = null;
    if (bl) {
      if (manual && blinkS.phase === 'wait')
        blinkS = { phase: 'wait', until: manualDue ? 0 : Infinity, second: false };
      const step = stepBlink(blinkS, t, rng, false, pickBlinkSet(anchors, index, reach) >= 0);
      blinkS = step.state;
      if (step.started) {
        manualDue = false;
        active = pickBlinkSet(anchors, index, reach);
        blinkAt = t;
        o.stage.dataset.blink = 'blinking';
        o.stage.dataset.blinkStarted = String(++started);
      }
      if (step.ended) endBlink();
      const set = active >= 0 ? bl.data.sets[active] : undefined;
      if (set)
        blinkPos = blinkPosition(
          Math.min(t - blinkAt, blinkDuration() - 1e-3),
          set.count,
          set.closed,
        );
    }

    const key = `${Math.floor(index)}:${Math.round((index % 1) * 48)}:${active >= 0 && blinkPos !== null ? `${active}/${Math.round(blinkPos * 24)}` : ''}`;
    if (key !== drawnKey) {
      drawnKey = key;
      paint(index, blinkPos);
      if (!readied) {
        readied = true;
        o.onReady();
      }
    }
    const shown = nearestIndex(index, o.count);
    if (shown !== shownFrame) {
      shownFrame = shown;
      o.stage.dataset.frame = String(shown);
    }
    const pose = avatarPose(lookS.x, pitchS.x);
    const pk = `${pose.rx.toFixed(2)}|${pose.rz.toFixed(2)}|${pose.ty.toFixed(1)}`;
    if (pk !== poseKey) {
      poseKey = pk;
      o.canvas.style.transform = `perspective(700px) translateY(${pose.ty}px) rotateX(${pose.rx}deg) rotateZ(${pose.rz}deg) scale(var(--avatar-zoom, 1.07))`;
    }
    raf = requestAnimationFrame(tick);
  };

  const kick = () => {
    if (!raf && visible) {
      last = 0;
      raf = requestAnimationFrame(tick);
    }
  };
  const io =
    typeof IntersectionObserver === 'undefined'
      ? null
      : new IntersectionObserver((entries) => {
          visible = entries[entries.length - 1]?.isIntersecting ?? false;
          endBlink(); // never blink off screen; a fresh wait starts when he is seen again
          if (bl) blinkS = firstBlink(performance.now());
          if (visible) kick();
        });
  if (io) io.observe(o.stage);
  else {
    visible = true;
    kick();
  }

  return {
    stop() {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('avatar:blink', onBlinkEvent);
      io?.disconnect();
      endBlink();
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      visible = false;
    },
  };
}
