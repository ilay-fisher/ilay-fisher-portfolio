import { describe, expect, it } from 'vitest';
import {
  classifyTarget,
  cursorShape,
  initialCursor,
  reduceCursor,
  rotationTarget,
  shouldHug,
} from './cursor';

function el(html: string): Element {
  const host = document.createElement('div');
  host.innerHTML = html;
  document.body.appendChild(host);
  return host.firstElementChild as Element;
}

describe('classifyTarget', () => {
  it('hugs links, buttons and ARIA buttons, also through their children', () => {
    expect(classifyTarget(el('<a href="#x">x</a>')).mode).toBe('hug');
    const b = el('<button><span id="in">go</span></button>');
    const t = classifyTarget(b.querySelector('#in'));
    expect(t.mode).toBe('hug');
    expect(t.element).toBe(b);
    expect(classifyTarget(el('<div role="button">x</div>')).mode).toBe('hug');
    expect(classifyTarget(el('<input type="checkbox" />')).mode).toBe('hug');
  });
  it('treats text fields as text and plain content as default', () => {
    expect(classifyTarget(el('<input type="text" />')).mode).toBe('text');
    expect(classifyTarget(el('<textarea></textarea>')).mode).toBe('text');
    expect(classifyTarget(el('<p>hello</p>')).mode).toBe('default');
    expect(classifyTarget(null).mode).toBe('default');
  });
  it('reads the data-cursor contract: a word is a verb, the label can be overridden', () => {
    const drag = classifyTarget(el('<div data-cursor="drag"><i id="k"></i></div>'));
    expect(drag).toMatchObject({ mode: 'verb', label: 'drag' });
    const custom = classifyTarget(el('<div data-cursor="throw" data-cursor-label="toss">x</div>'));
    expect(custom).toMatchObject({ mode: 'verb', label: 'toss' });
  });
  it('reserved values pick a mode: hug, none, text, default', () => {
    expect(classifyTarget(el('<div data-cursor="hug">x</div>')).mode).toBe('hug');
    expect(classifyTarget(el('<a href="#" data-cursor="none">x</a>')).mode).toBe('hidden');
    expect(classifyTarget(el('<div data-cursor="text">x</div>')).mode).toBe('text');
    expect(classifyTarget(el('<a href="#" data-cursor="default">x</a>')).mode).toBe('default');
  });
  it('the nearest data-cursor wins over an outer one', () => {
    const outer = el('<div data-cursor="drag"><button id="b">x</button></div>');
    expect(classifyTarget(outer.querySelector('#b')).mode).toBe('hug');
    const inner = el('<div data-cursor="drag"><div data-cursor="flip" id="i">x</div></div>');
    expect(classifyTarget(inner.querySelector('#i')).label).toBe('flip');
  });
});

describe('shouldHug', () => {
  it('hugs controls and chips but not large cards or stages', () => {
    expect(shouldHug({ width: 140, height: 44 })).toBe(true);
    expect(shouldHug({ width: 640, height: 40 })).toBe(true);
    expect(shouldHug({ width: 900, height: 600 })).toBe(false);
    expect(shouldHug({ width: 0, height: 0 })).toBe(false);
  });
});

describe('reduceCursor (state machine)', () => {
  const link = { mode: 'hug' as const, label: null, element: null };
  it('starts hidden: the native cursor stays until the first real pointer move', () => {
    expect(initialCursor.visible).toBe(false);
  });
  it('shows on a mouse move and carries the target', () => {
    const s = reduceCursor(initialCursor, { type: 'move', pointerType: 'mouse', target: link });
    expect(s).toMatchObject({ visible: true, mode: 'hug', pressed: false });
  });
  it('never shows for touch', () => {
    const s = reduceCursor(initialCursor, { type: 'move', pointerType: 'touch', target: link });
    expect(s.visible).toBe(false);
  });
  it('press and release toggle recoil, only while visible', () => {
    const shown = reduceCursor(initialCursor, { type: 'move', pointerType: 'mouse', target: link });
    const down = reduceCursor(shown, { type: 'down' });
    expect(down.pressed).toBe(true);
    expect(reduceCursor(down, { type: 'up' }).pressed).toBe(false);
    expect(reduceCursor(initialCursor, { type: 'down' }).pressed).toBe(false);
  });
  it('hides on leave and when the window loses the pointer, and clears the press', () => {
    const shown = reduceCursor(initialCursor, { type: 'move', pointerType: 'mouse', target: link });
    const down = reduceCursor(shown, { type: 'down' });
    const gone = reduceCursor(down, { type: 'leave' });
    expect(gone).toMatchObject({ visible: false, pressed: false });
  });
  it('a hidden-mode target (data-cursor="none") keeps the state but hides the ring', () => {
    const s = reduceCursor(initialCursor, {
      type: 'move',
      pointerType: 'mouse',
      target: { mode: 'hidden', label: null, element: null },
    });
    expect(s.mode).toBe('hidden');
  });
});

describe('cursorShape', () => {
  const rect = { left: 100, top: 50, width: 120, height: 44 };
  it('is a small round ring centred on the pointer by default', () => {
    const s = cursorShape({
      mode: 'default',
      pointer: { x: 10, y: 20 },
      rect: null,
      pressed: false,
    });
    expect(s).toMatchObject({ x: 10, y: 20, w: 34, h: 34, radius: 17 });
    expect(s.ringOpacity).toBe(1);
  });
  it('recoils (contracts) on press', () => {
    const rest = cursorShape({
      mode: 'default',
      pointer: { x: 0, y: 0 },
      rect: null,
      pressed: false,
    });
    const down = cursorShape({
      mode: 'default',
      pointer: { x: 0, y: 0 },
      rect: null,
      pressed: true,
    });
    expect(down.w).toBeLessThan(rest.w);
    expect(down.coreScale).toBeLessThan(rest.coreScale);
  });
  it('hugs the element: centred on it (with a small lean to the pointer), padded, rounded', () => {
    const s = cursorShape({
      mode: 'hug',
      pointer: { x: 160, y: 72 },
      rect,
      elementRadius: 999,
      pressed: false,
    });
    expect(s.x).toBe(160);
    expect(s.y).toBe(72);
    expect(s.w).toBe(120 + 16);
    expect(s.h).toBe(44 + 16);
    expect(s.radius).toBe((44 + 16) / 2);
  });
  it('leans a little toward the pointer but never leaves the element', () => {
    const s = cursorShape({
      mode: 'hug',
      pointer: { x: 1000, y: 1000 },
      rect,
      elementRadius: 12,
      pressed: false,
    });
    expect(s.x).toBeGreaterThan(160);
    expect(s.x).toBeLessThan(160 + 12);
    expect(s.radius).toBe(12 + 8);
  });
  it('contracts the hugged shape on press', () => {
    const base = { mode: 'hug' as const, pointer: { x: 160, y: 72 }, rect, elementRadius: 12 };
    expect(cursorShape({ ...base, pressed: true }).w).toBeLessThan(
      cursorShape({ ...base, pressed: false }).w,
    );
  });
  it('falls back to the default ring when hug has no rect', () => {
    const s = cursorShape({ mode: 'hug', pointer: { x: 3, y: 4 }, rect: null, pressed: false });
    expect(s.w).toBe(34);
  });
  it('verb mode opens a larger ring and shows the label', () => {
    const s = cursorShape({ mode: 'verb', pointer: { x: 0, y: 0 }, rect: null, pressed: false });
    expect(s.w).toBeGreaterThan(34);
    expect(s.labelOpacity).toBe(1);
  });
  it('hides the ring over text fields and when hidden, leaving the native caret', () => {
    for (const mode of ['text', 'hidden'] as const) {
      const s = cursorShape({ mode, pointer: { x: 0, y: 0 }, rect: null, pressed: false });
      expect(s.ringOpacity).toBe(0);
      expect(s.coreScale).toBe(0);
    }
  });
});

describe('rotationTarget', () => {
  it('leans with horizontal speed in the default ring and is clamped', () => {
    expect(rotationTarget('default', 300)).toBeGreaterThan(0);
    expect(rotationTarget('default', -300)).toBeLessThan(0);
    expect(Math.abs(rotationTarget('default', 1e6))).toBeLessThanOrEqual(30);
  });
  it('squares up when hugging a control', () => {
    expect(rotationTarget('hug', 500)).toBe(0);
  });
});
