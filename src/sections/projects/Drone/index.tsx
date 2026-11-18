import { DemoPlaceholder } from '../../../components/DemoPlaceholder/DemoPlaceholder';
import { ProjectFrame } from '../../../components/ProjectFrame/ProjectFrame';
import { projects } from '../../../content/projects';

const project = projects[1]!;

/** Drone project section. STUB: replace the placeholder with the demo, keep `data-testid="drone-demo"`. */
export default function Drone() {
  return (
    <ProjectFrame project={project}>
      <DemoPlaceholder testId="drone-demo" label="Drone route sandbox" />
    </ProjectFrame>
  );
}
