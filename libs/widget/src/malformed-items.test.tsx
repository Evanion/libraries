import type React from 'react';
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

  it('warns and renders the parent when children is not an array', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const Box = ({ children }: { children?: React.ReactNode }) => (
      <div data-testid="box">{children}</div>
    );
    const { Widgets } = createWidgets({ components: { box: Box, leaf: Leaf } });

    expect(() =>
      render(
        <Widgets
          items={
            [
              { id: 'a', type: 'box', props: {}, children: 'oops' },
            ] as unknown as Parameters<typeof Widgets>[0]['items']
          }
        />,
      ),
    ).not.toThrow();

    expect(screen.getByTestId('box')).toBeInTheDocument();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Malformed `children`'),
    );
    warn.mockRestore();
  });

  it('renders duplicate sibling ids rather than validating, per the safety-net split', () => {
    // Two siblings sharing an id is a `validateItems` problem and still
    // renders: validation is the explicit gate, and the renderer only skips
    // what it cannot render at all. React's own duplicate-key warning is
    // dev-only and dropped in a production build, so `validateItems` is the
    // only place the duplicate is reported where it matters.
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const { Widgets } = createWidgets({ components: { leaf: Leaf } });

    render(
      <Widgets
        items={[
          { id: 'same', type: 'leaf' as const, props: { label: 'a' } },
          { id: 'same', type: 'leaf' as const, props: { label: 'b' } },
        ]}
      />,
    );

    expect(screen.getByTestId('leaf-a')).toBeInTheDocument();
    expect(screen.getByTestId('leaf-b')).toBeInTheDocument();
    expect(
      errorSpy.mock.calls.some((call) =>
        call.some(
          (arg) =>
            typeof arg === 'string' &&
            arg.includes('two children with the same key'),
        ),
      ),
    ).toBe(true);
    errorSpy.mockRestore();
  });
});
