import { LinkButton } from '../../components/Button/Button';
import { Section } from '../../components/Section/Section';
import { profile } from '../../content/profile';

/** Contact. STUB with real copy: worker B owns the layout. */
export default function Contact() {
  return (
    <Section id="contact" title="Get in touch." summary={profile.availability}>
      <LinkButton variant="primary" href={`mailto:${profile.email}`}>
        Email {profile.email}
      </LinkButton>{' '}
      <LinkButton href={profile.links.linkedin}>LinkedIn</LinkButton>{' '}
      <LinkButton href={profile.links.github}>GitHub</LinkButton>
    </Section>
  );
}
