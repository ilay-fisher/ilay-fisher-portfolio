import { Color, MeshPhysicalMaterial, type Texture } from 'three';
import type { ObjectSpec } from '../logic/catalogue';
import type { MaterialSet } from './geometry';
import type { Palette } from './css';
import type { LegendTextures } from './legend';

const tone = (hex: string, shade: number, spread = 0.035): Color => {
  const c = new Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  return c.setHSL(hsl.h, hsl.s, Math.max(0.02, hsl.l + (shade - 0.5) * spread));
};

/** Base body material for a finish: anodised aluminium, glazed ceramic or machined alloy. */
export function bodyMaterial(spec: ObjectSpec, palette: Palette): MeshPhysicalMaterial {
  const s = spec.shade;
  if (spec.accentBody) {
    return new MeshPhysicalMaterial({
      color: palette.accentDeep.clone().multiplyScalar(0.8),
      roughness: 0.34,
      metalness: 0.1,
      clearcoat: 1,
      clearcoatRoughness: 0.14,
    });
  }
  switch (spec.finish) {
    case 'ceramic':
      return new MeshPhysicalMaterial({
        color: tone('#313a44', s),
        roughness: 0.3 + s * 0.1,
        metalness: 0.05,
        clearcoat: 1,
        clearcoatRoughness: 0.1 + s * 0.08,
      });
    case 'alloy':
      return new MeshPhysicalMaterial({
        color: tone('#4b535d', s, 0.06),
        roughness: 0.3 + s * 0.14,
        metalness: 1,
        clearcoat: 0.15,
      });
    default:
      return new MeshPhysicalMaterial({
        color: tone('#2b333c', s),
        roughness: 0.36 + s * 0.12,
        metalness: 0.8,
        clearcoat: 0.3,
        clearcoatRoughness: 0.32,
      });
  }
}

/** Builds the material set for one object (legend top included for keys). */
export function materialSet(
  spec: ObjectSpec,
  palette: Palette,
  legend: LegendTextures | null,
): MaterialSet {
  const body = bodyMaterial(spec, palette);
  let top: MeshPhysicalMaterial | undefined;
  if (legend) {
    top = body.clone();
    top.color.set('#ffffff');
    top.map = legend.map as Texture;
    top.bumpMap = legend.bump;
    top.bumpScale = 1.2;
    if (legend.emissive) {
      top.emissive = new Color('#ffffff');
      top.emissiveMap = legend.emissive;
      top.emissiveIntensity = 0.5;
    }
  }
  const metal = new MeshPhysicalMaterial({
    color: '#8d949d',
    metalness: 1,
    roughness: 0.32,
    anisotropy: 0.4,
  });
  const polished = new MeshPhysicalMaterial({ color: '#c2c7ce', metalness: 1, roughness: 0.12 });
  const accent = new MeshPhysicalMaterial({
    color: palette.accent,
    roughness: 0.3,
    metalness: 0.2,
    clearcoat: 1,
    emissive: palette.accent,
    emissiveIntensity: 0.35,
  });
  return { body, top, metal, polished, accent };
}

/** The name's materials: brushed warm-white alloy letters on dark anodised plinths. */
export function nameMaterials(palette: Palette): {
  letters: MeshPhysicalMaterial;
  slab: MeshPhysicalMaterial;
} {
  return {
    letters: new MeshPhysicalMaterial({
      color: palette.paper.clone().multiplyScalar(0.95),
      metalness: 0.55,
      roughness: 0.34,
      clearcoat: 0.5,
      clearcoatRoughness: 0.3,
    }),
    slab: new MeshPhysicalMaterial({
      color: '#161b21',
      metalness: 0.7,
      roughness: 0.4,
      clearcoat: 0.4,
      clearcoatRoughness: 0.25,
    }),
  };
}
