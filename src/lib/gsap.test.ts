import { describe, expect, it } from 'vitest';
import { gsap, ScrollTrigger, SplitText } from './gsap';

describe('gsap bootstrap', () => {
  it('registers ScrollTrigger and SplitText once', () => {
    expect(gsap.plugins.scrollTrigger).toBeDefined();
    expect(gsap.plugins.split).toBeDefined();
    expect(ScrollTrigger).toBeDefined();
    expect(SplitText).toBeDefined();
  });
});
