/** Which page-level effects run for the current device and motion preference. */
export interface FxPolicy {
  /** Custom cursor (fine pointer, motion allowed). */
  cursor: boolean;
  /** Magnetic pull on controls. */
  magnetic: boolean;
  /** Light pools drift slowly. */
  drift: boolean;
  /** Film grain layer is present (always: a still texture is not motion). */
  grain: boolean;
  /** Grain steps between frames. */
  grainMoves: boolean;
  /** Specular sheen sweeps over controls on hover. */
  sheen: boolean;
}

/** Decides every page effect from two facts: reduced motion and a fine pointer. */
export function fxPolicy(env: { reduced: boolean; finePointer: boolean }): FxPolicy {
  const { reduced, finePointer } = env;
  return {
    cursor: !reduced && finePointer,
    magnetic: !reduced && finePointer,
    drift: !reduced,
    grain: true,
    grainMoves: !reduced && finePointer,
    sheen: !reduced && finePointer,
  };
}

export type Mood = 'hero' | 'about' | 'cool' | 'signal' | 'deep';

const MOODS: Record<string, Mood> = {
  top: 'hero',
  about: 'about',
  safesurf: 'cool',
  drone: 'signal',
  xray: 'about',
  experience: 'cool',
  contact: 'deep',
};

/** Light-pool mood for a section id. Unknown or missing ids use the hero mood. */
export function moodFor(id: string | null | undefined): Mood {
  return (id && MOODS[id]) || 'hero';
}
