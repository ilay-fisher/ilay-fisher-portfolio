import { Reveal } from '../../components/Reveal/Reveal';
import { Section } from '../../components/Section/Section';
import { Tag, TagList } from '../../components/Tag/Tag';
import { LinkButton } from '../../components/Button/Button';
import { profile } from '../../content/profile';
import { Portrait } from './Portrait';
import './About.css';

/** Short bench label for each "what I built" line, in the same order as `profile.about.built`. */
const BUILT_LABELS = ['Browser', 'Enforcement', 'Models', 'Dashboard', 'Backend', 'Extension'];

/**
 * About: the thesis, the SafeSurf origin story, a spec list of what I built, the stack,
 * availability and a pointer to the LinkedIn writing. Calm and typographic on purpose.
 */
export default function About() {
  const { about, writing } = profile;
  return (
    <Section
      id="about"
      title="Built alone, end to end."
      summary={profile.thesis}
      className="about"
      bench={[{ label: 'status', value: <span className="about__open">Open to roles</span> }]}
    >
      <div className="about__lead">
        <Portrait />
        <div className="about__story">
          <p className="about__role">{profile.role}</p>
          {about.paragraphs.map((p) => (
            <p key={p}>{p}</p>
          ))}
          <p className="about__availability">
            <span className="about__dot" aria-hidden="true" />
            <span>{profile.availability}</span>
          </p>
        </div>
      </div>

      <Reveal className="about__built">
        <h3>What I built</h3>
        <dl className="spec">
          {about.built.map((b, i) => (
            <div className="spec__row" key={b}>
              <dt className="mono">{BUILT_LABELS[i] ?? 'Part'}</dt>
              <dd>{b}</dd>
            </div>
          ))}
        </dl>
      </Reveal>

      <div className="about__stack">
        <h3>Stack</h3>
        <TagList label="Stack" items={about.stack} />
      </div>

      <div className="about__writing">
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
      </div>
    </Section>
  );
}
