import { CanvasTexture, LinearFilter, LinearMipmapLinearFilter, SRGBColorSpace } from 'three';

/** Pixel density of legend textures: crisp when a key is about 90 px wide on a 2x screen. */
const PX_PER_UNIT = 240;

/** The three canvases of one printed key top. */
export interface LegendTextures {
  map: CanvasTexture;
  bump: CanvasTexture;
  emissive: CanvasTexture | null;
}

/** Options for {@link makeLegendTextures}. */
export interface LegendOptions {
  label: string;
  /** Key top size in world units. */
  w: number;
  d: number;
  /** CSS colours. */
  top: string;
  ink: string;
  /** Glow colour for accent legends, or null. */
  glow: string | null;
  fontFamily: string;
  anisotropy: number;
}

/**
 * Draws a key top: base tone with a soft sheen, the legend printed in `ink`, a bump map that engraves
 * it, and (for accent legends) an emissive layer so it reads as live. Text is fitted to the key.
 * Call after the font has loaded or the glyphs will be the fallback face.
 */
export function makeLegendTextures(o: LegendOptions): LegendTextures {
  const W = Math.round(o.w * PX_PER_UNIT);
  const H = Math.round(o.d * PX_PER_UNIT);
  const make = (draw: (ctx: CanvasRenderingContext2D) => void, srgb: boolean) => {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d')!;
    draw(ctx);
    const t = new CanvasTexture(c);
    t.colorSpace = srgb ? SRGBColorSpace : '';
    t.anisotropy = o.anisotropy;
    t.minFilter = LinearMipmapLinearFilter;
    t.magFilter = LinearFilter;
    return t;
  };
  const fit = (ctx: CanvasRenderingContext2D) => {
    let size = H * 0.34;
    ctx.font = `600 ${size}px ${o.fontFamily}`;
    const m = ctx.measureText(o.label).width;
    const max = W * 0.78;
    if (m > max) size *= max / m;
    ctx.font = `600 ${size}px ${o.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    return size;
  };
  const text = (ctx: CanvasRenderingContext2D, color: string) => {
    fit(ctx);
    ctx.fillStyle = color;
    // Optical centre sits a hair above the geometric one for caps and digits.
    ctx.fillText(o.label, W / 2, H / 2 + H * 0.02);
  };

  const map = make((ctx) => {
    const g = ctx.createRadialGradient(
      W * 0.3,
      H * 0.25,
      0,
      W * 0.5,
      H * 0.5,
      Math.max(W, H) * 0.8,
    );
    g.addColorStop(0, o.top);
    g.addColorStop(1, o.top);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    text(ctx, o.ink);
  }, true);
  const bump = make((ctx) => {
    ctx.fillStyle = '#c8c8c8';
    ctx.fillRect(0, 0, W, H);
    ctx.filter = 'blur(1.2px)';
    text(ctx, '#202020');
  }, false);
  const emissive = o.glow
    ? make((ctx) => {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, W, H);
        text(ctx, o.glow!);
      }, true)
    : null;
  return { map, bump, emissive };
}
