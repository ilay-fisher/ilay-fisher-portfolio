import { CaseKey } from '../../components/CaseKey/CaseKey';
import { Nav } from '../../components/Nav/Nav';
import { usePageMeta } from '../../lib/documentMeta';
import { homeHref } from '../../lib/route';
import './ProjectPage.css';

/**
 * Shown for a `/work/...` address that is not a project: a small rounded panel and one key home.
 * Hosting answers every path with the same page, so it also asks search engines to skip it.
 */
export function NotFound() {
  usePageMeta({ title: 'Page not found — Ilay Fisher', robots: 'noindex' });
  return (
    <div id="top" className="case">
      <Nav base="/" />
      <main id="main" className="case__main case__main--lost">
        <div className="container">
          <div className="case-lost stage case-enter">
            <h1 className="case-lost__title">Page not found.</h1>
            <p>There is nothing at this address.</p>
            <CaseKey href={homeHref()} direction="back">
              Back to home
            </CaseKey>
          </div>
        </div>
      </main>
    </div>
  );
}
