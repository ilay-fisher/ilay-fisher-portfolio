import { describe, expect, it } from 'vitest';
import { mapKey } from './keys';

describe('keyboard commands', () => {
  it('maps arrows to pushes, n/N to selection, space to hop, s and r', () => {
    expect(mapKey({ key: 'ArrowLeft', shiftKey: false })).toEqual({ type: 'push', dx: -1, dz: 0 });
    expect(mapKey({ key: 'ArrowRight', shiftKey: false })).toEqual({ type: 'push', dx: 1, dz: 0 });
    expect(mapKey({ key: 'ArrowUp', shiftKey: false })).toEqual({ type: 'push', dx: 0, dz: -1 });
    expect(mapKey({ key: 'ArrowDown', shiftKey: false })).toEqual({ type: 'push', dx: 0, dz: 1 });
    expect(mapKey({ key: 'n', shiftKey: false })).toEqual({ type: 'select', dir: 1 });
    expect(mapKey({ key: 'N', shiftKey: true })).toEqual({ type: 'select', dir: -1 });
    expect(mapKey({ key: ' ', shiftKey: false })).toEqual({ type: 'hop' });
    // Enter opens the selected project piece (or hops when it has no section to open).
    expect(mapKey({ key: 'Enter', shiftKey: false })).toEqual({ type: 'activate' });
    expect(mapKey({ key: 's', shiftKey: false })).toEqual({ type: 'shuffle' });
    expect(mapKey({ key: 'R', shiftKey: true })).toEqual({ type: 'reset' });
  });
  it('leaves Tab, Escape and unknown keys alone so focus can move on', () => {
    expect(mapKey({ key: 'Tab', shiftKey: false })).toBeNull();
    expect(mapKey({ key: 'Escape', shiftKey: false })).toBeNull();
    expect(mapKey({ key: 'x', shiftKey: false })).toBeNull();
  });
  it('does not hijack browser shortcuts', () => {
    expect(mapKey({ key: 'r', shiftKey: false, metaKey: true })).toBeNull();
    expect(mapKey({ key: 's', shiftKey: false, ctrlKey: true })).toBeNull();
  });
});
