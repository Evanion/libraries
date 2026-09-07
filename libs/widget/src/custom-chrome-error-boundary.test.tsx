import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createWidgets } from './widget.js';

const ExplodingWidget = () => {
  throw new Error('widget exploded');
};

const SafeWidget = ({ label }: { label: string }) => (
  <span data-testid={`safe-${label}`}>{label}</span>
);

describe('custom item chrome keeps error boundary', () => {
  beforeEach(() => {
    cleanup();
  });

  it('catches errors with default item chrome', () => {
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const { Widgets } = createWidgets({
      components: { safe: SafeWidget, boom: ExplodingWidget },
    });

    render(
      <Widgets
        items={[
          { id: 'b1', type: 'boom' as const, props: {} },
          { id: 's1', type: 'safe' as const, props: { label: 'ok' } },
        ]}
      />,
    );

    expect(screen.getByText('Widget failed to render: boom')).toBeInTheDocument();
    expect(screen.getByTestId('safe-ok')).toBeInTheDocument();
    errorSpy.mockRestore();
  });

  it('catches errors with custom item chrome', () => {
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const { Widgets } = createWidgets({
      components: { safe: SafeWidget, boom: ExplodingWidget },
      chrome: {
        item: ({ children, ...rest }) => (
          <div data-testid="custom-item" {...rest}>
            {children}
          </div>
        ),
      },
    });

    render(
      <Widgets
        items={[
          { id: 'b1', type: 'boom' as const, props: {} },
          { id: 's1', type: 'safe' as const, props: { label: 'ok' } },
        ]}
      />,
    );

    expect(screen.getAllByTestId('custom-item')).toHaveLength(2);
    expect(screen.getByText('Widget failed to render: boom')).toBeInTheDocument();
    expect(screen.getByTestId('safe-ok')).toBeInTheDocument();
    errorSpy.mockRestore();
  });
});
