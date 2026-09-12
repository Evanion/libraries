import { render, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createWidgets } from './widget.js';

const Leaf = ({ label }: { label: string }) => <span>{label}</span>;

/** Items the type checker would reject; the renderer meets them at runtime. */
type LooseItems = Parameters<
  ReturnType<typeof createWidgets<{ leaf: typeof Leaf }>>['Widgets']
>[0]['items'];

function unknownTypeWarnings(calls: unknown[][]) {
  return calls.filter((call) =>
    call.some(
      (arg) => typeof arg === 'string' && arg.includes('Unknown widget type'),
    ),
  );
}

describe('dev warnings', () => {
  beforeEach(() => {
    cleanup();
  });

  it('reports one bad item once, however often it re-renders', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { Widgets } = createWidgets({ components: { leaf: Leaf } });
    const items = [
      { id: 'stale', type: 'gone', props: {} },
    ] as unknown as LooseItems;

    const { rerender } = render(<Widgets items={items} />);
    rerender(<Widgets items={items} ctx={{ pass: 2 }} />);
    rerender(<Widgets items={items} ctx={{ pass: 3 }} />);

    expect(unknownTypeWarnings(warn.mock.calls)).toHaveLength(1);
    warn.mockRestore();
  });

  it('reports a second bad item separately', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { Widgets } = createWidgets({ components: { leaf: Leaf } });

    render(
      <Widgets
        items={
          [
            { id: 'one', type: 'gone', props: {} },
            { id: 'two', type: 'gone', props: {} },
            { id: 'one', type: 'gone', props: {} },
          ] as unknown as LooseItems
        }
      />,
    );

    expect(unknownTypeWarnings(warn.mock.calls)).toHaveLength(2);
    warn.mockRestore();
  });

  it('logs nothing when NODE_ENV is production', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubEnv('NODE_ENV', 'production');
    const { Widgets } = createWidgets({ components: { leaf: Leaf } });

    render(
      <Widgets
        items={
          [{ id: 'quiet', type: 'gone', props: {} }] as unknown as LooseItems
        }
      />,
    );

    expect(unknownTypeWarnings(warn.mock.calls)).toHaveLength(0);
    vi.unstubAllEnvs();
    warn.mockRestore();
  });
});
