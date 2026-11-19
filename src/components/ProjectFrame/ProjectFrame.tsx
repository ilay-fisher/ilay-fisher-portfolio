import type { ReactNode } from 'react';
import type { Project } from '../../content/projects';
import { workPath } from '../../lib/route';
import { LinkButton } from '../Button/Button';
import { CaseKey } from '../CaseKey/CaseKey';
import { Section } from '../Section/Section';
import { TagList } from '../Tag/Tag';
import './ProjectFrame.css';

/** Props for {@link ProjectFrame}. */
export interface ProjectFrameProps {
  /** Content from `src/content/projects.ts`. Its `id` becomes the section id. */
  project: Project;
  /** The interactive demo. Give the root element its `data-testid`. */
  children?: ReactNode;
  /** Accessible name of the demo region. Defaults to "<title> demo". */
  demoLabel?: string;
}

/**
 * The shared shape of the three project sections: bench labels, a challenge headline,
 * a one-line summary, the demo slot (a large rounded lit stage), then key points, links, numbers
 * and stack tags. Keeps SafeSurf, Drone and X-Ray looking like one family.
 */
export function ProjectFrame({ project, children, demoLabel }: ProjectFrameProps) {
  const p = project;
  return (
    <Section
      id={p.id}
      title={p.challenge}
      summary={p.summary}
      className="project"
      bench={[
        { label: 'case', value: p.caseNo },
        { label: 'project', value: p.title },
        { label: 'status', value: p.status },
      ]}
    >
      <div className="project__rig stage" role="group" aria-label={demoLabel ?? `${p.title} demo`}>
        {children}
      </div>
      <div className="project__facts">
        <ul className="project__points">
          {p.points.map((pt) => (
            <li key={pt} className="spec-row">
              {pt}
            </li>
          ))}
        </ul>
        <div className="project__side">
          {p.numbers && (
            <dl className="project__numbers">
              {p.numbers.map((n) => (
                <div key={n.value}>
                  <dt>{n.value}</dt>
                  <dd>{n.label}</dd>
                </div>
              ))}
            </dl>
          )}
          <TagList label="Stack" items={p.stack} />
          <div className="project__links">
            <CaseKey href={workPath(p.id)}>Read the case study</CaseKey>
            {p.links.map((l, i) => (
              <LinkButton key={l.href} href={l.href} variant={i === 0 ? 'primary' : 'secondary'}>
                {l.label}
              </LinkButton>
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}
