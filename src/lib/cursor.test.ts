import { describe, expect, it } from 'vitest';
import { classifyTarget, cursorShape, springStep } from './cursor';

function el(html: string): Element {
  const host = document.createElement('div');
  host.innerHTML = html;
  document.body.appendChild(host);
  return host.firstElementChild as Element;
}

describe('classifyTarget', () => {
  it('treats links, buttons and roles as interactive, also through children', () => {
    expect(classifyTarget(el('<a href="#x">x</a>'))).toBe('interactive');
    expect(classifyTarget(el('<button><span id="in">go</span></button>').querySelector('#in'))).toBe(
      'interactive',
    );
    expect(classifyTarget(el('<div role="button">x</div>'))).toBe('interactive');
    expect(classifyTarget(el('<div data-cursor="interactive">x</div>'))).toBe('interactive');
  });
  it('treats form text fields as text and everything else as default', () => {
    expect(classifyTarget(el('<input type="text" />'))).toBe('text');
    expect(classifyTarget(el('<textarea></textarea>'))).toBe('text');
    expect(classifyTarget(el('<p>hello</p>'))).toBe('default');
    expect(classifyTarget(null)).toBe('default');
  });
});

describe('springStep', () => {
  const cfg = { stiffness: 220, damping: 22 };
  it('converges on the target and stops', () => {
    let s = { x: 0, v: 0 };
    for (let i = 0; i < 240; i++) s = springStep(s, 100, 1 / 60, cfg);
    expect(s.x).toBeCloseTo(100, 1);
    expect(Math.abs(s.v)).toBeLessThan(0.01);
  });
  it('is a no-op when already at rest on the target', () => {
    expect(springStep({ x: 5, v: 0 }, 5, 1 / 60, cfg)).toEqual({ x: 5, v: 0 });
  });
  it('stays finite after a long frame (tab restored) by clamping dt', () => {
    const s = springStep({ x: 0, v: 0 }, 100, 5, cfg);
    expect(Number.isFinite(s.x)).toBe(true);
    expect(Math.abs(s.x)).toBeLessThan(200);
  });
  it('overshoots slightly when under-damped, which is the soft feel', () => {
    let s = { x: 0, v: 0 };
    let max = 0;
    for (let i = 0; i < 120; i++) {
      s = springStep(s, 100, 1 / 60, { stiffness: 300, damping: 16 });
      max = Math.max(max, s.x);
    }
    expect(max).toBeGreaterThan(100);
  });
});

describe('cursorShape', () => {
  const rect = { left: 100, top: 50, width: 120, height: 44 };
  it('is a small round dot by default, centred on the pointer', () => {
    const s = cursorShape({ kind: 'default', pointer: { x: 10, y: 20 }, rect: null, pressed: false });
    expect(s).toMatchObject({ x: 10, y: 20, w: 18, h: 18, radius: 9 });
  });
  it('shrinks while pressed', () => {
    const s = cursorShape({ kind: 'default', pointer: { x: 0, y: 0 }, rect: null, pressed: true });
    expect(s.w).toBeLessThan(18);
  });
  it('morphs into the hovered element: centred on it, padded, rounded to a pill when tall radius', () => {
    const s = cursorShape({
      kind: 'interactive',
      pointer: { x: 0, y: 0 },
      rect,
      pressed: false,
      radius: 999,
    });
    expect(s.x).toBe(160);
    expect(s.y).toBe(72);
    expect(s.w).toBe(120 + 16);
    expect(s.h).toBe(44 + 16);
    expect(s.radius).toBe((44 + 16) / 2);
  });
  it('grows into a larger soft ring over interactive elements with no rect', () => {
    const s = cursorShape({ kind: 'interactive', pointer: { x: 3, y: 4 }, rect: null, pressed: false });
    expect(s.w).toBeGreaterThan(18);
    expect(s.x).toBe(3);
  });
  it('becomes a thin caret over text fields', () => {
    const s = cursorShape({ kind: 'text', pointer: { x: 0, y: 0 }, rect: null, pressed: false });
    expect(s.w).toBeLessThan(s.h);
  });
});
