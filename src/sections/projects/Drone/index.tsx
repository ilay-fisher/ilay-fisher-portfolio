import { useSyncExternalStore } from 'react';
import { ProjectFrame } from '../../../components/ProjectFrame/ProjectFrame';
import { projects } from '../../../content/projects';
import { DroneRig } from './DroneRig';

const project = projects[1]!;

const subscribe = () => () => {};
const readFlag = () => new URLSearchParams(window.location.search).get('drone');
const readServerFlag = () => null;

/**
 * Drone project section: the live route-blocking rig inside the shared project frame.
 * Test flags, read from `?drone=`: `test` gives a fixed seed with no idle run and a test probe on
 * `window.__drone`; `test-auto` keeps the idle run with the probe.
 */
export default function Drone() {
  const flag = useSyncExternalStore(subscribe, readFlag, readServerFlag);
  const test = flag === 'test' || flag === 'test-auto';
  return (
    <ProjectFrame project={project}>
      <DroneRig
        seed={test ? 7 : undefined}
        autoRun={flag === 'test' ? false : true}
        expose={test}
        regoalMs={flag === 'test' ? 0 : 2500}
      />
    </ProjectFrame>
  );
}
