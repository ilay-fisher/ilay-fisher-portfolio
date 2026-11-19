import { lazy, Suspense } from 'react';
import App from './App';
import { parseRoute } from './lib/route';

// Project pages are a separate chunk: the home page does not pay for them.
const ProjectPage = lazy(() =>
  import('./pages/ProjectPage/ProjectPage').then((m) => ({ default: m.ProjectPage })),
);
const NotFound = lazy(() =>
  import('./pages/ProjectPage/NotFound').then((m) => ({ default: m.NotFound })),
);

/**
 * Picks the page for the address, once per document load: the one-page home, a project's case study, or not-found.
 * No router library and no client-side navigation: links between pages are plain anchors, so back, forward, refresh,
 * new-tab opens and scroll restoration are the browser's own. Hosting answers every path with `index.html`.
 */
export function Root({ pathname = window.location.pathname }: { pathname?: string }) {
  const route = parseRoute(pathname);
  if (route.kind === 'home') return <App />;
  return (
    <Suspense fallback={null}>
      {route.kind === 'work' ? <ProjectPage id={route.id} /> : <NotFound />}
    </Suspense>
  );
}
