/**
 * Indexed binary min-heap keyed by the pair (k1, k2). Every node id appears at most once and
 * can have its key changed or be removed in O(log n), which A* (decrease-key) and D* Lite
 * (arbitrary re-keying) both need. Capacity is the cell count, so nothing is allocated after
 * construction and the hot loop stays free of garbage.
 *
 * Ported from the owner's drone-obstacle-sandbox (MIT, github.com/ilay-fisher/drone-obstacle-sandbox,
 * web/src/engine/tsPlanner.ts), adapted to strict TypeScript.
 */
export class IndexedHeap {
  size = 0;
  private readonly heap: Int32Array;
  private readonly pos: Int32Array;
  readonly k1: Float64Array;
  readonly k2: Float64Array;

  constructor(capacity: number) {
    this.heap = new Int32Array(capacity);
    this.pos = new Int32Array(capacity).fill(-1);
    this.k1 = new Float64Array(capacity);
    this.k2 = new Float64Array(capacity);
  }

  /** True when node `i` is queued. */
  has(i: number): boolean {
    return (this.pos[i] ?? -1) >= 0;
  }

  /** The node with the smallest key. Only valid while `size > 0`. */
  top(): number {
    return this.heap[0] ?? -1;
  }

  /** Empties the heap in O(size). */
  clear(): void {
    for (let i = 0; i < this.size; i++) this.pos[this.heap[i] as number] = -1;
    this.size = 0;
  }

  /** Inserts node `i`, or changes its key when it is already queued. */
  set(i: number, a: number, b: number): void {
    this.k1[i] = a;
    this.k2[i] = b;
    if ((this.pos[i] ?? -1) < 0) {
      this.heap[this.size] = i;
      this.pos[i] = this.size++;
    }
    this.sift(this.pos[i] as number);
  }

  /** Removes node `i` if queued. */
  remove(i: number): void {
    const p = this.pos[i] ?? -1;
    if (p < 0) return;
    const last = this.heap[--this.size] as number;
    this.pos[i] = -1;
    if (p < this.size) {
      this.heap[p] = last;
      this.pos[last] = p;
      this.sift(p);
    }
  }

  private less(a: number, b: number): boolean {
    const a1 = this.k1[a] as number;
    const b1 = this.k1[b] as number;
    return a1 < b1 || (a1 === b1 && (this.k2[a] as number) < (this.k2[b] as number));
  }

  private swap(p: number, q: number): void {
    const a = this.heap[p] as number;
    const b = this.heap[q] as number;
    this.heap[p] = b;
    this.pos[b] = p;
    this.heap[q] = a;
    this.pos[a] = q;
  }

  private sift(start: number): void {
    let p = start;
    while (p > 0) {
      const parent = (p - 1) >> 1;
      if (!this.less(this.heap[p] as number, this.heap[parent] as number)) break;
      this.swap(p, parent);
      p = parent;
    }
    for (;;) {
      const l = 2 * p + 1;
      const r = l + 1;
      let m = p;
      if (l < this.size && this.less(this.heap[l] as number, this.heap[m] as number)) m = l;
      if (r < this.size && this.less(this.heap[r] as number, this.heap[m] as number)) m = r;
      if (m === p) return;
      this.swap(p, m);
      p = m;
    }
  }
}
