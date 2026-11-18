/**
 * The SafeSurf rig's rules as a pure reducer: what the filter blocks, what the visitor has
 * allowed, and the delay lock. No DOM, no timers; time comes in through actions so the
 * whole thing is unit-testable.
 *
 * The product's two ideas live here: tightening applies at once, loosening queues behind
 * a delay (or a sponsor approves it), and bypass attempts are always refused.
 */

/** How wide an "allow" reaches. */
export type Scope = 'site' | 'page' | 'video';
/** The two mock pages in the rig, so "page" and "site" differ. */
export type PageId = 'harbour' | 'weather';
/** The bypass routes the rig lets the visitor try. */
export type BypassId = 'browser' | 'dns' | 'install' | 'inapp';

/** A change that removes protection, and therefore waits. */
export type LoosenRequest = { kind: 'filterOff' } | { kind: 'allow'; scope: Scope; pageId: PageId };

/** What last happened; drives the live-region announcement. `seq` makes repeats distinct. */
export type RulesEvent =
  | { type: 'requested'; request: LoosenRequest; seq: number }
  | { type: 'applied'; request: LoosenRequest; via: 'delay' | 'sponsor'; seq: number }
  | { type: 'cancelled'; seq: number }
  | { type: 'tightened'; seq: number }
  | { type: 'refused'; bypass: BypassId; seq: number }
  | { type: 'ignored'; reason: 'busy' | 'nothing-pending' | 'already-allowed'; seq: number };

/** A loosening request waiting for its delay. Times are epoch milliseconds. */
export interface PendingRequest {
  request: LoosenRequest;
  startedAt: number;
  endsAt: number;
}

/** Everything the rig knows about the filter. */
export interface RulesState {
  filter: 'on' | 'off';
  /** Images and video allowed everywhere on the site. */
  allowSite: boolean;
  /** Pages where images and video are allowed. */
  allowPages: PageId[];
  /** Pages where only the single video is allowed. */
  allowVideos: PageId[];
  /** The page currently open in the mock browser. */
  page: PageId;
  /** The delay a loosening waits, in milliseconds (the demo compresses the real hour). */
  delayMs: number;
  pending: PendingRequest | null;
  lastEvent: RulesEvent | null;
  /** Bypass attempts refused so far. */
  refusals: number;
  seq: number;
}

/** Everything a visitor or timer can do. */
export type RulesAction =
  | { type: 'toggleFilter'; now: number }
  | { type: 'requestAllow'; scope: Scope; now: number }
  | { type: 'blockAgain' }
  | { type: 'cancel' }
  | { type: 'sponsorApprove' }
  | { type: 'tick'; now: number }
  | { type: 'bypass'; attempt: BypassId }
  | { type: 'navigate'; page: PageId };

/** A fresh rig: filter on, nothing allowed, nothing pending. */
export function initialRules(delayMs: number): RulesState {
  return {
    filter: 'on',
    allowSite: false,
    allowPages: [],
    allowVideos: [],
    page: 'harbour',
    delayMs,
    pending: null,
    lastEvent: null,
    refusals: 0,
    seq: 0,
  };
}

/** What the current page shows: images (and with them video) or the video on its own. */
export function visibility(s: RulesState): { images: boolean; video: boolean } {
  const images = s.filter === 'off' || s.allowSite || s.allowPages.includes(s.page);
  return { images, video: images || s.allowVideos.includes(s.page) };
}

/** Milliseconds left on the pending request, never negative; 0 when nothing is pending. */
export function remainingMs(s: RulesState, now: number): number {
  return s.pending ? Math.max(0, s.pending.endsAt - now) : 0;
}

function withEvent(s: RulesState, event: DistributiveOmit<RulesEvent, 'seq'>): RulesState {
  const seq = s.seq + 1;
  return { ...s, seq, lastEvent: { ...event, seq } as RulesEvent };
}
type DistributiveOmit<T, K extends keyof never> = T extends unknown ? Omit<T, K> : never;

function applyRequest(s: RulesState, r: LoosenRequest): RulesState {
  if (r.kind === 'filterOff') return { ...s, filter: 'off' };
  if (r.scope === 'site') return { ...s, allowSite: true };
  if (r.scope === 'page') return { ...s, allowPages: [...new Set([...s.allowPages, r.pageId])] };
  return { ...s, allowVideos: [...new Set([...s.allowVideos, r.pageId])] };
}

function queue(s: RulesState, request: LoosenRequest, now: number): RulesState {
  if (s.pending) return withEvent(s, { type: 'ignored', reason: 'busy' });
  const pending = { request, startedAt: now, endsAt: now + s.delayMs };
  return withEvent({ ...s, pending }, { type: 'requested', request });
}

/** The reducer. Pure: the same state and action always give the same result. */
export function rulesReducer(s: RulesState, a: RulesAction): RulesState {
  switch (a.type) {
    case 'toggleFilter':
      if (s.filter === 'off') {
        return withEvent({ ...s, filter: 'on', pending: null }, { type: 'tightened' });
      }
      return queue(s, { kind: 'filterOff' }, a.now);
    case 'requestAllow': {
      const v = visibility(s);
      const already =
        a.scope === 'video' ? v.video : a.scope === 'site' ? s.allowSite || v.images : v.images;
      if (already) return withEvent(s, { type: 'ignored', reason: 'already-allowed' });
      return queue(s, { kind: 'allow', scope: a.scope, pageId: s.page }, a.now);
    }
    case 'blockAgain':
      return withEvent(
        { ...s, filter: 'on', allowSite: false, allowPages: [], allowVideos: [], pending: null },
        { type: 'tightened' },
      );
    case 'cancel':
      return s.pending
        ? withEvent({ ...s, pending: null }, { type: 'cancelled' })
        : withEvent(s, { type: 'ignored', reason: 'nothing-pending' });
    case 'sponsorApprove':
      return s.pending
        ? withEvent(
            { ...applyRequest(s, s.pending.request), pending: null },
            { type: 'applied', request: s.pending.request, via: 'sponsor' },
          )
        : withEvent(s, { type: 'ignored', reason: 'nothing-pending' });
    case 'tick':
      return s.pending && a.now >= s.pending.endsAt
        ? withEvent(
            { ...applyRequest(s, s.pending.request), pending: null },
            { type: 'applied', request: s.pending.request, via: 'delay' },
          )
        : s;
    case 'bypass':
      return withEvent({ ...s, refusals: s.refusals + 1 }, { type: 'refused', bypass: a.attempt });
    case 'navigate':
      return s.page === a.page ? s : { ...s, page: a.page };
  }
}
