import type { ReactNode } from 'react';
import { Reveal } from '../Reveal/Reveal';
import './Section.css';

/** One bench label: a small `label value` pair such as `case CASE-01`. */
export interface BenchField {
  label: string;
  value: ReactNode;
}

/** Props for {@link Section}. */
export interface SectionProps {
  /** Anchor id; must match the section contract in docs/CONTRACTS.md. */
  id: string;
  /** Heading text. Also the accessible name of the section. */
  title: ReactNode;
  /** `h1` only for the hero. Defaults to `h2`. */
  headingAs?: 'h1' | 'h2';
  /** Keep the heading for assistive tech but do not show it. */
  hideTitle?: boolean;
  /** Bench-label row shown above the heading (case number, status, ...). */
  bench?: BenchField[];
  /** One-line summary under the heading. */
  summary?: ReactNode;
  className?: string;
  children?: ReactNode;
}

/**
 * The only way to create a page section: renders `<section id>` with an accessible heading,
 * the hairline top rule and the bench-label metadata row, so all sections share one anatomy.
 */
export function Section({
  id,
  title,
  headingAs: Heading = 'h2',
  hideTitle = false,
  bench,
  summary,
  className,
  children,
}: SectionProps) {
  const headingId = `${id}-title`;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={['section', className].filter(Boolean).join(' ')}
    >
      <div className="container">
        {bench && bench.length > 0 && (
          <dl className="bench-label mono" data-testid="bench-label">
            {bench.map((f) => (
              <div key={f.label} className="bench-label__field">
                <dt>{f.label}</dt>
                <dd>{f.value}</dd>
              </div>
            ))}
          </dl>
        )}
        <Heading id={headingId} className={hideTitle ? 'visually-hidden' : 'section__title'}>
          {hideTitle ? (
            title
          ) : (
            <Reveal as="span" variant="lines" className="section__title-text">
              {title}
            </Reveal>
          )}
        </Heading>
        {summary && <p className="section__summary">{summary}</p>}
        {children}
      </div>
    </section>
  );
}
