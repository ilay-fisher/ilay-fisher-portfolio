/**
 * Presets, recorded diagnoses and benchmark figures for the X-Ray demo.
 *
 * Everything here comes from the owner's repository (github.com/ilay-fisher/multimodal-visual-qa-xray-lens):
 * the sample image pairs in `backend/samples`, the benchmark table and model comparison in its
 * README, the Claude Haiku 5.5 output shown in `docs/images/haiku-u2.png`, and the wording of its
 * demo rule engine (`backend/app/vlm_client.py`). Nothing is generated at runtime: the diagnosis
 * is a replay of a recorded result, never a live model call.
 */
import type { Box } from './diff';

/** Severity scale of the project's `DefectReport` schema. */
export type Severity = 'low' | 'medium' | 'high' | 'critical';

/** One recorded finding. `null` means the README does not record that field. */
export interface Diagnosis {
  /** Short name of the part or area, shown as the region title. */
  label: string;
  /** Centre of the region in natural pixels, used to match a detected box to this finding. */
  at: { x: number; y: number };
  category: string;
  severity: Severity | null;
  /** 0 to 1. */
  confidence: number | null;
  description: string;
  /** Where each field comes from, shown under the diagnosis. */
  provenance: string;
}

/** One selectable sample pair. */
export interface Preset {
  id: 'pcb' | 'aerial' | 'ui';
  label: string;
  /** Alt text for the target image. */
  alt: string;
  baseline: string;
  target: string;
  /** Precomputed heatmap (same size as the diff canvas), used if pixel access fails. */
  heatFallback: string;
  width: number;
  height: number;
  expectedRegions: number;
  /** Boxes in natural pixels, used if pixel access fails. Generated from the diff stage. */
  fallbackRegions: Box[];
  diagnoses: Diagnosis[];
}

/** Figures from the project README benchmark (Claude Haiku 5.5, three presets, four regions). */
export const BENCHMARK = {
  fullTokens: 2460,
  roiTokens: [117, 121] as [number, number],
  tokensSavedPct: [95.1, 95.2] as [number, number],
  cloudMs: { full: 17838, roi: 10034 },
  cloudLatencySavedPct: 43.7,
  regionsRight: '4/4',
} as const;

const README_NOTE = 'Category and confidence: README benchmark, Claude Haiku 5.5.';
const RULES_NOTE = 'Wording: the repo demo rule engine.';

/** The three shipped presets. The PCB pair comes first. */
export const PRESETS: Preset[] = [
  {
    id: 'pcb',
    label: 'PCB board',
    alt: 'A green circuit board with three chips and nine small resistors',
    baseline: '/images/xray/pcb-baseline.webp',
    target: '/images/xray/pcb-target.webp',
    heatFallback: '/images/xray/pcb-heat.png',
    width: 960,
    height: 640,
    expectedRegions: 2,
    fallbackRegions: [
      { x: 602, y: 160, w: 76, h: 42 },
      { x: 364, y: 238, w: 38, h: 28 },
    ],
    diagnoses: [
      {
        label: 'R5',
        at: { x: 640, y: 181 },
        category: 'missing_component',
        severity: null,
        confidence: 0.92,
        description: 'Part missing on the right; only bare pads remain.',
        provenance: `${README_NOTE} Severity not recorded. ${RULES_NOTE}`,
      },
      {
        label: 'U2',
        at: { x: 383, y: 252 },
        category: 'solder_bridge',
        severity: 'high',
        confidence: 0.82,
        description:
          'Left half shows two parallel gold pads with a green stripe running between them and no foreign material. Right half shows the same pad layout, but a bright gray metallic blob sits across the green center region, bridging the adjacent pads. The pad surfaces remain visible otherwise.',
        provenance:
          'Recorded output of a live UI run with Claude Haiku 5.5 and 3x small-crop upscaling (README, docs/images/haiku-u2.png).',
      },
    ],
  },
  {
    id: 'aerial',
    label: 'Aerial crop',
    alt: 'Aerial view of green crop rows with a dirt track across the bottom',
    baseline: '/images/xray/aerial-baseline.webp',
    target: '/images/xray/aerial-target.webp',
    heatFallback: '/images/xray/aerial-heat.png',
    width: 960,
    height: 640,
    expectedRegions: 1,
    fallbackRegions: [{ x: 528, y: 160, w: 202, h: 164 }],
    diagnoses: [
      {
        label: 'Crop patch',
        at: { x: 629, y: 242 },
        category: 'irrigation_stress',
        severity: null,
        confidence: null,
        description: 'Vegetation turned yellow-brown versus the baseline.',
        provenance: `Category: README model comparison (correct for Claude Haiku 5.5). Severity and confidence not recorded. ${RULES_NOTE}`,
      },
    ],
  },
  {
    id: 'ui',
    label: 'UI layout',
    alt: 'A dashboard screen with three metric cards and a list of recent activity',
    baseline: '/images/xray/ui-baseline.webp',
    target: '/images/xray/ui-target.webp',
    heatFallback: '/images/xray/ui-heat.png',
    width: 960,
    height: 640,
    expectedRegions: 1,
    fallbackRegions: [{ x: 744, y: 288, w: 76, h: 58 }],
    diagnoses: [
      {
        label: 'Export button',
        at: { x: 782, y: 317 },
        category: 'clipped_element',
        severity: null,
        confidence: null,
        description: 'Element is cut off in the target but whole in the baseline.',
        provenance: `Category: README model comparison (correct for Claude Haiku 5.5). Severity and confidence not recorded. ${RULES_NOTE}`,
      },
    ],
  },
];

/** The recorded finding nearest (by centre) to a detected region, or undefined if there is none. */
export function diagnosisFor(preset: Preset, box: Box): Diagnosis | undefined {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  let best: Diagnosis | undefined;
  let bestD = Infinity;
  for (const d of preset.diagnoses) {
    const dist = Math.hypot(d.at.x - cx, d.at.y - cy);
    if (dist < bestD) {
      bestD = dist;
      best = d;
    }
  }
  return best;
}
