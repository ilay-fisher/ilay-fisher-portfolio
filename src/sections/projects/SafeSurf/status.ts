import { BYPASSES } from './content';
import type { LoosenRequest, RulesEvent } from './rules';

/** Inputs for the one-line bench readout. */
export interface StatusInput {
  filter: 'on' | 'off';
  imageCount: number;
  videoCount: number;
  imagesVisible: boolean;
  videoVisible: boolean;
  /** Milliseconds left on a pending request, or null when none is waiting. */
  remainingMs: number | null;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * The status line in words, for example "Filter on. 4 images blocked, 1 video blocked.
 * Unlock request: 5 s left." It is the readout on the bench and the base of announcements.
 */
export function formatStatus(i: StatusInput): string {
  const lead = `Filter ${i.filter}.`;
  const blockedImages = i.imagesVisible ? 0 : i.imageCount;
  const blockedVideos = i.videoVisible ? 0 : i.videoCount;
  let body: string;
  if (i.filter === 'off' && blockedImages === 0 && blockedVideos === 0) {
    body = 'Nothing blocked.';
  } else if (blockedImages === 0 && blockedVideos === 0) {
    body = i.videoCount > 0 ? 'Images and video allowed.' : 'Images allowed.';
  } else {
    const parts: string[] = [];
    if (blockedImages > 0) parts.push(`${plural(blockedImages, 'image', 'images')} blocked`);
    if (blockedVideos > 0) parts.push(`${plural(blockedVideos, 'video', 'videos')} blocked`);
    else if (i.videoCount > 0) parts.push('video allowed');
    body = `${parts.join(', ')}.`;
  }
  let text = `${lead} ${body}`;
  if (i.remainingMs !== null) {
    const s = Math.ceil(i.remainingMs / 1000);
    text += ` Unlock request: ${s > 0 ? `${s} s left` : 'applying'}.`;
  }
  return text;
}

/** A loosening in plain words, lower case, for use inside a sentence. */
export function describeRequest(r: LoosenRequest): string {
  if (r.kind === 'filterOff') return 'switch the filter off';
  if (r.scope === 'site') return 'allow images for this site';
  if (r.scope === 'page') return 'allow images for this page';
  return 'allow this video';
}

/** Extra facts for {@link formatAnnouncement}. */
export interface AnnouncementContext {
  /** The delay in words, for example "8 seconds". */
  delayLabel: string;
  /** The status line without the ticking countdown. */
  statusNoClock: string;
}

/**
 * Text for the polite live region. It changes only when something happens, never every
 * second, so a screen reader is not interrupted by the countdown.
 */
export function formatAnnouncement(e: RulesEvent | null, ctx: AnnouncementContext): string {
  if (!e) return '';
  switch (e.type) {
    case 'requested':
      return `Unlock request started: ${describeRequest(e.request)}. It applies in ${ctx.delayLabel} unless you cancel it or a sponsor approves it. ${ctx.statusNoClock}`;
    case 'applied':
      return `${e.via === 'sponsor' ? 'Sponsor approved.' : 'Delay over.'} Change applied: ${describeRequest(e.request)}. ${ctx.statusNoClock}`;
    case 'cancelled':
      return `Unlock request cancelled. Protection unchanged. ${ctx.statusNoClock}`;
    case 'tightened':
      return `Protection applied at once. ${ctx.statusNoClock}`;
    case 'refused':
      return BYPASSES.find((b) => b.id === e.bypass)?.refusal ?? 'SafeGuard refused the attempt.';
    case 'ignored':
      return e.reason === 'busy'
        ? 'One request waits at a time. Cancel the current one first.'
        : e.reason === 'already-allowed'
          ? 'That is already allowed.'
          : 'No request is waiting.';
  }
}
