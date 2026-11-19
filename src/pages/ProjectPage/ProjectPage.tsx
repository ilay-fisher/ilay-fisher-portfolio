import { useEffect } from 'react';
import { LinkButton } from '../../components/Button/Button';
import { CaseKey } from '../../components/CaseKey/CaseKey';
import { Footer } from '../../components/Footer/Footer';
import { Nav } from '../../components/Nav/Nav';
import { Section } from '../../components/Section/Section';
import { TagList } from '../../components/Tag/Tag';
import { caseStudyOf, type CaseMedia } from '../../content/caseStudies';
import { profile } from '../../content/profile';
import { projects, type Project, type ProjectId } from '../../content/projects';
import { usePageMeta } from '../../lib/documentMeta';
import { homeHref, workPath } from '../../lib/route';
import { SafeSurfDemo } from '../../sections/projects/SafeSurf/SafeSurfDemo';
import './ProjectPage.css';

/** Props for {@link ProjectPage}. */
export interface ProjectPageProps {
  id: ProjectId;
}

/** A real screenshot on a large rounded stage, with its caption. */
function Shot({ media }: { media: CaseMedia }) {
  return (
    <figure className="case-shot stage">
      <img
        src={media.src}
        alt={media.alt}
        width={media.width}
        height={media.height}
        loading="lazy"
        decoding="async"
      />
      <figcaption>{media.caption}</figcaption>
    </figure>
  );
}

/** The project that comes `step` places after `id`, wrapping around the list. */
function neighbour(id: ProjectId, step: 1 | -1): Project {
  const at = projects.findIndex((p) => p.id === id);
  return projects[(at + step + projects.length) % projects.length]!;
}

/**
 * The case study page of one project: what it is, the problem, what I built, how it works, the numbers, the stack,
 * links, the next and previous project, and a contact call to action. SafeSurf has no screenshot, so it shows its
 * live filter rig; the others show real screenshots. The content blocks rise in on the soft spring (CSS, off under
 * reduced motion). The page title and meta description are its own while it is mounted.
 */
export function ProjectPage({ id }: ProjectPageProps) {
  const project = projects.find((p) => p.id === id)!;
  const study = caseStudyOf(id);
  const prev = neighbour(id, -1);
  const next = neighbour(id, 1);
  const [firstShot, ...moreShots] = study.media ?? [];

  usePageMeta({
    title: `${project.title} — Ilay Fisher`,
    description: study.metaDescription,
  });

  // A project page is a new document, so it starts at the top (unless the address names an anchor).
  useEffect(() => {
    if (!window.location.hash) window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [id]);

  const links = project.links.map((l, i) => (
    <LinkButton key={l.href} href={l.href} variant={i === 0 ? 'primary' : 'secondary'}>
      {l.label}
    </LinkButton>
  ));

  return (
    <div id="top" className="case">
      <Nav base="/" />
      <main id="main" className="case__main">
        <div
          className="case-enter"
          style={{ '--i': 0 } as React.CSSProperties}
          data-testid="case-intro"
        >
          <div className="container case__back">
            <CaseKey href={homeHref(id)} direction="back">
              Back to overview
            </CaseKey>
          </div>
          <Section
            id="case-intro"
            headingAs="h1"
            title={project.title}
            bench={[
              { label: 'case', value: project.caseNo },
              { label: 'status', value: project.status },
            ]}
            summary={project.summary}
            className="case-section case-intro"
          >
            <div className="case__links">{links}</div>
          </Section>
        </div>

        <div className="container case-enter" style={{ '--i': 1 } as React.CSSProperties}>
          {id === 'safesurf' ? (
            <div className="case-rig stage" role="group" aria-label="SafeSurf filter demo">
              <SafeSurfDemo />
            </div>
          ) : (
            firstShot && <Shot media={firstShot} />
          )}
        </div>

        <Section id="problem" title="The problem" className="case-section">
          <div className="case__prose">
            {study.problem.map((t) => (
              <p key={t}>{t}</p>
            ))}
          </div>
        </Section>

        <Section id="built" title="What I built" className="case-section">
          <ul className="case__built">
            {study.built.map((t) => (
              <li key={t} className="case-card">
                {t}
              </li>
            ))}
          </ul>
        </Section>

        <Section id="how" title="How it works" className="case-section">
          <ol className="case__how">
            {study.how.map((h) => (
              <li key={h.title} className="case-card case-card--idea">
                <h3>{h.title}</h3>
                <p>{h.body}</p>
              </li>
            ))}
          </ol>
          {moreShots.map((m) => (
            <Shot key={m.src} media={m} />
          ))}
        </Section>

        {study.numbers && (
          <Section id="numbers" title="Numbers" className="case-section">
            <dl className="case__numbers">
              {study.numbers.map((n) => (
                <div key={n.value} className="case-number">
                  <dt>{n.value}</dt>
                  <dd>{n.label}</dd>
                </div>
              ))}
            </dl>
            {study.note && <p className="case__note">{study.note}</p>}
          </Section>
        )}

        <Section id="stack" title="Stack" className="case-section">
          <TagList label="Stack" items={project.stack} />
          <div className="case__links">{links}</div>
          {!study.numbers && study.note && <p className="case__note">{study.note}</p>}
        </Section>

        <nav className="container case__pager" aria-label="Projects">
          <CaseKey href={workPath(prev.id)} direction="back" hint="Previous project">
            {prev.title}
          </CaseKey>
          <CaseKey href={workPath(next.id)} direction="forward" hint="Next project">
            {next.title}
          </CaseKey>
        </nav>

        <Section
          id="case-contact"
          title="Get in touch."
          accent="touch"
          summary={profile.availability}
          className="case-section"
        >
          <div className="case__contact stage">
            <div className="case__links">
              <LinkButton variant="primary" href={`mailto:${profile.email}`}>
                Email Ilay
              </LinkButton>
              <LinkButton href={profile.links.linkedin}>LinkedIn</LinkButton>
              <LinkButton href={profile.links.github}>GitHub</LinkButton>
            </div>
          </div>
        </Section>
      </main>
      <Footer />
    </div>
  );
}
