import { useSyncExternalStore } from 'react';
import { ProjectFrame } from '../../../components/ProjectFrame/ProjectFrame';
import { projects } from '../../../content/projects';
import { DroneRig } from './DroneRig';

const project = projects.find((p) => p.id === 'drone')!;

const subscribe = () => () => {};
const readFlag = () => new URLSearchParams(window.location.search).get('drone');
const readServerFlag = () => null;

/**
 * Drone project section: the live route-blocking rig inside the shared project frame.
 * Test flags, read from `?drone=`: `test` gives a fixed seed, no idle run, a test probe on
 * `window.__drone` and a manual clock (time only moves when the probe's `step()` is called);
 * `test-auto` adds the idle run; `test-live` and `test-live-auto` keep the real frame loop.
 */
export default function Drone() {
  const flag = useSyncExternalStore(subscribe, readFlag, readServerFlag);
  const test = flag !== null && flag.startsWith('test');
  const live = test && flag.includes('live');
  return (
    <ProjectFrame project={project}>
      <DroneRig
        seed={test ? 7 : undefined}
        autoRun={test ? flag.includes('auto') : true}
        expose={test}
        regoalMs={test ? 0 : 2500}
        clock={test && !live ? 'manual' : 'raf'}
      />
    </ProjectFrame>
  );
}
