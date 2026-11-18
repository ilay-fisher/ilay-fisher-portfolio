import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button, LinkButton } from './Button';

describe('Button', () => {
  it('is a type=button by default and fires onClick', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Reset</Button>);
    const b = screen.getByRole('button', { name: 'Reset' });
    expect(b).toHaveAttribute('type', 'button');
    await userEvent.click(b);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('applies the variant class', () => {
    render(<Button variant="primary">Go</Button>);
    expect(screen.getByRole('button')).toHaveClass('btn', 'btn--primary');
  });

  it('does not fire when disabled', async () => {
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>Nope</Button>);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('LinkButton', () => {
  it('opens external https links safely in a new tab', () => {
    render(<LinkButton href="https://github.com/x">GitHub</LinkButton>);
    const a = screen.getByRole('link', { name: /GitHub/ });
    expect(a).toHaveAttribute('target', '_blank');
    expect(a).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('keeps in-page and mailto links in the same tab', () => {
    render(
      <>
        <LinkButton href="#about">About</LinkButton>
        <LinkButton href="mailto:a@b.co">Mail</LinkButton>
      </>,
    );
    expect(screen.getByRole('link', { name: 'About' })).not.toHaveAttribute('target');
    expect(screen.getByRole('link', { name: 'Mail' })).not.toHaveAttribute('target');
  });

  it('announces that external links open a new tab', () => {
    render(<LinkButton href="https://safesurfsite.com">Site</LinkButton>);
    expect(screen.getByRole('link')).toHaveAccessibleName('Site (opens in a new tab)');
  });
});
