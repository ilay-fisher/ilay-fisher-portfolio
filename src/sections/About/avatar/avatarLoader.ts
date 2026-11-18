import manifest from './frames.json';

export type AvatarFrames = Array<HTMLImageElement | undefined>;
export type AvatarLoader = (only?: number[]) => Promise<AvatarFrames>;

/** URL of a frame file. */
export const frameUrl = (index: number): string => `${manifest.dir}${manifest.frames[index]}`;
/** URL of the still shown first, framed exactly like the frames. */
export const STILL_URL = `${manifest.dir}${manifest.still}`;

/**
 * Fetches and decodes the head-turn frames (all of them, or only the listed indices). Rejects if any requested
 * frame fails, so the caller can fall back to the still instead of showing a head with holes in its sweep.
 */
export const loadAvatarFrames: AvatarLoader = async (only) => {
  const wanted = only ?? manifest.frames.map((_, i) => i);
  const out: AvatarFrames = new Array(manifest.count).fill(undefined);
  await Promise.all(
    wanted.map(async (i) => {
      const img = new Image();
      img.decoding = 'async';
      img.src = frameUrl(i);
      if (typeof img.decode === 'function') await img.decode();
      else
        await new Promise<void>((res, rej) => {
          img.onload = () => res();
          img.onerror = () => rej(new Error(`frame ${i} failed`));
        });
      out[i] = img;
    }),
  );
  return out;
};
