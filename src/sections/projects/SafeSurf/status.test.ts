import { describe, expect, it } from 'vitest';
import { describeRequest, formatAnnouncement, formatStatus } from './status';

const base = {
  filter: 'on' as const,
  imageCount: 4,
  videoCount: 1,
  imagesVisible: false,
  videoVisible: false,
  remainingMs: null,
};

describe('formatStatus', () => {
  it('says what is blocked', () => {
    expect(formatStatus(base)).toBe('Filter on. 4 images blocked, 1 video blocked.');
  });
  it('appends the countdown, rounded up to whole seconds', () => {
    expect(formatStatus({ ...base, remainingMs: 4200 })).toBe(
      'Filter on. 4 images blocked, 1 video blocked. Unlock request: 5 s left.',
    );
    expect(formatStatus({ ...base, remainingMs: 1000 })).toMatch(/1 s left\.$/);
    expect(formatStatus({ ...base, remainingMs: 0 })).toMatch(/applying\.$/);
  });
  it('handles one image and a video allowed on its own', () => {
    expect(formatStatus({ ...base, imageCount: 1, videoCount: 0 })).toBe(
      'Filter on. 1 image blocked.',
    );
    expect(formatStatus({ ...base, videoVisible: true })).toBe(
      'Filter on. 4 images blocked, video allowed.',
    );
  });
  it('handles everything allowed and the filter off', () => {
    expect(formatStatus({ ...base, imagesVisible: true, videoVisible: true })).toBe(
      'Filter on. Images and video allowed.',
    );
    expect(formatStatus({ ...base, filter: 'off', imagesVisible: true, videoVisible: true })).toBe(
      'Filter off. Nothing blocked.',
    );
  });
});

describe('describeRequest', () => {
  it('names each loosening in plain words', () => {
    expect(describeRequest({ kind: 'filterOff' })).toBe('switch the filter off');
    expect(describeRequest({ kind: 'allow', scope: 'site', pageId: 'harbour' })).toBe(
      'allow images for this site',
    );
    expect(describeRequest({ kind: 'allow', scope: 'page', pageId: 'harbour' })).toBe(
      'allow images for this page',
    );
    expect(describeRequest({ kind: 'allow', scope: 'video', pageId: 'harbour' })).toBe(
      'allow this video',
    );
  });
});

describe('formatAnnouncement', () => {
  it('announces a queued request without a ticking number', () => {
    const text = formatAnnouncement(
      { type: 'requested', request: { kind: 'filterOff' }, seq: 1 },
      { delayLabel: '8 seconds', statusNoClock: 'Filter on.' },
    );
    expect(text).toContain('switch the filter off');
    expect(text).toContain('8 seconds');
    expect(text).not.toMatch(/\d+ s left/);
  });
  it('announces a refusal with the SafeGuard line', () => {
    expect(
      formatAnnouncement(
        { type: 'refused', bypass: 'dns', seq: 2 },
        { delayLabel: '8 seconds', statusNoClock: 'Filter on.' },
      ),
    ).toMatch(/private DNS/i);
  });
  it('is empty before anything has happened', () => {
    expect(formatAnnouncement(null, { delayLabel: '', statusNoClock: 'Filter on.' })).toBe('');
  });
});
