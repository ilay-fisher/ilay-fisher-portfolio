import { afterEach, describe, expect, it, vi } from 'vitest';
import { openInNewTab, safeProfileUrl } from './openLink';

describe('safeProfileUrl', () => {
  it('accepts https addresses and returns them unchanged', () => {
    expect(safeProfileUrl('https://github.com/ilay-fisher')).toBe('https://github.com/ilay-fisher');
  });
  it('refuses anything that is not https (javascript:, data:, http:, relative, empty)', () => {
    for (const bad of ['javascript:alert(1)', 'data:text/html,x', 'http://example.com', '/x', ''])
      expect(safeProfileUrl(bad), bad).toBeNull();
  });
});

describe('openInNewTab', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('clicks a real anchor that opens a new tab without an opener, then removes it', () => {
    let seen: HTMLAnchorElement | null = null;
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      seen = this;
      expect(document.body.contains(this)).toBe(true);
    });
    expect(openInNewTab('https://www.linkedin.com/in/ilay-fisher/')).toBe(true);
    expect(seen).not.toBeNull();
    expect(seen!.getAttribute('href')).toBe('https://www.linkedin.com/in/ilay-fisher/');
    expect(seen!.target).toBe('_blank');
    expect(seen!.rel).toBe('noopener noreferrer');
    expect(document.body.contains(seen!)).toBe(false);
  });

  it('does nothing for an address that is not https', () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    expect(openInNewTab('javascript:alert(1)')).toBe(false);
    expect(click).not.toHaveBeenCalled();
  });
});
