import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LinkKey } from './LinkKey';
import { GitHubIcon, LinkedInIcon, MailIcon } from './icons';

describe('LinkKey', () => {
  it('renders a real link with the href, the visible label and a key class', () => {
    render(
      <LinkKey kind="github" href="https://github.com/x" icon={<GitHubIcon />}>
        GitHub
      </LinkKey>,
    );
    const a = screen.getByRole('link', { name: 'GitHub' });
    expect(a).toHaveAttribute('href', 'https://github.com/x');
    expect(a).toHaveClass('link-key');
    expect(a).toHaveAttribute('data-key', 'github');
    expect(a).toHaveTextContent('GitHub');
  });

  it('hides the icon from assistive tech', () => {
    render(
      <LinkKey kind="linkedin" href="https://l.example/in/x" icon={<LinkedInIcon />}>
        LinkedIn
      </LinkKey>,
    );
    const icon = screen.getByRole('link').querySelector('svg');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
    expect(icon).toHaveAttribute('focusable', 'false');
    expect(icon?.querySelector('title')).toBeNull();
  });

  it('opens external links in a new tab, safely, and says so to screen readers', () => {
    render(
      <LinkKey kind="linkedin" href="https://l.example/in/x" icon={<LinkedInIcon />} external>
        LinkedIn
      </LinkKey>,
    );
    const a = screen.getByRole('link', { name: /^LinkedIn\s*\(opens in a new tab\)$/ });
    expect(a).toHaveAttribute('target', '_blank');
    expect(a).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('leaves internal and mailto links in place with no extra text', () => {
    render(
      <LinkKey kind="mail" href="mailto:a@b.c" icon={<MailIcon />}>
        Email
      </LinkKey>,
    );
    const a = screen.getByRole('link', { name: 'Email' });
    expect(a).not.toHaveAttribute('target');
    expect(a).not.toHaveAttribute('rel');
  });

  it('leans toward the pointer through data-magnetic, not a second transform', () => {
    render(
      <LinkKey kind="mail" href="mailto:a@b.c" icon={<MailIcon />}>
        Email
      </LinkKey>,
    );
    expect(screen.getByRole('link')).toHaveAttribute('data-magnetic');
  });

  it('draws the envelope as a whole: body plus a flap that is never animated away', () => {
    const { container } = render(<MailIcon />);
    expect(container.querySelector('rect')).not.toBeNull();
    expect(container.querySelector('.link-key__flap')).not.toBeNull();
  });
});
