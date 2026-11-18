import { moodFor } from './pageFx';

/**
 * Sets `data-mood` on the ambient layer to the mood of the section crossing the middle of the
 * viewport, so the light pools slide as you arrive (the CSS springs the transform). Returns a cleanup.
 */
export function startMood(ambient: HTMLElement): () => void {
  if (typeof IntersectionObserver === 'undefined') return () => {};
  const sections = document.querySelectorAll<HTMLElement>('main section[id]');
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) ambient.dataset.mood = moodFor(e.target.id);
      }
    },
    { rootMargin: '-45% 0px -50% 0px' },
  );
  sections.forEach((s) => io.observe(s));
  return () => io.disconnect();
}
