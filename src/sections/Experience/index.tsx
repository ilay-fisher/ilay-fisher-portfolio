import { Reveal } from '../../components/Reveal/Reveal';
import { Section } from '../../components/Section/Section';
import { Tag } from '../../components/Tag/Tag';
import { profile } from '../../content/profile';
import { Reading } from './Reading';
import { READINGS } from './readings';
import './Experience.css';

/**
 * Experience: bench readings (the numbers), a timeline of the roles, then education.
 * Semantic lists throughout; the timeline is an ordered list because the order is the point.
 */
export default function Experience() {
  const { education } = profile;
  return (
    <Section
      id="experience"
      title="What I have shipped and taught."
      className="experience"
      bench={[{ label: 'graduating', value: 'Jul 2027' }]}
    >
      <Reveal variant="stagger" className="readings">
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
            <span className="timeline__node" aria-hidden="true" />
            <div className="timeline__when mono">
              <span>{e.period}</span>
              {e.kind && <span className="timeline__kind">{e.kind}</span>}
            </div>
            <div className="timeline__body spec-card bevel">
              <h3>{e.role}</h3>
              <p className="timeline__org">{e.org}</p>
              {e.highlights.length > 0 && (
                <ul className="timeline__points">
                  {e.highlights.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        ))}
      </ol>

      <div className="education">
        <h3>Education</h3>
        <dl className="spec education__grid">
          <div className="spec-card bevel">
            <dt className="pill">School</dt>
            <dd>{education.school}</dd>
          </div>
          <div className="spec-card bevel">
            <dt className="pill">Degree</dt>
            <dd>{education.degree}</dd>
          </div>
          <div className="spec-card bevel">
            <dt className="pill">Period</dt>
            <dd>{education.period}</dd>
          </div>
          <div className="spec-card bevel">
            <dt className="pill">Grade average</dt>
            <dd>{education.average}</dd>
          </div>
          <div className="spec-card bevel education__courses">
            <dt className="pill">Courses</dt>
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
