import { Color, MeshPhysicalMaterial, type Texture } from 'three';
import type { ObjectSpec } from '../logic/catalogue';
import type { MaterialSet } from './geometry';
import type { Palette } from './css';
import type { LegendTextures } from './legend';
import { MARKS } from './marks';

const tone = (hex: string, shade: number, spread = 0.035): Color => {
  const c = new Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  return c.setHSL(hsl.h, hsl.s, Math.max(0.02, hsl.l + (shade - 0.5) * spread));
};

const luminance = (c: Color) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;

/** Brand colour for enamel: the official hex, lifted when it is too dark to read on the dark stage. */
export function enamelColor(hex: string): Color {
  const c = new Color(`#${hex.replace('#', '')}`);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  return hsl.l < 0.16 ? c.setHSL(hsl.h, hsl.s * 0.6, 0.2) : c;
}

/** Ink for the raised mark: white or near-black, whichever contrasts more with the enamel. */
export function inkColor(hex: string): string {
  return luminance(enamelColor(hex)) > 0.36 ? '#10141a' : '#ffffff';
}

/** Base body material for a finish: anodised aluminium, glazed ceramic or machined alloy. */
export function bodyMaterial(spec: ObjectSpec, palette: Palette): MeshPhysicalMaterial {
  const s = spec.shade;
  if (spec.kind === 'token' && spec.mark && MARKS[spec.mark]) {
    // Glossy enamel in the brand's own colour.
    return new MeshPhysicalMaterial({
      color: enamelColor(MARKS[spec.mark]!.hex),
      roughness: 0.26,
      metalness: 0.04,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
    });
  }
  if (spec.kind === 'shield') {
    return new MeshPhysicalMaterial({ color: '#1d4fd8', roughness: 0.26, metalness: 0.04, clearcoat: 1, clearcoatRoughness: 0.08 });
  }
  if (spec.kind === 'phone') {
    return new MeshPhysicalMaterial({ color: '#1b2230', roughness: 0.3, metalness: 0.6, clearcoat: 0.8, clearcoatRoughness: 0.15 });
  }
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
  extras: { screen?: Texture; circuit?: Texture } = {},
): MaterialSet {
  const body = bodyMaterial(spec, palette);
  let top: MeshPhysicalMaterial | undefined;
  if (legend) {
    top = body.clone();
    top.color.set('#ffffff');
    top.map = legend.map as Texture;
    if (legend.bump) {
      top.bumpMap = legend.bump;
      top.bumpScale = 1.2;
    }
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
  const glass = new MeshPhysicalMaterial({
    color: '#070a0e',
    metalness: 0.2,
    roughness: 0.06,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    envMapIntensity: 1.2,
  });
  const markHex = spec.mark && MARKS[spec.mark] ? MARKS[spec.mark]!.hex : null;
  const ink = new MeshPhysicalMaterial({
    color: markHex ? inkColor(markHex) : '#ffffff',
    roughness: 0.3,
    metalness: 0,
    clearcoat: 0.8,
    clearcoatRoughness: 0.12,
  });
  const rim = new MeshPhysicalMaterial({ color: '#d6d9de', metalness: 1, roughness: 0.2, clearcoat: 0.4 });
  const brass = new MeshPhysicalMaterial({ color: '#c9a24a', metalness: 1, roughness: 0.25, clearcoat: 0.3 });
  const screen = new MeshPhysicalMaterial({
    color: '#05070b',
    roughness: 0.15,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    map: extras.screen ?? null,
    emissive: '#ffffff',
    emissiveMap: extras.screen ?? null,
    emissiveIntensity: 0.9,
    alphaTest: 0.5,
  });
  const circuit = new MeshPhysicalMaterial({
    color: '#0c2a26',
    roughness: 0.1,
    metalness: 0.2,
    clearcoat: 1,
    map: extras.circuit ?? null,
    emissive: '#ffffff',
    emissiveMap: extras.circuit ?? null,
    emissiveIntensity: 0.35,
  });
  return { body, top, metal, polished, accent, glass, rim, ink, brass, screen, circuit };
}

/** The name's materials: brushed warm-white alloy letters on dark anodised plinths. */
export function nameMaterials(palette: Palette): {
  letters: MeshPhysicalMaterial;
  slab: MeshPhysicalMaterial;
} {
  return {
    letters: new MeshPhysicalMaterial({
      color: palette.paper.clone().multiplyScalar(0.9),
      metalness: 0.8,
      roughness: 0.26,
      clearcoat: 0.6,
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
