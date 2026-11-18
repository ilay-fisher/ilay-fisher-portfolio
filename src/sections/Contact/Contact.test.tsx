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

  it('has LinkedIn and GitHub as external secondary links', () => {
    render(<Contact />);
    for (const [name, href] of [
      [/LinkedIn/, profile.links.linkedin],
      [/GitHub/, profile.links.github],
    ] as const) {
      const a = screen.getByRole('link', { name });
      expect(a).toHaveAttribute('href', href);
      expect(a).toHaveAttribute('rel', 'noopener noreferrer');
      expect(a).toHaveAttribute('target', '_blank');
    }
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
