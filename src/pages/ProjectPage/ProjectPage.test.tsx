import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { projects } from '../../content/projects';
import { NotFound } from './NotFound';
import { ProjectPage } from './ProjectPage';

beforeEach(() => {
  window.scrollTo = vi.fn();
});
afterEach(() => {
  document.title = '';
  document.head.querySelectorAll('meta[name="description"]').forEach((m) => m.remove());
});

describe('ProjectPage', () => {
  it('renders the project title as the one h1 inside main', () => {
    render(<ProjectPage id="drone" />);
    const main = document.getElementById('main')!;
    expect(main).toBeInTheDocument();
    const h1 = within(main).getAllByRole('heading', { level: 1 });
    expect(h1).toHaveLength(1);
    expect(h1[0]).toHaveTextContent(projects.find((p) => p.id === 'drone')!.title);
  });

  it('sets the document title and the meta description, creating the tag when missing', () => {
    render(<ProjectPage id="xray" />);
    expect(document.title).toContain(projects.find((p) => p.id === 'xray')!.title);
    expect(document.title).toContain('Ilay Fisher');
    const meta = document.head.querySelector('meta[name="description"]');
    expect(meta?.getAttribute('content')?.length).toBeGreaterThan(40);
  });

  it('updates an existing meta description instead of adding another', () => {
    const m = document.createElement('meta');
    m.name = 'description';
    m.content = 'old';
    document.head.appendChild(m);
    render(<ProjectPage id="safesurf" />);
    const all = document.head.querySelectorAll('meta[name="description"]');
    expect(all).toHaveLength(1);
    expect(all[0]!.getAttribute('content')).not.toBe('old');
  });

  it('has a real back link to the project section on the home page', () => {
    render(<ProjectPage id="drone" />);
    const back = screen.getByRole('link', { name: /back to overview/i });
    expect(back).toHaveAttribute('href', '/#drone');
  });

  it('links to the previous and next project as real anchors, wrapping around', () => {
    render(<ProjectPage id="safesurf" />);
    expect(screen.getByRole('link', { name: /previous project/i })).toHaveAttribute(
      'href',
      '/work/drone',
    );
    expect(screen.getByRole('link', { name: /next project/i })).toHaveAttribute(
      'href',
      '/work/xray',
    );
  });

  it('shows the case study sections and the stack', () => {
    render(<ProjectPage id="xray" />);
    for (const name of ['The problem', 'What I built', 'How it works', 'Numbers', 'Stack'])
      expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument();
    for (const s of projects.find((p) => p.id === 'xray')!.stack)
      expect(screen.getAllByText(s).length).toBeGreaterThan(0);
  });

  it('opens outbound project links in a new tab, safely', () => {
    render(<ProjectPage id="drone" />);
    const live = screen.getAllByRole('link', { name: /live demo/i })[0]!;
    expect(live).toHaveAttribute('href', 'https://ilay-fisher.github.io/drone-obstacle-sandbox/');
    expect(live).toHaveAttribute('target', '_blank');
    expect(live).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('ends with a contact call to action that uses the profile email', () => {
    render(<ProjectPage id="drone" />);
    expect(screen.getByRole('link', { name: /email ilay/i })).toHaveAttribute(
      'href',
      'mailto:ilay3002@gmail.com',
    );
  });

  it('ends with the same contact panel as the home page, without the hero wit line', () => {
    render(<ProjectPage id="drone" />);
    const contact = document.getElementById('contact')!;
    expect(within(contact).getByRole('heading', { name: /get in touch/i })).toBeInTheDocument();
    expect(within(contact).getByTestId('contact-email')).toHaveTextContent('ilay3002@gmail.com');
    expect(within(contact).getByRole('button', { name: /copy email/i })).toBeInTheDocument();
    expect(within(contact).getByRole('link', { name: /whatsapp/i })).toBeInTheDocument();
    expect(within(contact).getByRole('link', { name: /call ilay/i })).toBeInTheDocument();
    expect(within(contact).queryByText(/throwing things was fun/i)).toBeNull();
  });

  it('renders the real screenshots with alt text', () => {
    render(<ProjectPage id="xray" />);
    const imgs = screen.getAllByRole('img').filter((i) => i.getAttribute('src')?.endsWith('.webp'));
    expect(imgs.length).toBeGreaterThanOrEqual(1);
    for (const i of imgs) expect(i.getAttribute('alt')!.length).toBeGreaterThan(10);
  });

  it('nav links on a project page point at the home page sections', () => {
    render(<ProjectPage id="drone" />);
    const nav = screen.getByRole('navigation', { name: 'Sections' });
    expect(within(nav).getByRole('link', { name: 'Get in touch' })).toHaveAttribute(
      'href',
      '/#contact',
    );
    expect(within(nav).getByRole('link', { name: 'Ilay Fisher' })).toHaveAttribute('href', '/#top');
  });
});

describe('NotFound', () => {
  it('says so and links home', () => {
    render(<NotFound />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/not found/i);
    expect(screen.getByRole('link', { name: /back to home/i })).toHaveAttribute('href', '/');
  });

  it('keeps the page out of search results', () => {
    render(<NotFound />);
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
      'noindex',
    );
    expect(document.title).toMatch(/not found/i);
  });
});
