import { DemoPlaceholder } from '../../../components/DemoPlaceholder/DemoPlaceholder';
import { ProjectFrame } from '../../../components/ProjectFrame/ProjectFrame';
import { projects } from '../../../content/projects';

const project = projects[0]!;

/** SafeSurf project section. STUB: replace the placeholder with the demo, keep `data-testid="safesurf-demo"`. */
export default function SafeSurf() {
  return (
    <ProjectFrame project={project}>
      <DemoPlaceholder testId="safesurf-demo" label="SafeSurf filter demo" />
    </ProjectFrame>
  );
}
