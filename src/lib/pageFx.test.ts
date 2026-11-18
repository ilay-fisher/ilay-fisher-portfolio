import { describe, expect, it } from 'vitest';
import { fxPolicy } from './pageFx';

describe('fxPolicy', () => {
  it('turns every page effect on for a fine pointer with motion allowed', () => {
    expect(fxPolicy({ reduced: false, finePointer: true })).toEqual({
      cursor: true,
      grain: true,
      magnetic: true,
      drift: true,
    });
  });
  it('turns everything off under reduced motion', () => {
    expect(fxPolicy({ reduced: true, finePointer: true })).toEqual({
      cursor: false,
      grain: false,
      magnetic: false,
      drift: false,
    });
  });
  it('drops cursor, grain and magnetic pull on touch but keeps the slow ambient drift', () => {
    expect(fxPolicy({ reduced: false, finePointer: false })).toEqual({
      cursor: false,
      grain: false,
      magnetic: false,
      drift: true,
    });
  });
});
