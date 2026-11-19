import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { profile } from '../../content/profile';
import { magnetOffset } from './magnet';
import Contact from './index';

describe('Contact', () => {
  it('is the #contact section with an h2 and the one clear ask', () => {
    render(<Contact />);
    expect(document.getElementById('contact')).not.toBeNull();
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
    expect(
      screen.getByText(/student or part-time role in Backend, Android or Systems/),
    ).toBeVisible();
    expect(screen.getByText(/3 days a week/)).toBeInTheDocument();
  });

  it('has a primary mailto button whose href equals profile.email', () => {
    render(<Contact />);
    const mail = screen.getByRole('link', { name: /Email/ });
    expect(mail).toHaveAttribute('href', `mailto:${profile.email}`);
    expect(mail).toHaveClass('btn--primary');
    expect(document.querySelectorAll('.btn--primary')).toHaveLength(1);
  });

  it('has LinkedIn and GitHub as the shared icon keys, external and safe', () => {
    render(<Contact />);
    for (const [name, href] of [
      [/^LinkedIn/, profile.links.linkedin],
      [/^GitHub/, profile.links.github],
    ] as const) {
      const a = screen.getByRole('link', { name });
      expect(a).toHaveAttribute('href', href);
      expect(a).toHaveAttribute('rel', 'noopener noreferrer');
      expect(a).toHaveAttribute('target', '_blank');
      expect(a).toHaveClass('link-key');
      expect(a).not.toHaveClass('btn');
      expect(a).toHaveAttribute('data-magnetic');
      expect(a.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
      expect(a).toHaveTextContent('(opens in a new tab)');
    }
  });

  it('keeps the mailto primary and the copy button as the loud controls', () => {
    render(<Contact />);
    expect(screen.getByRole('button', { name: /Copy email/ })).toHaveClass('btn');
    expect(document.querySelectorAll('.contact .link-key')).toHaveLength(2);
  });

  it('never shows a phone number', () => {
    render(<Contact />);
    expect(document.body.textContent).not.toMatch(/\+?\d[\d\s-]{8,}\d/);
  });

  it('copies the email to the clipboard and announces it politely', async () => {
    const user = userEvent.setup();
    render(<Contact />);
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toBeEmptyDOMElement();
    await user.click(screen.getByRole('button', { name: /Copy email/ }));
    expect(await navigator.clipboard.readText()).toBe(profile.email);
    expect(status).toHaveTextContent('Email copied.');
  });

  it('tells the visitor what to do when copying fails', async () => {
    const user = userEvent.setup();
    render(<Contact />);
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'));
    await user.click(screen.getByRole('button', { name: /Copy email/ }));
    expect(screen.getByRole('status')).toHaveTextContent(/Could not copy/);
  });
});

describe('magnetOffset', () => {
  it('pulls toward the pointer by the strength factor', () => {
    expect(magnetOffset(10, -20, 0.3, 12)).toEqual({ x: 3, y: -6 });
  });
  it('clamps to the maximum offset', () => {
    expect(magnetOffset(1000, -1000, 0.3, 12)).toEqual({ x: 12, y: -12 });
  });
});

describe('Contact (v2)', () => {
  it('is one rounded call-to-action panel, not a ticked rig', () => {
    render(<Contact />);
    expect(document.querySelector('.contact__panel.stage')).not.toBeNull();
    expect(document.querySelector('.ticks')).toBeNull();
  });

  it('shows the approved wit line near the call to action', () => {
    render(<Contact />);
    expect(
      screen.getByText('Throwing things was fun. Hiring me is more useful.'),
    ).toBeInTheDocument();
  });
});
