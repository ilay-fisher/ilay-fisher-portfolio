import {
  BackSide,
  Color,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  PMREMGenerator,
  PlaneGeometry,
  Scene,
  SphereGeometry,
  type Texture,
  type WebGLRenderer,
} from 'three';
import type { Palette } from './css';

/**
 * A procedural photo-studio: a dark room with a few emissive softboxes. Prefiltered with PMREM so
 * glossy bevels pick up long, clean highlights. No image is downloaded. The key softbox is top-left,
 * matching the page's light direction; a thin amber kicker low on the right tints edges with the accent.
 */
export function buildEnvironment(renderer: WebGLRenderer, palette: Palette): Texture {
  const scene = new Scene();
  const room = new Mesh(
    new SphereGeometry(60, 32, 16),
    new MeshBasicMaterial({ color: new Color('#080b0f'), side: BackSide }),
  );
  scene.add(room);

  const panel = (
    w: number,
    h: number,
    pos: [number, number, number],
    color: Color,
    intensity: number,
  ) => {
    const m = new Mesh(
      new PlaneGeometry(w, h),
      new MeshBasicMaterial({
        color: color.clone().multiplyScalar(intensity),
        side: DoubleSide,
        toneMapped: false,
      }),
    );
    m.position.set(...pos);
    m.lookAt(0, 0, 0);
    scene.add(m);
  };
  panel(22, 14, [-20, 22, 12], new Color('#fff1e0'), 9);
  panel(4, 22, [26, 10, 4], new Color('#cfe0ff'), 5);
  panel(24, 7, [0, 30, -10], new Color('#ffffff'), 2.6);
  panel(16, 3, [14, 3, 20], palette.accentHi, 1.8);
  panel(40, 3, [0, 4, -34], new Color('#9db4d6'), 1.2);

  const pmrem = new PMREMGenerator(renderer);
  const tex = pmrem.fromScene(scene, 0.03).texture;
  pmrem.dispose();
  for (const o of scene.children) {
    if (o instanceof Mesh) {
      o.geometry.dispose();
      (o.material as MeshBasicMaterial).dispose();
    }
  }
  return tex;
}
