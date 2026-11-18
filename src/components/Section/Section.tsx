import type { ReactNode } from 'react';
import { Reveal } from '../Reveal/Reveal';
import './Section.css';

/** One bench label: a small `label value` pair such as `case CASE-01`, shown on a pill. */
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
  /** A phrase inside a string `title` that takes the accent colour. At most one per headline. */
  accent?: string;
  /** `h1` only for the hero. Defaults to `h2`. */
  headingAs?: 'h1' | 'h2';
  /** Keep the heading for assistive tech but do not show it. */
  hideTitle?: boolean;
  /** Label pills shown above the heading (case number, status, ...). */
  bench?: BenchField[];
  /** One-line summary under the heading. */
  summary?: ReactNode;
  className?: string;
  children?: ReactNode;
}

/** Splits `title` around the first occurrence of `accent` and wraps it in `.accent`. */
function withAccent(title: ReactNode, accent?: string): ReactNode {
  if (typeof title !== 'string' || !accent) return title;
  const at = title.indexOf(accent);
  if (at < 0) return title;
  return (
    <>
      {title.slice(0, at)}
      <span className="accent">{accent}</span>
      {title.slice(at + accent.length)}
    </>
  );
}

/**
 * The only way to create a page section: renders `<section id>` with an accessible heading
 * (words rise with weight, one accent phrase allowed) and the label-pill row, so all sections
 * share one anatomy. Sections are separated by space and light, not by lines.
 */
export function Section({
  id,
  title,
  accent,
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
          <Reveal as="dl" variant="stagger" className="bench-label" data-testid="bench-label">
            {bench.map((f) => (
              <div key={f.label} className="bench-label__field pill">
                <dt>{f.label}</dt>
                <dd>{f.value}</dd>
              </div>
            ))}
          </Reveal>
        )}
        <Heading id={headingId} className={hideTitle ? 'visually-hidden' : 'section__title'}>
          {hideTitle ? (
            title
          ) : (
            <Reveal as="span" variant="words" className="section__title-text">
              {withAccent(title, accent)}
            </Reveal>
          )}
        </Heading>
        {summary && (
          <Reveal as="p" variant="up" className="section__summary">
            {summary}
          </Reveal>
        )}
        {children}
      </div>
    </section>
  );
}
