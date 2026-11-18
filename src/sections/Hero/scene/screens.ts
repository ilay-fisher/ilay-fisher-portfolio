import { CanvasTexture, LinearFilter, LinearMipmapLinearFilter, SRGBColorSpace } from 'three';

const texture = (c: HTMLCanvasElement, anisotropy: number): CanvasTexture => {
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = anisotropy;
  t.minFilter = LinearMipmapLinearFilter;
  t.magFilter = LinearFilter;
  return t;
};

const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

/** The lit phone screen: SafeSurf's own logo over a hint of the browser (address bar, tabs, a page). */
export interface PhoneScreen {
  map: CanvasTexture;
  /** Draws the logo once it has loaded. */
  setLogo(img: CanvasImageSource): void;
}

export function makePhoneScreen(aspect: number, anisotropy: number): PhoneScreen {
  const W = 384;
  const H = Math.round(W / aspect);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  let logo: CanvasImageSource | null = null;
  const draw = () => {
    ctx.clearRect(0, 0, W, H);
    // Screen glass with rounded corners (the corners stay transparent for the alpha test).
    ctx.save();
    roundRect(ctx, 0, 0, W, H, W * 0.1);
    ctx.clip();
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#16224d');
    g.addColorStop(0.55, '#0e1634');
    g.addColorStop(1, '#0a0f24');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // Browser: address bar with a lock, then the page.
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    roundRect(ctx, W * 0.08, H * 0.045, W * 0.84, H * 0.062, H * 0.031);
    ctx.fill();
    ctx.fillStyle = '#8fd3a8';
    roundRect(ctx, W * 0.13, H * 0.066, W * 0.035, H * 0.026, 3);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    roundRect(ctx, W * 0.2, H * 0.069, W * 0.34, H * 0.02, H * 0.01);
    ctx.fill();
    // The logo, large and centred.
    const size = W * 0.62;
    const cy = H * 0.37;
    if (logo) {
      ctx.drawImage(logo, W / 2 - size / 2, cy - size / 2, size, size);
    } else {
      ctx.fillStyle = '#5a6ae0';
      ctx.beginPath();
      ctx.arc(W / 2, cy, size / 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    // A hint of the page below: filtered results as soft cards.
    for (let i = 0; i < 3; i++) {
      const y = H * (0.62 + i * 0.1);
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      roundRect(ctx, W * 0.08, y, W * 0.84, H * 0.072, W * 0.03);
      ctx.fill();
      ctx.fillStyle = 'rgba(143,211,168,0.75)';
      ctx.beginPath();
      ctx.arc(W * 0.15, y + H * 0.036, H * 0.015, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.32)';
      roundRect(ctx, W * 0.22, y + H * 0.024, W * (0.4 - i * 0.05), H * 0.014, H * 0.007);
      ctx.fill();
    }
    // Home bar.
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    roundRect(ctx, W * 0.36, H * 0.965, W * 0.28, H * 0.01, H * 0.005);
    ctx.fill();
    ctx.restore();
  };
  draw();
  const map = texture(c, anisotropy);
  return {
    map,
    setLogo(img) {
      logo = img;
      draw();
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
