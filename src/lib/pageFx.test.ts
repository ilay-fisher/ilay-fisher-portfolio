import { describe, expect, it } from 'vitest';
import { fxPolicy, moodFor } from './pageFx';

describe('fxPolicy', () => {
  it('turns every page effect on for a fine pointer with motion allowed', () => {
    expect(fxPolicy({ reduced: false, finePointer: true })).toEqual({
      cursor: true,
      magnetic: true,
      drift: true,
      grain: true,
      grainMoves: true,
      sheen: true,
    });
  });
  it('under reduced motion everything stops, but the grain stays as a still texture', () => {
    expect(fxPolicy({ reduced: true, finePointer: true })).toEqual({
      cursor: false,
      magnetic: false,
      drift: false,
      grain: true,
      grainMoves: false,
      sheen: false,
    });
  });
  it('on touch there is no cursor, magnet or sheen; light pools still drift slowly', () => {
    expect(fxPolicy({ reduced: false, finePointer: false })).toEqual({
      cursor: false,
      magnetic: false,
      drift: true,
      grain: true,
      grainMoves: false,
      sheen: false,
    });
  });
});

describe('moodFor', () => {
  it('maps each section id to a light-pool mood and defaults to the hero mood', () => {
    expect(moodFor('top')).toBe('hero');
    expect(moodFor('safesurf')).not.toBe(moodFor('drone'));
    expect(moodFor('contact')).toBe('deep');
    expect(moodFor(null)).toBe('hero');
    expect(moodFor('unknown')).toBe('hero');
  });
});
