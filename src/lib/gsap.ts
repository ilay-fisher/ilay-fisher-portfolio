import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(ScrollTrigger, SplitText);
ScrollTrigger.config({ ignoreMobileResize: true });

/**
 * The one place GSAP is imported from. Plugins are registered exactly once here,
 * so feature code imports `gsap`, `ScrollTrigger` and `SplitText` from this module.
 */
export { gsap, ScrollTrigger, SplitText };
