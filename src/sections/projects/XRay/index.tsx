import { ProjectFrame } from '../../../components/ProjectFrame/ProjectFrame';
import { projects } from '../../../content/projects';
import { XRayDemo } from './XRayDemo';

const project = projects.find((p) => p.id === 'xray')!;

/** XRay project section: the challenge "Find what changed." with the X-Ray Lens rig as the demo. */
export default function XRay() {
  return (
    <ProjectFrame project={project}>
      <XRayDemo />
    </ProjectFrame>
  );
}
