import { describe, expect, it } from 'vitest';
import { gsap, ScrollTrigger, SplitText } from './gsap';

describe('gsap bootstrap', () => {
  it('registers ScrollTrigger so triggers can be created', () => {
    expect(gsap.plugins).toBeDefined();
    expect(ScrollTrigger.version).toMatch(/^3\./);
  });
  it('exposes a usable SplitText', () => {
    expect(typeof SplitText.create).toBe('function');
  });
});
