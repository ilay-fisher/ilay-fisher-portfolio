/** Why the hero shows the still instead of the live scene. */
export type ModeReason = 'ok' | 'no-webgl2' | 'reduced-motion' | 'context-lost';

/** Facts that decide the mode. */
export interface ModeInput {
  webgl2: boolean;
  reducedMotion: boolean;
  contextLost: boolean;
}

/** Chooses between the live scene and the pre-rendered still, with the reason (for logging). */
export function selectMode(i: ModeInput): { mode: 'scene' | 'still'; reason: ModeReason } {
  if (i.reducedMotion) return { mode: 'still', reason: 'reduced-motion' };
  if (i.contextLost) return { mode: 'still', reason: 'context-lost' };
  if (!i.webgl2) return { mode: 'still', reason: 'no-webgl2' };
  return { mode: 'scene', reason: 'ok' };
}
