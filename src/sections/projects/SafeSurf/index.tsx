import { ProjectFrame } from '../../../components/ProjectFrame/ProjectFrame';
import { projects } from '../../../content/projects';
import { SafeSurfDemo } from './SafeSurfDemo';

const project = projects[0]!;
const DEFAULT_DELAY_MS = 8000;

/**
 * Test hook: `?safesurfDelay=1500` shortens the demo's delay so e2e never sleeps long.
 * Clamped to 300 ms to 60 s; anything else falls back to the default.
 */
function delayFromQuery(): number {
  if (typeof window === 'undefined') return DEFAULT_DELAY_MS;
  const raw = Number(new URLSearchParams(window.location.search).get('safesurfDelay'));
  return Number.isFinite(raw) && raw >= 300 && raw <= 60000 ? raw : DEFAULT_DELAY_MS;
}

/** Capture hook: `?safesurfManual=1` makes the burn advance only on `safesurf:step` events. */
function manualFromQuery(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('safesurfManual') === '1';
}

/** SafeSurf project section: the challenge headline and the playable filter rig. */
export default function SafeSurf() {
  return (
    <ProjectFrame project={project} demoLabel="SafeSurf filter demo">
      <SafeSurfDemo delayMs={delayFromQuery()} manualClock={manualFromQuery()} />
    </ProjectFrame>
  );
}
