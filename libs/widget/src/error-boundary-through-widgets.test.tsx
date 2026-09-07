import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createWidgets } from './widget.js';

const FailingWidget = () => {
  throw new Error('Widget failed to render');
};

describe('error boundary through Widgets', () => {
  beforeEach(() => cleanup());

  it('contains a widget error when rendered through Widgets', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    const { Widgets } = createWidgets({
      components: { failing: FailingWidget },
    });

    render(
      <Widgets
        items={[{ id: 'w', type: 'failing', props: {} }]}
      />,
    );

    expect(
      screen.getByText('Widget failed to render: failing'),
    ).toBeInTheDocument();

    consoleError.mockRestore();
  });
});
