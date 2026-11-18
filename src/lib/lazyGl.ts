/**
 * Lazy loader for the OGL-based stage, so first paint does not carry OGL (about 15 KB gzip).
 *
 * Pattern for sections that use WebGL: render the DOM/CSS fallback first, then load the
 * stage when the section is near the viewport and swap to the canvas after the first frame.
 *
 * ```ts
 * const [ref, inView] = useInView<HTMLDivElement>({ rootMargin: '100% 0px' });
 * useEffect(() => {
 *   if (!inView) return;
 *   let stage: GlStage | null = null;
 *   let cancelled = false;
 *   loadGlStage().then(({ GlStage }) => {
 *     if (cancelled) return;
 *     stage = GlStage.create({ container: ref.current!, name: 'hero', onFrame });
 *     stage?.start();
 *   });
 *   return () => { cancelled = true; stage?.dispose(); };
 * }, [inView]);
 * ```
 */
let pending: Promise<typeof import('./glStage')> | null = null;

/** Dynamically imports `./glStage` (and with it OGL). The promise is memoised. */
export function loadGlStage(): Promise<typeof import('./glStage')> {
  pending ??= import('./glStage');
  return pending;
}
