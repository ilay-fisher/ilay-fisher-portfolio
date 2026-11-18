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
    render(
      <Button disabled onClick={onClick}>
        Nope
      </Button>,
    );
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

describe('Button feel', () => {
  it('primary buttons opt in to the magnetic pull and the pointer sheen, secondary only the sheen', () => {
    render(
      <>
        <Button variant="primary">Go</Button>
        <Button>Other</Button>
      </>,
    );
    expect(screen.getByRole('button', { name: 'Go' })).toHaveAttribute('data-magnetic');
    expect(screen.getByRole('button', { name: 'Go' })).toHaveClass('sheen');
    expect(screen.getByRole('button', { name: 'Other' })).not.toHaveAttribute('data-magnetic');
    expect(screen.getByRole('button', { name: 'Other' })).toHaveClass('sheen');
  });

  it('magnetic can be switched off or on explicitly', () => {
    render(
      <>
        <Button variant="primary" magnetic={false}>
          Still
        </Button>
        <Button magnetic>Lean</Button>
      </>,
    );
    expect(screen.getByRole('button', { name: 'Still' })).not.toHaveAttribute('data-magnetic');
    expect(screen.getByRole('button', { name: 'Lean' })).toHaveAttribute('data-magnetic');
  });

  it('LinkButton shares the same opt-ins', () => {
    render(
      <LinkButton variant="primary" href="mailto:a@b.co">
        Mail
      </LinkButton>,
    );
    expect(screen.getByRole('link')).toHaveAttribute('data-magnetic');
  });
});
