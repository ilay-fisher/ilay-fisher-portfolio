import { projects, type ProjectId } from '../content/projects';

/** Where the visitor is: the one-page home, a project's case study, or a /work path that is not a project. */
export type Route = { kind: 'home' } | { kind: 'work'; id: ProjectId } | { kind: 'notfound' };

const IDS = new Set<string>(projects.map((p) => p.id));

/**
 * Maps a URL path to a {@link Route}. Anything outside `/work` is the home page (hosting rewrites every path to
 * `index.html`, so that is what it served before). `/work/<id>` is a project; any other `/work` path is not found.
 * Case and one trailing slash are ignored. No router state: every link is a real document navigation.
 */
export function parseRoute(pathname: string): Route {
  const parts = pathname.replace(/\/+$/, '').split('/').filter(Boolean);
  if (parts[0]?.toLowerCase() !== 'work') return { kind: 'home' };
  const slug = parts[1]?.toLowerCase();
  if (parts.length === 2 && slug && IDS.has(slug)) return { kind: 'work', id: slug as ProjectId };
  return { kind: 'notfound' };
}

/** The clean URL of a project's case study page. */
export const workPath = (id: ProjectId): string => `/work/${id}`;

/** The home page, optionally at one of its sections (`/#drone`). */
export const homeHref = (sectionId?: string): string => (sectionId ? `/#${sectionId}` : '/');
