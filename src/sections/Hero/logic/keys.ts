/** A command the keyboard can give the scene. */
export type KeyCommand =
  | { type: 'push'; dx: number; dz: number }
  | { type: 'select'; dir: 1 | -1 }
  | { type: 'hop' }
  | { type: 'activate' }
  | { type: 'shuffle' }
  | { type: 'reset' };

/** The parts of a keyboard event the mapping needs. */
export interface KeyLike {
  key: string;
  shiftKey: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
}

/**
 * Maps a key press to a scene command, or null to let the browser handle it (Tab, Escape,
 * browser shortcuts). Arrows push the selected object, N/Shift+N select, Space hops, Enter opens the selected project piece (hops otherwise), S
 * shuffles everything, R re-drops.
 */
export function mapKey(e: KeyLike): KeyCommand | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  switch (e.key) {
    case 'ArrowLeft':
      return { type: 'push', dx: -1, dz: 0 };
    case 'ArrowRight':
      return { type: 'push', dx: 1, dz: 0 };
    case 'ArrowUp':
      return { type: 'push', dx: 0, dz: -1 };
    case 'ArrowDown':
      return { type: 'push', dx: 0, dz: 1 };
    case ' ':
      return { type: 'hop' };
    case 'Enter':
      return { type: 'activate' };
    default:
  }
  switch (e.key.toLowerCase()) {
    case 'n':
      return { type: 'select', dir: e.shiftKey ? -1 : 1 };
    case 's':
      return { type: 'shuffle' };
    case 'r':
      return { type: 'reset' };
    default:
      return null;
  }
}
