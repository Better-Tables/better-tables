import { describe, expect, it } from 'bun:test';
import { render, screen } from '@testing-library/react';

describe('test harness', () => {
  it('renders a div via React Testing Library', () => {
    render(<div data-testid="smoke">hello</div>);
    expect(screen.getByTestId('smoke').textContent).toBe('hello');
  });
});
