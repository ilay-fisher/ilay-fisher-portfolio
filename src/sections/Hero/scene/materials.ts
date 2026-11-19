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

/** Cream enamel of a token plate: reads on the dark stage and carries any brand colour. */
const TOKEN_ENAMEL = '#ecebe5';

/** Ceramic of the SafeGuard icon's face. The artwork is #FFFFFF; lit by the scene it needs headroom. */
const ICON_FACE_WHITE = '#f3f2ee';

/**
 * GitHub: GitHub's mark for dark backgrounds is white. The raised disc is white ceramic (a touch off pure white so
 * the key light does not clip) and the octocat is its cut-out, a recess down to a GitHub-black enamel plate.
 */
const GITHUB_BLACK = '#1f2328';
/** The white of the GitHub disc, the same off-white family as the SafeGuard tile and the badge letters. */
const GITHUB_WHITE = '#f3f2ee';
/** The white of a badge's raised letters (TypeScript, LinkedIn); a touch off pure white so the key light does not clip. */
const BADGE_WHITE = '#f4f4f0';

/** The brand's own colour for the raised mark; only darkened when it would vanish on cream enamel. */
export function markColor(hex: string): Color {
  const c = new Color(`#${hex.replace('#', '')}`);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  return luminance(c) > 0.55 ? c.setHSL(hsl.h, hsl.s, hsl.l * 0.72) : c;
}

/** Base body material for a finish: anodised aluminium, glazed ceramic or machined alloy. */
export function bodyMaterial(spec: ObjectSpec, palette: Palette): MeshPhysicalMaterial {
  const s = spec.shade;
  if (spec.kind === 'badge' && spec.mark && MARKS[spec.mark]) {
    // The logo's own tile: glazed ceramic in the brand colour, exactly as the official mark specifies it.
    return new MeshPhysicalMaterial({
      color: `#${MARKS[spec.mark]!.hex}`,
      roughness: 0.3,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.1,
    });
  }
  if (spec.kind === 'token' && spec.mark && MARKS[spec.mark]) {
    return new MeshPhysicalMaterial({
      color: spec.mark === 'github' ? GITHUB_BLACK : TOKEN_ENAMEL,
      roughness: 0.26,
      metalness: 0.04,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
    });
  }
  if (spec.kind === 'shield') {
    // The icon's white face, as glazed ceramic: a touch off pure white so the key light does not clip it.
    return new MeshPhysicalMaterial({
      color: ICON_FACE_WHITE,
      roughness: 0.34,
      metalness: 0,
      clearcoat: 0.7,
      clearcoatRoughness: 0.18,
    });
  }
  if (spec.kind === 'logo') {
    return new MeshPhysicalMaterial({
      color: TOKEN_ENAMEL,
      roughness: 0.26,
      metalness: 0.04,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
    });
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
  extras: { logo?: Texture; circuit?: Texture } = {},
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
  const ink =
    spec.mark === 'github' && spec.kind === 'token'
      ? new MeshPhysicalMaterial({
          color: GITHUB_WHITE,
          roughness: 0.3,
          metalness: 0.1,
          clearcoat: 0.9,
          clearcoatRoughness: 0.1,
        })
      : new MeshPhysicalMaterial({
          color: spec.kind === 'badge' ? BADGE_WHITE : markHex ? markColor(markHex) : '#ffffff',
          roughness: 0.3,
          metalness: 0,
          clearcoat: 0.8,
          clearcoatRoughness: 0.12,
        });
  const rim = new MeshPhysicalMaterial({
    color: '#d6d9de',
    metalness: 1,
    roughness: 0.2,
    clearcoat: 0.4,
  });
  const brass = new MeshPhysicalMaterial({
    color: '#c9a24a',
    metalness: 1,
    roughness: 0.25,
    clearcoat: 0.3,
  });
  const logo = new MeshPhysicalMaterial({
    color: '#ffffff',
    roughness: 0.2,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    map: extras.logo ?? null,
    emissive: '#ffffff',
    emissiveMap: extras.logo ?? null,
    emissiveIntensity: 0.28,
    alphaTest: 0.5,
  });
  // The icon's raised art takes its exact colours per vertex (gradients), so the material itself is white.
  const iconBlue = new MeshPhysicalMaterial({
    color: '#ffffff',
    vertexColors: true,
    roughness: 0.3,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.1,
  });
  const iconGold = new MeshPhysicalMaterial({
    color: '#ffffff',
    vertexColors: true,
    roughness: 0.26,
    metalness: 0.15,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
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
  return {
    body,
    top,
    metal,
    polished,
    accent,
    glass,
    rim,
    ink,
    brass,
    logo,
    iconBlue,
    iconGold,
    circuit,
  };
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
