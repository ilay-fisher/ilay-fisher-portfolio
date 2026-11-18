import { CanvasTexture, LinearFilter, LinearMipmapLinearFilter, SRGBColorSpace } from 'three';

const texture = (c: HTMLCanvasElement, anisotropy: number): CanvasTexture => {
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = anisotropy;
  t.minFilter = LinearMipmapLinearFilter;
  t.magFilter = LinearFilter;
  return t;
};

/** The SafeSurf logo as a texture for the faces of its token. */
export interface LogoFace {
  map: CanvasTexture;
  /** Draws the logo once the image has loaded. */
  setLogo(img: CanvasImageSource, width: number, height: number): void;
}

export function makeLogoFace(anisotropy: number): LogoFace {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d')!;
  const draw = (img: CanvasImageSource | null, iw = 1, ih = 1) => {
    ctx.clearRect(0, 0, S, S);
    if (img) {
      const k = Math.min(S / iw, S / ih);
      ctx.drawImage(img, (S - iw * k) / 2, (S - ih * k) / 2, iw * k, ih * k);
    } else {
      // Until the logo loads: a plain disc in SafeSurf indigo.
      ctx.fillStyle = '#5a6ae0';
      ctx.beginPath();
      ctx.arc(S / 2, S / 2, S * 0.46, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  draw(null);
  const map = texture(c, anisotropy);
  return {
    map,
    setLogo(img, iw, ih) {
      draw(img, iw, ih);
      map.needsUpdate = true;
    },
  };
}

/** A tiny circuit board as seen through the magnifier: traces, pads, chips. Deterministic. */
export function makeCircuit(anisotropy: number): CanvasTexture {
  const S = 384;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#0b3a2c';
  ctx.fillRect(0, 0, S, S);
  const g = ctx.createRadialGradient(S * 0.4, S * 0.35, 0, S / 2, S / 2, S * 0.75);
  g.addColorStop(0, 'rgba(120,255,190,0.28)');
  g.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = '#d9b34a';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const trace = (...p: number[]) => {
    ctx.beginPath();
    ctx.moveTo(p[0]! * S, p[1]! * S);
    for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i]! * S, p[i + 1]! * S);
    ctx.stroke();
  };
  trace(0.05, 0.3, 0.3, 0.3, 0.4, 0.2, 0.7, 0.2, 0.8, 0.1);
  trace(0.05, 0.5, 0.25, 0.5, 0.35, 0.6, 0.35, 0.9);
  trace(0.95, 0.42, 0.75, 0.42, 0.65, 0.52, 0.65, 0.95);
  trace(0.1, 0.8, 0.5, 0.8, 0.6, 0.7, 0.95, 0.7);
  trace(0.5, 0.05, 0.5, 0.3);
  // Chips with pins.
  const chip = (x: number, y: number, w: number, h: number) => {
    ctx.fillStyle = '#14181d';
    ctx.fillRect(x * S, y * S, w * S, h * S);
    ctx.fillStyle = '#c8ccd2';
    for (let i = 0; i < 6; i++) {
      ctx.fillRect(x * S - 8, (y + ((i + 0.5) * h) / 6) * S - 3, 8, 6);
      ctx.fillRect((x + w) * S, (y + ((i + 0.5) * h) / 6) * S - 3, 8, 6);
    }
    ctx.fillStyle = '#e8e3d8';
    ctx.beginPath();
    ctx.arc((x + 0.04) * S, (y + 0.04) * S, 4, 0, Math.PI * 2);
    ctx.fill();
  };
  chip(0.38, 0.38, 0.26, 0.2);
  chip(0.1, 0.62, 0.14, 0.1);
  // Pads and vias.
  ctx.fillStyle = '#d9b34a';
  for (const [x, y] of [
    [0.3, 0.3],
    [0.7, 0.2],
    [0.8, 0.1],
    [0.35, 0.9],
    [0.65, 0.95],
    [0.95, 0.7],
    [0.5, 0.05],
    [0.75, 0.42],
  ] as const) {
    ctx.beginPath();
    ctx.arc(x * S, y * S, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0b3a2c';
    ctx.beginPath();
    ctx.arc(x * S, y * S, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d9b34a';
  }
  return texture(c, anisotropy);
}
