/**
 * Pure logic for the signature cursor: what the pointer is over (`classifyTarget`), the
 * show/hide/press state machine (`reduceCursor`) and the ring's shape (`cursorShape`). The DOM
 * engine in `cursorEngine.ts` only measures, calls these and writes styles.
 *
 * Contract for feature authors (see docs/DESIGN.md section 6 and docs/CONTRACTS.md):
 *   data-cursor="drag"                  a word: the ring opens and shows that verb
 *   data-cursor="drag" data-cursor-label="toss"   overrides the label text
 *   data-cursor="hug" | "none" | "text" | "default"   reserved values pick a mode
 * Links, buttons, ARIA buttons and checkboxes hug automatically.
 */

export type CursorMode = 'default' | 'hug' | 'verb' | 'text' | 'hidden';

/** What the pointer is over, as the cursor sees it. */
export interface CursorTarget {
  mode: CursorMode;
  label: string | null;
  /** The element to hug, or the element that carries the data-cursor attribute. */
  element: Element | null;
}

const DEFAULT_TARGET: CursorTarget = { mode: 'default', label: null, element: null };

const NON_TEXT_INPUTS = new Set([
  'checkbox',
  'radio',
  'button',
  'submit',
  'reset',
  'range',
  'file',
  'image',
  'color',
]);

function interactiveMode(el: Element): CursorMode | null {
  const tag = el.tagName.toLowerCase();
  if (tag === 'textarea' || el.getAttribute('contenteditable') === 'true') return 'text';
  if (tag === 'input') {
    const type = (el.getAttribute('type') ?? 'text').toLowerCase();
    return NON_TEXT_INPUTS.has(type) ? 'hug' : 'text';
  }
  if (tag === 'select') return 'text';
  if (tag === 'button' || tag === 'summary') return 'hug';
  if (tag === 'a' && el.hasAttribute('href')) return 'hug';
  if (el.getAttribute('role') === 'button') return 'hug';
  return null;
}

/** Walks up from `start` and returns the first rule that applies (nearest wins). */
export function classifyTarget(start: Element | null): CursorTarget {
  for (let el: Element | null = start; el; el = el.parentElement) {
    const attr = el.getAttribute('data-cursor');
    if (attr !== null) {
      const value = attr.trim().toLowerCase();
      if (value === 'none') return { mode: 'hidden', label: null, element: el };
      if (value === 'text') return { mode: 'text', label: null, element: el };
      if (value === 'default' || value === '') return { ...DEFAULT_TARGET, element: el };
      if (value === 'hug') return { mode: 'hug', label: null, element: el };
      return {
        mode: 'verb',
        label: el.getAttribute('data-cursor-label')?.trim() || value,
        element: el,
      };
    }
    const mode = interactiveMode(el);
    if (mode) return { mode, label: null, element: el };
  }
  return DEFAULT_TARGET;
}

/** Controls and chips are hugged; big cards and stages are not (the ring would swallow them). */
export function shouldHug(size: { width: number; height: number }): boolean {
  return size.width > 0 && size.height > 0 && size.height <= 160 && size.width <= 800;
}

/** Cursor state: visibility, what is under the pointer and whether a button is held. */
export interface CursorState {
  visible: boolean;
  mode: CursorMode;
  label: string | null;
  element: Element | null;
  pressed: boolean;
}

export const initialCursor: CursorState = {
  visible: false,
  mode: 'default',
  label: null,
  element: null,
  pressed: false,
};

export type CursorEvent =
  | { type: 'move'; pointerType: string; target: CursorTarget }
  | { type: 'down' }
  | { type: 'up' }
  | { type: 'leave' };

/** Pure transition. Touch and pen never show the cursor; it stays hidden until a real mouse move. */
export function reduceCursor(state: CursorState, event: CursorEvent): CursorState {
  switch (event.type) {
    case 'move':
      if (event.pointerType !== 'mouse') return state;
      return {
        ...state,
        visible: true,
        mode: event.target.mode,
        label: event.target.label,
        element: event.target.element,
      };
    case 'down':
      return state.visible ? { ...state, pressed: true } : state;
    case 'up':
      return state.pressed ? { ...state, pressed: false } : state;
    case 'leave':
      return { ...state, visible: false, pressed: false };
  }
}

/** Target geometry of the ring, in viewport px. `x`,`y` is its centre. */
export interface CursorShape {
  x: number;
  y: number;
  w: number;
  h: number;
  radius: number;
  coreScale: number;
  ringOpacity: number;
  labelOpacity: number;
}

export interface ShapeInput {
  mode: CursorMode;
  pointer: { x: number; y: number };
  rect: { left: number; top: number; width: number; height: number } | null;
  elementRadius?: number;
  pressed: boolean;
}

const RING = 34;
const VERB_RING = 68;
const HUG_PAD = 16;
const LEAN = 0.18;
const LEAN_MAX = 8;
const clamp = (v: number, lim: number) => Math.max(-lim, Math.min(lim, v));

/** Where the ring wants to be and how big. The engine springs the real ring toward this. */
export function cursorShape(i: ShapeInput): CursorShape {
  const { mode, pointer, rect, pressed } = i;
  if (mode === 'text' || mode === 'hidden') {
    return {
      x: pointer.x,
      y: pointer.y,
      w: RING,
      h: RING,
      radius: RING / 2,
      coreScale: 0,
      ringOpacity: 0,
      labelOpacity: 0,
    };
  }
  if (mode === 'hug' && rect) {
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const squeeze = pressed ? 6 : 0;
    const w = rect.width + HUG_PAD - squeeze;
    const h = rect.height + HUG_PAD - squeeze;
    const elementRadius = i.elementRadius ?? 12;
    return {
      x: cx + clamp((pointer.x - cx) * LEAN, LEAN_MAX),
      y: cy + clamp((pointer.y - cy) * LEAN, LEAN_MAX),
      w,
      h,
      radius: Math.min(elementRadius + HUG_PAD / 2, Math.min(w, h) / 2),
      coreScale: pressed ? 0.5 : 0.8,
      ringOpacity: 1,
      labelOpacity: 0,
    };
  }
  const base = mode === 'verb' ? VERB_RING : RING;
  const size = pressed ? base - 8 : base;
  return {
    x: pointer.x,
    y: pointer.y,
    w: size,
    h: size,
    radius: size / 2,
    coreScale: pressed ? 0.55 : 1,
    ringOpacity: 1,
    labelOpacity: mode === 'verb' ? 1 : 0,
  };
}

const MAX_ROTATION = 30;

/** Ring tilt in degrees: it leans with horizontal speed, and squares up while hugging. */
export function rotationTarget(mode: CursorMode, vx: number): number {
  if (mode !== 'default' && mode !== 'verb') return 0;
  return Math.max(-MAX_ROTATION, Math.min(MAX_ROTATION, vx * 0.05));
}
