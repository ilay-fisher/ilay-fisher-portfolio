import { DemoPlaceholder } from '../../../components/DemoPlaceholder/DemoPlaceholder';
import { ProjectFrame } from '../../../components/ProjectFrame/ProjectFrame';
import { projects } from '../../../content/projects';

const project = projects[2]!;

/** XRay project section. STUB: replace the placeholder with the demo, keep `data-testid="xray-demo"`. */
export default function XRay() {
  return (
    <ProjectFrame project={project}>
      <DemoPlaceholder testId="xray-demo" label="X-Ray Lens slider" />
    </ProjectFrame>
  );
}
