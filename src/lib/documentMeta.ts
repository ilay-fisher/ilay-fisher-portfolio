import { useEffect } from 'react';

/** What a page tells the browser and search engines about itself. */
export interface PageMeta {
  title: string;
  /** Meta description; also copied to `og:description` when that tag exists. */
  description?: string;
  /** `noindex` for pages that should stay out of search results. */
  robots?: 'noindex';
}

/** Finds `<meta name|property=key>` in the head, or adds it. Returns the tag and whether it was added. */
function metaTag(attr: 'name' | 'property', key: string): { el: HTMLMetaElement; added: boolean } {
  const found = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (found) return { el: found, added: false };
  const el = document.createElement('meta');
  el.setAttribute(attr, key);
  document.head.appendChild(el);
  return { el, added: true };
}

/**
 * Sets the document title and meta tags for the page and puts the previous values back when the page unmounts.
 * The home page keeps the tags from `index.html`; a project page overrides them for its own lifetime.
 */
export function usePageMeta({ title, description, robots }: PageMeta): void {
  useEffect(() => {
    const undo: (() => void)[] = [];
    const prevTitle = document.title;
    document.title = title;
    undo.push(() => (document.title = prevTitle));

    const set = (attr: 'name' | 'property', key: string, value: string, onlyIfPresent = false) => {
      const present = document.head.querySelector(`meta[${attr}="${key}"]`);
      if (onlyIfPresent && !present) return;
      const { el, added } = metaTag(attr, key);
      const prev = el.getAttribute('content');
      el.setAttribute('content', value);
      undo.push(() => {
        if (added) el.remove();
        else if (prev !== null) el.setAttribute('content', prev);
      });
    };
    if (description) {
      set('name', 'description', description);
      set('property', 'og:description', description, true);
    }
    set('property', 'og:title', title, true);
    if (robots) set('name', 'robots', robots);
    return () => undo.reverse().forEach((u) => u());
  }, [title, description, robots]);
}
