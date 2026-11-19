import { Reveal } from '../../components/Reveal/Reveal';
import { Section } from '../../components/Section/Section';
import { Tag, TagList } from '../../components/Tag/Tag';
import { LinkButton } from '../../components/Button/Button';
import { profile } from '../../content/profile';
import { Portrait } from './Portrait';
import './About.css';

/** Short bench label for each "what I built" line, in the same order as `profile.about.built`. */
const BUILT_LABELS = [
  'Android app',
  'Enforcement',
  'On-device ML',
  'Dashboard',
  'Backend',
  'Extension',
  'CI and tests',
];

/**
 * About: the evidence lead, the SafeSurf origin story, a spec list of what I built, the skills,
 * availability and a pointer to the LinkedIn writing. Calm and typographic on purpose.
 */
export default function About() {
  const { about, writing } = profile;
  return (
    <Section
      id="about"
      title="Built and run end to end."
      accent="end to end"
      summary={about.lead}
      className="about"
      bench={[{ label: 'status', value: <span className="about__open">Open to roles</span> }]}
    >
      <div className="about__grid">
        <Reveal variant="fade" className="about__side">
          <Portrait />
        </Reveal>
        <div className="about__main">
          <Reveal variant="stagger" className="about__story">
            <p className="about__role">{profile.role}</p>
            {about.paragraphs.map((p) => (
              <p key={p}>{p}</p>
            ))}
            <p className="about__availability well">
              <span className="about__dot" aria-hidden="true" />
              <span>{profile.availability}</span>
            </p>
          </Reveal>

          <div className="about__built">
            <h3>What I built</h3>
            <Reveal as="dl" variant="stagger" className="spec">
              {about.built.map((b, i) => (
                <div className="spec-card bevel" key={b}>
                  <dt className="pill">{BUILT_LABELS[i] ?? 'Part'}</dt>
                  <dd>{b}</dd>
                </div>
              ))}
            </Reveal>
          </div>

          <div className="about__stack">
            <h3>Skills</h3>
            <TagList label="Skills" items={about.stack} />
          </div>

          <Reveal className="about__writing stage">
            <h3>Writing</h3>
            <p>{writing.blurb}</p>
            <ul className="tag-list" aria-label="Series topics">
              {writing.topics.map((t) => (
                <li key={t}>
                  <Tag>{t}</Tag>
                </li>
              ))}
            </ul>
            <LinkButton href={writing.url}>Read the series on LinkedIn</LinkButton>
          </Reveal>
        </div>
      </div>
    </Section>
  );
}
