import { describe, expect, it } from 'vitest';
import { IndexedHeap } from './heap';
import { mulberry32 } from './rng';

describe('IndexedHeap', () => {
  it('pops in (k1, k2) order', () => {
    const h = new IndexedHeap(10);
    h.set(0, 5, 0);
    h.set(1, 2, 9);
    h.set(2, 2, 1);
    h.set(3, 7, 0);
    const out: number[] = [];
    while (h.size > 0) {
      const t = h.top();
      out.push(t);
      h.remove(t);
    }
    expect(out).toEqual([2, 1, 0, 3]);
  });

  it('updates a key in place, in both directions', () => {
    const h = new IndexedHeap(5);
    h.set(0, 1, 0);
    h.set(1, 2, 0);
    h.set(2, 3, 0);
    h.set(0, 10, 0);
    expect(h.top()).toBe(1);
    h.set(2, 0, 0);
    expect(h.top()).toBe(2);
    expect(h.size).toBe(3);
  });

  it('removes from the middle and reports membership', () => {
    const h = new IndexedHeap(6);
    for (let i = 0; i < 6; i++) h.set(i, i, 0);
    h.remove(3);
    expect(h.has(3)).toBe(false);
    expect(h.has(4)).toBe(true);
    expect(h.size).toBe(5);
    h.remove(3);
    expect(h.size).toBe(5);
  });

  it('clear empties it and allows reuse', () => {
    const h = new IndexedHeap(4);
    h.set(0, 1, 1);
    h.set(1, 2, 2);
    h.clear();
    expect(h.size).toBe(0);
    expect(h.has(0)).toBe(false);
    h.set(1, 9, 9);
    expect(h.top()).toBe(1);
  });

  it('matches a sort on random keys', () => {
    const rng = mulberry32(3);
    const n = 200;
    const h = new IndexedHeap(n);
    const keys: number[] = [];
    for (let i = 0; i < n; i++) {
      const k = Math.floor(rng() * 50);
      keys.push(k);
      h.set(i, k, 0);
    }
    const popped: number[] = [];
    while (h.size > 0) {
      const t = h.top();
      popped.push(keys[t] as number);
      h.remove(t);
    }
    expect(popped).toEqual([...keys].sort((a, b) => a - b));
  });
});
