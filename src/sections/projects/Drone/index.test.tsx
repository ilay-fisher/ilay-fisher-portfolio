import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Drone from './index';

describe('Drone section', () => {
  it('renders inside ProjectFrame with the challenge headline, the rig and the project links once', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => null);
    render(<Drone />);
    expect(screen.getByRole('heading', { name: "Block the drone's route." })).toBeInTheDocument();
    expect(screen.getByTestId('drone-demo')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Live demo/ })).toHaveLength(1);
    expect(screen.getAllByRole('link', { name: /Source/ })).toHaveLength(1);
    expect(document.getElementById('drone')).toBeInTheDocument();
  });
});
