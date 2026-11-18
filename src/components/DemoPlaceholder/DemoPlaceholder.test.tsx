import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DemoPlaceholder } from './DemoPlaceholder';

describe('DemoPlaceholder', () => {
  it('carries the test id and says what will go there', () => {
    render(<DemoPlaceholder testId="drone-demo" label="Drone sandbox" />);
    const el = screen.getByTestId('drone-demo');
    expect(el).toHaveTextContent('Drone sandbox');
    expect(el).toHaveTextContent(/placeholder/i);
  });
});
