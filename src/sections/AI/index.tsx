import { Reveal } from '../../components/Reveal/Reveal';
import { Section } from '../../components/Section/Section';
import { aiWorkflows, type AiWorkflow } from '../../content/aiWorkflows';
import './AI.css';

/** The extra block of a card: the skills with their one-line notes, then the names only. */
function Skills({ item }: { item: AiWorkflow }) {
  if (!item.skills) return null;
  return (
    <>
      <dl className="ai-skills">
        {item.skills.map((s) => (
          <div className="ai-skills__row" key={s.name}>
            <dt>
              <code className="ai-chip">{s.name}</code>
            </dt>
            <dd>{s.note}</dd>
          </div>
        ))}
      </dl>
      {item.also && (
        <div className="ai-also">
          <span className="ai-also__label">Also</span>
          <ul aria-label="More skills">
            {item.also.map((name) => (
              <li key={name}>
                <code className="ai-chip">{name}</code>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

/**
 * AI and agent workflows: four short cards about the agent tooling I built (release agent, custom skills,
 * manager and subagent orchestration, content plugin). The tooling has no public repo, so the cards are plain
 * text, never links; the one closing line points to the AI work in the project sections of this page.
 */
export default function AI() {
  const { title, accent, summary, items, more } = aiWorkflows;
  return (
    <Section
      id="ai"
      title={title}
      accent={accent}
      summary={summary}
      className="ai"
      bench={[{ label: 'focus', value: 'AI agents' }]}
    >
      <Reveal variant="stagger" className="ai__grid">
        {items.map((item) => (
          <article
            className={`ai-card ai-card--${item.id} bevel`}
            key={item.id}
            aria-labelledby={`ai-${item.id}`}
          >
            <span className="ai-card__label pill">
              <span className="ai-card__lamp" aria-hidden="true" />
              {item.label}
            </span>
            <h3 id={`ai-${item.id}`}>{item.title}</h3>
            <p>{item.body}</p>
            <Skills item={item} />
          </article>
        ))}
      </Reveal>
      <Reveal className="ai__more">
        <p>
          {more.lead}{' '}
          {more.links.map((l, i) => (
            <span key={l.href}>
              {i > 0 && ' and '}
              <a href={l.href}>{l.label}</a>
            </span>
          ))}
          .
        </p>
      </Reveal>
    </Section>
  );
}
