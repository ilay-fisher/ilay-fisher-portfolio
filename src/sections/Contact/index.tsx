import { useEffect, useRef, useState } from 'react';
import { Button, LinkButton } from '../../components/Button/Button';
import {
  GitHubIcon,
  LinkedInIcon,
  LinkKey,
  PhoneIcon,
  WhatsAppIcon,
} from '../../components/LinkKey/LinkKey';
import { Section } from '../../components/Section/Section';
import { profile } from '../../content/profile';
import { createLogger } from '../../lib/logger';
import './Contact.css';

const log = createLogger('contact');

/**
 * Contact: one ask (stated in the summary), one primary mailto button that leans toward the pointer, LinkedIn and GitHub as
 * the shared icon keys, and a copy-email control with a polite live-region confirmation.
 */
export default function Contact() {
  const [status, setStatus] = useState('');
  const timer = useRef<number>(0);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const say = (msg: string) => {
    setStatus(msg);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setStatus(''), 4000);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(profile.email);
      log.info('email copied');
      say('Email copied.');
    } catch (err) {
      log.error('clipboard write failed', err);
      say('Could not copy. Select the address above instead.');
    }
  };

  return (
    <Section
      id="contact"
      title="Get in touch."
      accent="touch"
      summary={profile.availability}
      className="contact"
    >
      <div className="contact__panel stage">
        <p className="contact__email" data-testid="contact-email">
          {profile.email}
        </p>
        <div className="contact__actions">
          <LinkButton variant="primary" href={`mailto:${profile.email}`}>
            Email Ilay
          </LinkButton>
          <Button onClick={() => void copy()}>Copy email</Button>
          <LinkKey
            kind="phone"
            href={profile.phoneHref}
            icon={<PhoneIcon />}
            label={`Call Ilay, ${profile.phone}`}
          >
            {profile.phone}
          </LinkKey>
          <LinkKey
            kind="whatsapp"
            href={profile.whatsapp}
            icon={<WhatsAppIcon />}
            label="Message Ilay on WhatsApp"
            external
          >
            WhatsApp
          </LinkKey>
          <LinkKey kind="linkedin" href={profile.links.linkedin} icon={<LinkedInIcon />} external>
            LinkedIn
          </LinkKey>
          <LinkKey kind="github" href={profile.links.github} icon={<GitHubIcon />} external>
            GitHub
          </LinkKey>
        </div>
        <p className="contact__wit">Throwing things was fun. Hiring me is more useful.</p>
        <p className="contact__status mono" role="status" aria-live="polite">
          {status}
        </p>
      </div>
    </Section>
  );
}
