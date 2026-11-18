import type { ReactNode } from 'react';
import './Tag.css';

/** A small mono chip for a technology or topic. Not interactive. */
export function Tag({ children }: { children: ReactNode }) {
  return <span className="tag mono">{children}</span>;
}

/** Props for {@link TagList}. */
export interface TagListProps {
  /** Accessible name of the list, e.g. "Stack". */
  label: string;
  items: string[];
}

/** A wrapping list of {@link Tag}s, one `<li>` each. */
export function TagList({ label, items }: TagListProps) {
  return (
    <ul className="tag-list" aria-label={label}>
      {items.map((t) => (
        <li key={t}>
          <Tag>{t}</Tag>
        </li>
      ))}
    </ul>
  );
}
