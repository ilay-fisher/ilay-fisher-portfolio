import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { projects } from '../../content/projects';
import { ProjectFrame } from './ProjectFrame';

const safesurf = projects[0]!;

describe('ProjectFrame', () => {
  it('renders the section id, challenge heading and summary from the project', () => {
    render(
      <ProjectFrame project={safesurf}>
        <div data-testid="safesurf-demo" />
      </ProjectFrame>,
    );
    expect(document.getElementById('safesurf')?.tagName).toBe('SECTION');
    expect(screen.getByRole('heading', { level: 2, name: safesurf.challenge })).toBeInTheDocument();
    expect(screen.getByText(safesurf.summary)).toBeInTheDocument();
  });

  it('shows the bench labels: case, project, status', () => {
    render(<ProjectFrame project={safesurf} />);
    const row = screen.getByTestId('bench-label');
    expect(within(row).getByText(safesurf.caseNo)).toBeInTheDocument();
    expect(within(row).getByText(safesurf.title)).toBeInTheDocument();
    expect(within(row).getByText(safesurf.status)).toBeInTheDocument();
  });

  it('renders every stack tag and link, external links safely', () => {
    render(<ProjectFrame project={safesurf} />);
    for (const s of safesurf.stack) expect(screen.getByText(s)).toBeInTheDocument();
    for (const l of safesurf.links) {
      const a = screen.getByRole('link', { name: new RegExp(l.label) });
      expect(a).toHaveAttribute('href', l.href);
      expect(a).toHaveAttribute('rel', expect.stringContaining('noopener'));
    }
  });

  it('puts children in a labelled demo region', () => {
    render(
      <ProjectFrame project={safesurf}>
        <div data-testid="safesurf-demo" />
      </ProjectFrame>,
    );
    const region = screen.getByRole('group', { name: /SafeSurf.*demo/i });
    expect(within(region).getByTestId('safesurf-demo')).toBeInTheDocument();
  });

  it('renders proof numbers when the project has them', () => {
    render(<ProjectFrame project={projects[2]!} />);
    expect(screen.getByText('43.7%')).toBeInTheDocument();
  });
});

describe('ProjectFrame (v2)', () => {
  it('seats the demo on a large lit stage and draws no corner ticks', () => {
    render(
      <ProjectFrame project={safesurf}>
        <div data-testid="safesurf-demo" />
      </ProjectFrame>,
    );
    const stage = screen.getByRole('group', { name: /SafeSurf.*demo/i });
    expect(stage).toHaveClass('stage');
    expect(stage).not.toHaveClass('ticks');
  });

  it('lists the key points as rounded spec rows', () => {
    render(<ProjectFrame project={safesurf} />);
    for (const p of safesurf.points) {
      expect(screen.getByText(p).closest('li')).toHaveClass('spec-row');
    }
  });
});
