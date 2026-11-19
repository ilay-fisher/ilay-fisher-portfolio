import { useEffect, useRef, useState } from 'react';
import { startCursor } from '../../lib/cursorEngine';
import { startMagnetic } from '../../lib/magneticEngine';
import { fxPolicy } from '../../lib/pageFx';
import { startMood } from '../../lib/pageFxEngine';
import { usePrefersReducedMotion } from '../../lib/motion';

const FINE_QUERY = '(hover: hover) and (pointer: fine)';

function useFinePointer(): boolean {
  const [fine, setFine] = useState(
    () => typeof window.matchMedia === 'function' && window.matchMedia(FINE_QUERY).matches,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(FINE_QUERY);
    const update = () => setFine(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, []);
  return fine;
}

/**
 * The page-level layer, mounted once in `main.tsx`: drifting light pools, film grain, the
 * signature cursor and the magnetic pull. Everything is decoration (aria-hidden), none of it
 * takes pointer events, and each piece switches itself off per `fxPolicy` (reduced motion, touch).
 */
export function PageFx() {
  const reduced = usePrefersReducedMotion();
  const fine = useFinePointer();
  const fx = fxPolicy({ reduced, finePointer: fine });

  const ambient = useRef<HTMLDivElement>(null);
  const cursor = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const ticks = useRef<HTMLDivElement>(null);
  const core = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!fx.drift || !ambient.current) return;
    return startMood(ambient.current);
  }, [fx.drift]);

  useEffect(() => {
    if (!fx.cursor) return;
    const root = cursor.current;
    const r = ring.current;
    const t = ticks.current;
    const c = core.current;
    const l = label.current;
    if (!root || !r || !t || !c || !l) return;
    return startCursor({ root, ring: r, ticks: t, core: c, label: l });
  }, [fx.cursor]);

  useEffect(() => {
    if (!fx.magnetic) return;
    const stop = startMagnetic();
    return () => {
      stop();
    };
  }, [fx.magnetic]);

  return (
    <>
      <div
        ref={ambient}
        className="ambient"
        data-testid="ambient"
        data-drift={String(fx.drift)}
        data-mood="hero"
        aria-hidden="true"
      >
        <div className="pool pool--key">
          <span className="pool__glow" />
        </div>
        <div className="pool pool--deep">
          <span className="pool__glow" />
        </div>
        <div className="pool pool--signal">
          <span className="pool__glow" />
        </div>
      </div>
      <div
        className="grain"
        data-testid="grain"
        data-moving={String(fx.grainMoves)}
        aria-hidden="true"
      />
      {fx.cursor && (
        <div
          ref={cursor}
          className="cursor"
          data-testid="cursor"
          data-visible="false"
          data-mode="default"
          aria-hidden="true"
        >
          <div ref={ring} className="cursor__ring" />
          <div ref={ticks} className="cursor__ticks">
            <i className="cursor__tick cursor__tick--n" />
            <i className="cursor__tick cursor__tick--e" />
            <i className="cursor__tick cursor__tick--s" />
            <i className="cursor__tick cursor__tick--w" />
          </div>
          <div ref={core} className="cursor__core" />
          <span ref={label} className="cursor__label" />
        </div>
      )}
    </>
  );
}
