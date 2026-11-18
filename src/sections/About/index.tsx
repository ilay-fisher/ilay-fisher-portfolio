import { Section } from '../../components/Section/Section';
import { TagList } from '../../components/Tag/Tag';
import { profile } from '../../content/profile';

/** About. STUB with real copy: worker B owns the layout and the portrait. */
export default function About() {
  return (
    <Section id="about" title="Built alone, end to end." summary={profile.role}>
      {profile.about.paragraphs.map((p) => (
        <p key={p}>{p}</p>
      ))}
      <h3>What I built</h3>
      <ul>
        {profile.about.built.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>
      <TagList label="Stack" items={profile.about.stack} />
    </Section>
  );
}
