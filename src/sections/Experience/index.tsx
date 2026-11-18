import { Section } from '../../components/Section/Section';
import { profile } from '../../content/profile';

/** Experience and education. STUB with real copy: worker B owns the layout. */
export default function Experience() {
  const { education } = profile;
  return (
    <Section id="experience" title="What I have shipped and taught.">
      <ol>
        {profile.experience.map((e) => (
          <li key={e.id}>
            <h3>
              {e.role}, {e.org}
            </h3>
            <p className="mono">
              {e.period}. {e.kind}.
            </p>
            <ul>
              {e.highlights.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      <h3>Education</h3>
      <p>
        {education.school}: {education.degree}, {education.period}. Grade average{' '}
        {education.average}.
      </p>
    </Section>
  );
}
