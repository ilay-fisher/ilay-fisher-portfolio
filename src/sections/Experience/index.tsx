import { Reveal } from '../../components/Reveal/Reveal';
import { Section } from '../../components/Section/Section';
import { Tag } from '../../components/Tag/Tag';
import { profile } from '../../content/profile';
import { Reading } from './Reading';
import { READINGS } from './readings';
import './Experience.css';

/**
 * Experience: bench readings (the numbers), a timeline of the three roles, then education.
 * Semantic lists throughout; the timeline is an ordered list because the order is the point.
 */
export default function Experience() {
  const { education } = profile;
  return (
    <Section
      id="experience"
      title="What I have shipped and taught."
      className="experience"
      bench={[{ label: 'since', value: 'Apr 2024' }]}
    >
      <Reveal className="readings rig ticks">
        <h3 className="visually-hidden">Readings</h3>
        <ul className="readings__list" aria-label="Bench readings">
          {READINGS.map((r) => (
            <Reading key={r.id} data={r} />
          ))}
        </ul>
      </Reveal>

      <ol className="timeline" aria-label="Roles">
        {profile.experience.map((e) => (
          <li key={e.id} className="timeline__item">
            <div className="timeline__when mono">
              <span>{e.period}</span>
              <span className="timeline__kind">{e.kind}</span>
            </div>
            <div className="timeline__body">
              <h3>{e.role}</h3>
              <p className="timeline__org">{e.org}</p>
              <ul className="timeline__points">
                {e.highlights.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ol>

      <div className="education">
        <h3>Education</h3>
        <dl className="spec">
          <div className="spec__row">
            <dt className="mono">School</dt>
            <dd>
              <span>{education.school}</span>
            </dd>
          </div>
          <div className="spec__row">
            <dt className="mono">Degree</dt>
            <dd>{education.degree}</dd>
          </div>
          <div className="spec__row">
            <dt className="mono">Period</dt>
            <dd>{education.period}</dd>
          </div>
          <div className="spec__row">
            <dt className="mono">Grade average</dt>
            <dd>{education.average}</dd>
          </div>
          <div className="spec__row">
            <dt className="mono">Courses</dt>
            <dd>
              <ul className="tag-list" aria-label="Courses">
                {education.courses.map((c) => (
                  <li key={c}>
                    <Tag>{c}</Tag>
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        </dl>
      </div>
    </Section>
  );
}
