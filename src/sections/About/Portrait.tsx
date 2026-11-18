import { useEffect, useRef, useState } from 'react';
import { profile } from '../../content/profile';
import { createLogger } from '../../lib/logger';
import { usePrefersReducedMotion } from '../../lib/motion';
import { startAvatar } from './avatar/avatarEngine';
import { STILL_URL, loadAvatarFrames, type AvatarLoader } from './avatar/avatarLoader';
import manifest from './avatar/frames.json';

const log = createLogger('about');

type Mode = 'still' | 'frames' | 'static' | 'monogram';

/**
 * The illustrated avatar in the round lens bezel. It shows the still first (framed exactly like the turn frames), loads
 * the head-turn set when About is near the viewport, then crossfades to a canvas whose head follows the pointer.
 * Fallbacks: reduced motion draws one static frame facing the visitor; if the frames fail the still stays; if the
 * still fails the IF monogram shows. `data-avatar` on the glass says which, `data-frame` says which frame is drawn.
 */
export function Portrait({ loader = loadAvatarFrames }: { loader?: AvatarLoader }) {
  const [stillFailed, setStillFailed] = useState(false);
  const [near, setNear] = useState(false);
  const [frames, setFrames] = useState<Awaited<ReturnType<AvatarLoader>> | null>(null);
  const [ready, setReady] = useState(false);
  const reduced = usePrefersReducedMotion();
  const figureRef = useRef<HTMLElement>(null);
  const glassRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // The error event can fire before React attaches the handler; catch an already-failed image.
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0 && img.currentSrc !== '') setStillFailed(true);
  }, []);

  // Lazy: only fetch the frames when About is within a screen of the viewport.
  useEffect(() => {
    const el = figureRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setNear(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: '600px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!near || stillFailed) return;
    let cancelled = false;
    loader(reduced ? [manifest.neutral] : undefined).then(
      (f) => !cancelled && setFrames(f),
      (err) => log.warn('avatar frames failed to load, keeping the still', err),
    );
    return () => {
      cancelled = true;
    };
  }, [near, reduced, stillFailed, loader]);

  useEffect(() => {
    const glass = glassRef.current;
    const canvas = canvasRef.current;
    if (!frames || !glass || !canvas) return;
    const engine = startAvatar({
      glass,
      canvas,
      frames,
      count: manifest.count,
      neutral: manifest.neutral,
      stillIndex: manifest.stillIndex,
      reduced,
      onReady: () => setReady(true),
    });
    return () => engine.stop();
  }, [frames, reduced]);

  const mode: Mode = stillFailed ? 'monogram' : ready ? (reduced ? 'static' : 'frames') : 'still';
  const label = `Illustrated avatar of ${profile.name}`;
  return (
    <figure className="about__portrait" ref={figureRef}>
      <div className="lens">
        <div className="lens__glass" ref={glassRef} data-avatar={mode}>
          {stillFailed ? (
            <div className="lens__monogram" role="img" aria-label={`${profile.name}, monogram`}>
              {profile.initials}
            </div>
          ) : (
            <>
              <img
                ref={imgRef}
                className="lens__still"
                src={STILL_URL}
                alt={label}
                width={manifest.size}
                height={manifest.size}
                loading="lazy"
                decoding="async"
                onError={() => {
                  log.warn('avatar still failed to load, showing monogram', { src: STILL_URL });
                  setStillFailed(true);
                }}
              />
              <canvas ref={canvasRef} className="lens__frames" aria-hidden="true" />
            </>
          )}
        </div>
        <span className="lens__glint" aria-hidden="true" />
      </div>
      <figcaption className="mono">
        <span>{profile.name}</span>
        <span>{profile.location}</span>
      </figcaption>
    </figure>
  );
}
