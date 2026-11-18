import { describe, expect, it } from 'vitest';
import {
  initialRules,
  remainingMs,
  rulesReducer,
  visibility,
  type RulesAction,
  type RulesState,
} from './rules';

const DELAY = 8000;
const run = (s: RulesState, ...actions: RulesAction[]) => actions.reduce(rulesReducer, s);
const fresh = () => initialRules(DELAY);

describe('initial state', () => {
  it('blocks images and video with the filter on and nothing pending', () => {
    const s = fresh();
    expect(s.filter).toBe('on');
    expect(s.pending).toBeNull();
    expect(visibility(s)).toEqual({ images: false, video: false });
  });
});

describe('loosening is queued behind the delay', () => {
  it('turning the filter off queues a request and changes nothing yet', () => {
    const s = run(fresh(), { type: 'toggleFilter', now: 1000 });
    expect(s.filter).toBe('on');
    expect(s.pending?.request).toEqual({ kind: 'filterOff' });
    expect(s.pending?.endsAt).toBe(1000 + DELAY);
    expect(visibility(s).images).toBe(false);
    expect(remainingMs(s, 4000)).toBe(5000);
  });

  it('applies when the delay has expired, not before', () => {
    const queued = run(fresh(), { type: 'toggleFilter', now: 0 });
    expect(run(queued, { type: 'tick', now: DELAY - 1 }).filter).toBe('on');
    const done = run(queued, { type: 'tick', now: DELAY });
    expect(done.filter).toBe('off');
    expect(done.pending).toBeNull();
    expect(done.lastEvent).toMatchObject({ type: 'applied', via: 'delay' });
    expect(visibility(done)).toEqual({ images: true, video: true });
  });

  it('cancel drops the request and the filter stays on', () => {
    const s = run(fresh(), { type: 'toggleFilter', now: 0 }, { type: 'cancel' });
    expect(s.pending).toBeNull();
    expect(s.filter).toBe('on');
    expect(s.lastEvent?.type).toBe('cancelled');
    expect(run(s, { type: 'tick', now: DELAY * 2 }).filter).toBe('on');
  });

  it('a sponsor approval applies the pending change at once', () => {
    const s = run(
      fresh(),
      { type: 'requestAllow', scope: 'site', now: 0 },
      { type: 'sponsorApprove' },
    );
    expect(s.pending).toBeNull();
    expect(visibility(s).images).toBe(true);
    expect(s.lastEvent).toMatchObject({ type: 'applied', via: 'sponsor' });
  });

  it('sponsor approval with nothing pending is ignored', () => {
    const s = run(fresh(), { type: 'sponsorApprove' });
    expect(s.lastEvent?.type).toBe('ignored');
    expect(visibility(s).images).toBe(false);
  });

  it('only one request waits at a time', () => {
    const s = run(
      fresh(),
      { type: 'requestAllow', scope: 'site', now: 0 },
      { type: 'requestAllow', scope: 'page', now: 500 },
    );
    expect(s.pending?.request).toEqual({ kind: 'allow', scope: 'site', pageId: 'harbour' });
    expect(s.pending?.endsAt).toBe(DELAY);
    expect(s.lastEvent?.type).toBe('ignored');
  });
});

describe('tightening is instant', () => {
  it('blocking again clears every allowance and any pending request at once', () => {
    const open = run(
      fresh(),
      { type: 'requestAllow', scope: 'site', now: 0 },
      { type: 'sponsorApprove' },
      { type: 'toggleFilter', now: 10 },
      { type: 'blockAgain' },
    );
    expect(open.filter).toBe('on');
    expect(open.pending).toBeNull();
    expect(visibility(open)).toEqual({ images: false, video: false });
    expect(open.lastEvent?.type).toBe('tightened');
  });

  it('switching the filter back on applies without a delay', () => {
    const off = run(fresh(), { type: 'toggleFilter', now: 0 }, { type: 'tick', now: DELAY });
    expect(off.filter).toBe('off');
    const on = run(off, { type: 'toggleFilter', now: DELAY + 1 });
    expect(on.filter).toBe('on');
    expect(on.pending).toBeNull();
  });
});

describe('allow scopes', () => {
  const approve = (scope: 'site' | 'page' | 'video') =>
    run(fresh(), { type: 'requestAllow', scope, now: 0 }, { type: 'sponsorApprove' });

  it('video allows only the video', () => {
    expect(visibility(approve('video'))).toEqual({ images: false, video: true });
  });

  it('page allows images and video on this page only', () => {
    const s = run(approve('page'), { type: 'navigate', page: 'weather' });
    expect(visibility(s)).toEqual({ images: false, video: false });
    expect(visibility(run(s, { type: 'navigate', page: 'harbour' })).images).toBe(true);
  });

  it('site allows every page', () => {
    const s = run(approve('site'), { type: 'navigate', page: 'weather' });
    expect(visibility(s).images).toBe(true);
  });

  it('requesting something already allowed is ignored', () => {
    const s = run(approve('site'), { type: 'requestAllow', scope: 'page', now: 5 });
    expect(s.pending).toBeNull();
    expect(s.lastEvent?.type).toBe('ignored');
  });
});

describe('bypass attempts', () => {
  const attempts = ['browser', 'dns', 'install', 'inapp'] as const;

  it.each(attempts)('"%s" is always refused and changes no rule', (attempt) => {
    const before = fresh();
    const after = run(before, { type: 'bypass', attempt });
    expect(after.lastEvent).toMatchObject({ type: 'refused', bypass: attempt });
    expect(after.filter).toBe(before.filter);
    expect(after.pending).toBe(before.pending);
    expect(visibility(after)).toEqual(visibility(before));
    expect(after.refusals).toBe(1);
  });

  it('is refused even with the filter off or a request pending', () => {
    const queued = run(fresh(), { type: 'toggleFilter', now: 0 }, { type: 'bypass', attempt: 'dns' });
    expect(queued.pending).not.toBeNull();
    expect(queued.lastEvent?.type).toBe('refused');
    expect(queued.refusals).toBe(1);
  });
});
