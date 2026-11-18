import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { profile } from '../../content/profile';
import About from './index';

describe('About', () => {
  it('is the #about section with an h2 and the thesis', () => {
    render(<About />);
    expect(document.getElementById('about')).not.toBeNull();
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
    expect(screen.getByText(profile.thesis)).toBeInTheDocument();
  });

  it('tells the SafeSurf origin story from the content module', () => {
    render(<About />);
    for (const p of profile.about.paragraphs) expect(screen.getByText(p)).toBeInTheDocument();
  });

  it('lists every built item and every stack tag', () => {
    render(<About />);
    for (const b of profile.about.built) expect(screen.getByText(b)).toBeInTheDocument();
    const stack = screen.getByRole('list', { name: 'Stack' });
    for (const s of profile.about.stack) expect(stack).toHaveTextContent(s);
  });

  it('shows the availability line', () => {
    render(<About />);
    expect(screen.getByText(profile.availability)).toBeInTheDocument();
  });

  it('renders the portrait with alt, size and lazy loading', () => {
    render(<About />);
    const img = screen.getByRole('img', { name: /Ilay Fisher/ });
    expect(img).toHaveAttribute('src', profile.photo);
    expect(img).toHaveAttribute('width', '800');
    expect(img).toHaveAttribute('height', '800');
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(img.getAttribute('alt')).not.toBe('');
  });

  it('falls back to the IF monogram when the portrait fails to load', () => {
    render(<About />);
    fireEvent.error(screen.getByRole('img', { name: /Ilay Fisher/ }));
    expect(document.querySelector('img')).toBeNull();
    const mono = screen.getByRole('img', { name: /Ilay Fisher/ });
    expect(mono).toHaveTextContent(profile.initials);
  });

  it('has a Writing strip linking to LinkedIn with the six topics and no post text', () => {
    render(<About />);
    expect(screen.getByRole('heading', { level: 3, name: 'Writing' })).toBeInTheDocument();
    const topics = screen.getByRole('list', { name: 'Series topics' });
    for (const t of profile.writing.topics) expect(topics).toHaveTextContent(t);
    const link = screen.getByRole('link', { name: /LinkedIn/ });
    expect(link).toHaveAttribute('href', profile.writing.url);
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
