import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Section } from './Section';

describe('Section', () => {
  it('renders a section with the given id labelled by its heading', () => {
    render(<Section id="about" title="Who I am" />);
    const section = screen.getByRole('region', { name: 'Who I am' });
    expect(section.tagName).toBe('SECTION');
    expect(section).toHaveAttribute('id', 'about');
    expect(screen.getByRole('heading', { level: 2, name: 'Who I am' })).toBeInTheDocument();
  });

  it('can render the heading as an h1', () => {
    render(<Section id="top" title="Ilay Fisher" headingAs="h1" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Ilay Fisher' })).toBeInTheDocument();
  });

  it('renders the bench-label row only for the fields given', () => {
    const { rerender } = render(<Section id="x" title="T" />);
    expect(screen.queryByTestId('bench-label')).not.toBeInTheDocument();
    rerender(<Section id="x" title="T" bench={[{ label: 'case', value: 'CASE-01' }, { label: 'status', value: 'Live' }]} />);
    const row = screen.getByTestId('bench-label');
    expect(within(row).getByText('case')).toBeInTheDocument();
    expect(within(row).getByText('CASE-01')).toBeInTheDocument();
    expect(within(row).getByText('Live')).toBeInTheDocument();
  });

  it('renders summary and children', () => {
    render(
      <Section id="x" title="T" summary="One line.">
        <p>body</p>
      </Section>,
    );
    expect(screen.getByText('One line.')).toBeInTheDocument();
    expect(screen.getByText('body')).toBeInTheDocument();
  });

  it('can hide the heading visually but keep it for assistive tech', () => {
    render(<Section id="x" title="Hidden title" hideTitle />);
    expect(screen.getByRole('heading', { name: 'Hidden title' })).toHaveClass('visually-hidden');
  });
});
