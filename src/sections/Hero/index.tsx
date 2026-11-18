import { DemoPlaceholder } from '../../components/DemoPlaceholder/DemoPlaceholder';
import { Section } from '../../components/Section/Section';
import { profile } from '../../content/profile';

/** Hero. STUB: worker A replaces the placeholder with the WebGL paint headline (`hero-canvas`). */
export default function Hero() {
  return (
    <Section id="top" title={profile.name} headingAs="h1" summary={profile.thesis}>
      <DemoPlaceholder testId="hero-canvas" label="Hero paint canvas" minHeight={420} />
    </Section>
  );
}
