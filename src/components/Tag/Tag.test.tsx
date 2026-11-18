import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Tag, TagList } from './Tag';

describe('Tag', () => {
  it('renders its text', () => {
    render(<Tag>Kotlin</Tag>);
    expect(screen.getByText('Kotlin')).toHaveClass('tag');
  });
});

describe('TagList', () => {
  it('renders one list item per tag with an accessible name', () => {
    render(<TagList label="Stack" items={['A', 'B', 'C']} />);
    const list = screen.getByRole('list', { name: 'Stack' });
    expect(list.querySelectorAll('li')).toHaveLength(3);
  });
});
