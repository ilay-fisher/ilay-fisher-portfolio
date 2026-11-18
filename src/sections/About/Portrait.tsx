import { useEffect, useRef, useState } from 'react';
import { profile } from '../../content/profile';
import { createLogger } from '../../lib/logger';

const log = createLogger('about');

/**
 * The portrait in a square rig. If the photo fails to load (404, blocked, offline) it is
 * replaced by a designed monogram, never a broken-image icon.
 */
export function Portrait() {
  const [failed, setFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // The error event can fire before React attaches the handler; catch an already-failed image.
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0 && img.currentSrc !== '') setFailed(true);
  }, []);

  const label = `Portrait of ${profile.name}`;
  return (
    <figure className="about__portrait">
      <div className="rig ticks about__frame">
        {failed ? (
          <div className="about__monogram" role="img" aria-label={`${profile.name}, monogram`}>
            {profile.initials}
          </div>
        ) : (
          <img
            ref={imgRef}
            src={profile.photo}
            alt={label}
            width={800}
            height={800}
            loading="lazy"
            decoding="async"
            onError={() => {
              log.warn('portrait failed to load, showing monogram', { src: profile.photo });
              setFailed(true);
            }}
          />
        )}
      </div>
      <figcaption className="mono">
        <span>{profile.name}</span>
        <span>{profile.location}</span>
      </figcaption>
    </figure>
  );
}
