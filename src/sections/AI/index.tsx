import { Reveal } from '../../components/Reveal/Reveal';
import { Section } from '../../components/Section/Section';
import { aiWorkflows } from '../../content/aiWorkflows';
import './AI.css';

/**
 * AI and agent workflows: three short cards about the agent tooling I built (release agent,
 * manager and subagent orchestration, skills, plugins and scheduled tasks). A quiet secondary section near the end of the page. The
 * tooling has no public repo, so the cards are plain text, never links, and nothing here frames the projects.
 */
export default function AI() {
  const { title, accent, items } = aiWorkflows;
  return (
    <Section id="ai" title={title} accent={accent} className="ai">
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
          </article>
        ))}
      </Reveal>
    </Section>
  );
}
