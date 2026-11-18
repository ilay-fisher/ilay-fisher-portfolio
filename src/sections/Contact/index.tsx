import { useEffect, useRef, useState } from 'react';
import { Button, LinkButton } from '../../components/Button/Button';
import { Section } from '../../components/Section/Section';
import { profile } from '../../content/profile';
import { createLogger } from '../../lib/logger';
import { useMagnet } from './useMagnet';
import './Contact.css';

const log = createLogger('contact');

/** A wrapper that leans toward the pointer; the focusable control inside never changes. */
function Magnet({ children }: { children: React.ReactNode }) {
  const ref = useMagnet<HTMLSpanElement>();
  return (
    <span ref={ref} className="magnet">
      {children}
    </span>
  );
}

/**
 * Contact: one ask (stated in the summary), one primary mailto button, LinkedIn and GitHub as
 * secondary links, and a copy-email control with a polite live-region confirmation.
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
    <Section id="contact" title="Get in touch." summary={profile.availability} className="contact">
      <div className="contact__panel rig ticks">
        <p className="contact__email" data-testid="contact-email">
          {profile.email}
        </p>
        <div className="contact__actions">
          <Magnet>
            <LinkButton variant="primary" href={`mailto:${profile.email}`}>
              Email Ilay
            </LinkButton>
          </Magnet>
          <Button onClick={() => void copy()}>Copy email</Button>
          <LinkButton href={profile.links.linkedin}>LinkedIn</LinkButton>
          <LinkButton href={profile.links.github}>GitHub</LinkButton>
        </div>
        <p className="contact__status mono" role="status" aria-live="polite">
          {status}
        </p>
      </div>
    </Section>
  );
}
