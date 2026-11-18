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
    rerender(
      <Section
        id="x"
        title="T"
        bench={[
          { label: 'case', value: 'CASE-01' },
          { label: 'status', value: 'Live' },
        ]}
      />,
    );
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

describe('Section (v2)', () => {
  it('marks one accent word inside a string title without changing the accessible name', () => {
    render(<Section id="x" title="Built alone, end to end." accent="end to end" />);
    const h = screen.getByRole('heading', { level: 2 });
    expect(h).toHaveAccessibleName('Built alone, end to end.');
    const accent = h.querySelector('.accent');
    expect(accent).not.toBeNull();
    expect(accent).toHaveTextContent('end to end');
  });

  it('ignores an accent that is not in the title', () => {
    render(<Section id="x" title="Plain title" accent="missing" />);
    expect(document.querySelector('.accent')).toBeNull();
  });

  it('shows each bench label as a pill', () => {
    render(<Section id="x" title="T" bench={[{ label: 'status', value: 'Live' }]} />);
    const row = screen.getByTestId('bench-label');
    expect(row.querySelector('.pill')).not.toBeNull();
  });

  it('has no hairline top rule class: sections are separated by space and light, not lines', () => {
    render(<Section id="x" title="T" />);
    expect(document.getElementById('x')).not.toHaveClass('section--ruled');
  });
});
