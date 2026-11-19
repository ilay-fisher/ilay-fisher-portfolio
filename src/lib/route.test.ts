import { describe, expect, it } from 'vitest';
import { homeHref, parseRoute, workPath } from './route';

describe('parseRoute', () => {
  it('maps the root and any non-work path to home', () => {
    expect(parseRoute('/')).toEqual({ kind: 'home' });
    expect(parseRoute('')).toEqual({ kind: 'home' });
    expect(parseRoute('/index.html')).toEqual({ kind: 'home' });
    expect(parseRoute('/something-else')).toEqual({ kind: 'home' });
  });

  it('maps /work/<id> to a project page for each known project', () => {
    expect(parseRoute('/work/safesurf')).toEqual({ kind: 'work', id: 'safesurf' });
    expect(parseRoute('/work/drone')).toEqual({ kind: 'work', id: 'drone' });
    expect(parseRoute('/work/xray')).toEqual({ kind: 'work', id: 'xray' });
  });

  it('ignores a trailing slash and the case of the slug', () => {
    expect(parseRoute('/work/drone/')).toEqual({ kind: 'work', id: 'drone' });
    expect(parseRoute('/work/Drone')).toEqual({ kind: 'work', id: 'drone' });
  });

  it('gives not-found for an unknown slug, a bare /work and deeper paths', () => {
    expect(parseRoute('/work/nope')).toEqual({ kind: 'notfound' });
    expect(parseRoute('/work')).toEqual({ kind: 'notfound' });
    expect(parseRoute('/work/')).toEqual({ kind: 'notfound' });
    expect(parseRoute('/work/drone/extra')).toEqual({ kind: 'notfound' });
  });

  it('does not treat a prototype key as a project', () => {
    expect(parseRoute('/work/constructor')).toEqual({ kind: 'notfound' });
    expect(parseRoute('/work/__proto__')).toEqual({ kind: 'notfound' });
  });
});

describe('links', () => {
  it('workPath is the clean URL of a project page', () => {
    expect(workPath('xray')).toBe('/work/xray');
  });

  it('homeHref points at the home page, optionally at a section', () => {
    expect(homeHref()).toBe('/');
    expect(homeHref('safesurf')).toBe('/#safesurf');
  });
});
