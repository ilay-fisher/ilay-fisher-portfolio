import { describe, expect, it } from 'vitest';
import { projects } from '../../../content/projects';
import { BENCHMARK, PRESETS, diagnosisFor } from './data';

describe('benchmark numbers match the content module', () => {
  const nums = projects[2]!.numbers!;
  it('uses the README token and latency figures', () => {
    expect(BENCHMARK.fullTokens).toBe(2460);
    expect(BENCHMARK.roiTokens).toEqual([117, 121]);
    expect(nums.some((n) => n.label.includes('2,460') && n.label.includes('117-121'))).toBe(true);
    expect(nums.some((n) => n.value === '43.7%')).toBe(true);
    expect(BENCHMARK.cloudLatencySavedPct).toBe(43.7);
  });
  it('cloud timings are consistent with the saved share', () => {
    const s = (1 - BENCHMARK.cloudMs.roi / BENCHMARK.cloudMs.full) * 100;
    expect(s).toBeCloseTo(BENCHMARK.cloudLatencySavedPct, 1);
  });
});

describe('presets and diagnoses', () => {
  it('ships pcb first with the expected region counts', () => {
    expect(PRESETS[0]!.id).toBe('pcb');
    expect(PRESETS.map((p) => p.expectedRegions)).toEqual([2, 1, 1]);
  });
  it('every preset has a diagnosis for each expected region, labelled as recorded', () => {
    for (const p of PRESETS) {
      expect(p.diagnoses).toHaveLength(p.expectedRegions);
      for (const d of p.diagnoses) {
        expect(d.provenance).toMatch(/recorded|README/i);
        expect(d.description.length).toBeGreaterThan(20);
        if (d.confidence !== null) {
          expect(d.confidence).toBeGreaterThan(0);
          expect(d.confidence).toBeLessThanOrEqual(1);
        }
      }
    }
  });
  it('PCB U2 is the solder bridge at high severity and 82% confidence', () => {
    const pcb = PRESETS[0]!;
    const u2 = pcb.diagnoses.find((d) => d.label === 'U2')!;
    expect(u2).toMatchObject({ category: 'solder_bridge', severity: 'high', confidence: 0.82 });
    expect(pcb.diagnoses.find((d) => d.label === 'R5')!.category).toBe('missing_component');
  });
  it('aerial and ui categories match the README', () => {
    expect(PRESETS[1]!.diagnoses[0]!.category).toBe('irrigation_stress');
    expect(PRESETS[2]!.diagnoses[0]!.category).toBe('clipped_element');
  });
  it('diagnosisFor maps a region to the nearest recorded finding by centre', () => {
    const pcb = PRESETS[0]!;
    const near = (label: string) => {
      const d = pcb.diagnoses.find((x) => x.label === label)!;
      return { x: d.at.x - 10, y: d.at.y - 10, w: 20, h: 20 };
    };
    expect(diagnosisFor(pcb, near('U2'))!.label).toBe('U2');
    expect(diagnosisFor(pcb, near('R5'))!.label).toBe('R5');
  });
  it('fallback regions exist for every preset', () => {
    for (const p of PRESETS) expect(p.fallbackRegions).toHaveLength(p.expectedRegions);
  });
});
