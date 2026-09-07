import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createWidgets } from './widget.js';

const Leaf = ({ label }: { label: string }) => (
  <span data-testid={`leaf-${label}`}>{label}</span>
);

describe('malformed items are skipped instead of crashing', () => {
  beforeEach(() => {
    cleanup();
  });

  it('warns and renders nothing when items is null', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { Widgets } = createWidgets({ components: { leaf: Leaf } });

    expect(() =>
      render(<Widgets items={null as unknown as Parameters<typeof Widgets>[0]['items']} />),
    ).not.toThrow();

    expect(screen.queryByTestId(/leaf-/)).not.toBeInTheDocument();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Malformed `items` prop'),
    );
    warn.mockRestore();
  });

  it('warns and renders nothing when items is not an array', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { Widgets } = createWidgets({ components: { leaf: Leaf } });

    expect(() =>
      render(
        <Widgets
          items={{ 0: { id: 'a', type: 'leaf', props: { label: 'a' } } } as unknown as Parameters<typeof Widgets>[0]['items']}
        />,
      ),
    ).not.toThrow();

    expect(screen.queryByTestId(/leaf-/)).not.toBeInTheDocument();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Malformed `items` prop'),
    );
    warn.mockRestore();
  });

  it('warns and skips null elements, keeping valid siblings', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { Widgets } = createWidgets({ components: { leaf: Leaf } });

    expect(() =>
      render(
        <Widgets
          items={[
            null,
            { id: 'ok', type: 'leaf' as const, props: { label: 'ok' } },
          ] as unknown as Parameters<typeof Widgets>[0]['items']}
        />,
      ),
    ).not.toThrow();

    expect(screen.getByTestId('leaf-ok')).toBeInTheDocument();
    expect(screen.queryByTestId('leaf-null')).not.toBeInTheDocument();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Malformed widget item'),
    );
    warn.mockRestore();
  });

  it('warns and skips invalid elements, keeping valid siblings', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { Widgets } = createWidgets({ components: { leaf: Leaf } });

    expect(() =>
      render(
        <Widgets
          items={[
            { id: 'bad', type: 123, props: {} },
            { id: 'ok', type: 'leaf' as const, props: { label: 'ok' } },
          ] as unknown as Parameters<typeof Widgets>[0]['items']}
        />,
      ),
    ).not.toThrow();

    expect(screen.getByTestId('leaf-ok')).toBeInTheDocument();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Malformed widget item'),
    );
    warn.mockRestore();
  });
});
