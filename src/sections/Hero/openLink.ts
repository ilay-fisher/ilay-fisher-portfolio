/**
 * Opening a profile page from a hero piece. Kept out of the scene so it can be tested without WebGL.
 */

/** The address when it is safe to open from a piece (https only), otherwise null. */
export function safeProfileUrl(url: string): string | null {
  try {
    return new URL(url).protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

/**
 * Opens `url` in a new tab through a real anchor click. It must run inside the visitor's gesture (the end of a
 * double-press, or the Enter key press): browsers allow a click on an anchor there, where `window.open` after a
 * delay is what popup blockers stop. `noopener noreferrer` keeps the new page from reaching back into this one.
 * Returns false (and does nothing) for an address that is not https.
 */
export function openInNewTab(url: string): boolean {
  const href = safeProfileUrl(url);
  if (!href) return false;
  const a = document.createElement('a');
  a.href = href;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.hidden = true;
  document.body.appendChild(a);
  a.click();
  a.remove();
  return true;
}
