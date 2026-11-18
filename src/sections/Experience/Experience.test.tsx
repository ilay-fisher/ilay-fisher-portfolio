import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { profile } from '../../content/profile';
import Experience from './index';

afterEach(() => vi.unstubAllGlobals());

describe('Experience', () => {
  it('is the #experience section with an h2 and one list item per role', () => {
    render(<Experience />);
    const section = document.getElementById('experience');
    expect(section).not.toBeNull();
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
    const timeline = screen.getByRole('list', { name: 'Roles' });
    expect(within(timeline).getAllByRole('listitem', {}).length).toBeGreaterThanOrEqual(
      profile.experience.length,
    );
  });

  it('shows every role, org, period and highlight from the content module', () => {
    render(<Experience />);
    for (const e of profile.experience) {
      expect(screen.getByRole('heading', { level: 3, name: e.role })).toBeInTheDocument();
      expect(screen.getByText(e.org)).toBeInTheDocument();
      expect(screen.getByText(e.period)).toBeInTheDocument();
      for (const h of e.highlights) expect(screen.getByText(h)).toBeInTheDocument();
    }
  });

  it('shows the education entry with school, degree, period, average and courses', () => {
    render(<Experience />);
    const { education } = profile;
    expect(screen.getByRole('heading', { level: 3, name: 'Education' })).toBeInTheDocument();
    expect(screen.getByText(education.school)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(education.degree))).toBeInTheDocument();
    expect(screen.getByText(education.period)).toBeInTheDocument();
    expect(screen.getByText(String(education.average))).toBeInTheDocument();
    for (const c of education.courses) expect(screen.getByText(c)).toBeInTheDocument();
  });

  it('presents the false-block drop and 22+ releases as readings with full text for assistive tech', () => {
    render(<Experience />);
    const readings = screen.getByRole('list', { name: 'Bench readings' });
    expect(readings).toHaveTextContent('36.6%');
    expect(readings).toHaveTextContent('14.2%');
    expect(readings).toHaveTextContent('22+');
    expect(readings).toHaveTextContent(/false-block/i);
  });

  it('renders the final values immediately under reduced motion', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: q.includes('reduce'),
      media: q,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
      onchange: null,
    }));
    render(<Experience />);
    const counts = Array.from(document.querySelectorAll<HTMLElement>('[data-count]'));
    expect(counts.length).toBeGreaterThanOrEqual(2);
    expect(counts.map((c) => c.textContent)).toEqual(expect.arrayContaining(['14.2%', '22+']));
  });
});

describe('Experience (v2)', () => {
  it('shows readings as instrument tiles and the timeline with round nodes, no ticks', () => {
    render(<Experience />);
    expect(document.querySelectorAll('.reading.tile').length).toBe(4);
    expect(document.querySelectorAll('.timeline__node').length).toBe(profile.experience.length);
    expect(document.querySelector('.ticks')).toBeNull();
  });
});
