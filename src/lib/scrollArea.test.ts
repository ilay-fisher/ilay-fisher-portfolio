import { describe, expect, it } from 'vitest';
import { isInnerScrollTarget, scrollAreaProps } from './scrollArea';

describe('scrollArea', () => {
  it('scrollAreaProps marks a focusable, named region', () => {
    expect(scrollAreaProps('Article')).toEqual({
      'data-scroll-area': '',
      role: 'region',
      'aria-label': 'Article',
      tabIndex: 0,
    });
  });

  it('isInnerScrollTarget is true for the area and anything inside it', () => {
    document.body.innerHTML = '<div data-scroll-area><p><b id="in">x</b></p></div><i id="out"></i>';
    expect(isInnerScrollTarget(document.getElementById('in')!)).toBe(true);
    expect(isInnerScrollTarget(document.querySelector('[data-scroll-area]')!)).toBe(true);
    expect(isInnerScrollTarget(document.getElementById('out')!)).toBe(false);
  });

  it('is false for non-elements', () => {
    expect(isInnerScrollTarget(null)).toBe(false);
  });
});
