import React from 'react';
import { render, screen, cleanup, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import type { PropsWithChildren } from 'react';
import { createWidgets } from './widget.js';

const lazyWidget = (text: string, delay = 10) =>
  React.lazy(
    () =>
      new Promise<{ default: React.ComponentType }>((resolve) =>
        setTimeout(() => resolve({ default: () => <div>{text}</div> }), delay),
      ),
  );

describe('suspense boundary', () => {
  beforeEach(() => cleanup());

  it('shows chrome.suspenseFallback while a widget suspends', async () => {
    const { Widgets } = createWidgets({
      components: { slow: lazyWidget('loaded') },
      chrome: { suspenseFallback: <div>waiting…</div> },
    });

    render(<Widgets items={[{ id: 's', type: 'slow' as const, props: {} }]} />);

    expect(screen.getByText('waiting…')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('loaded')).toBeInTheDocument());
  });

  it('lets an instance override the factory suspenseFallback', async () => {
    const { Widgets } = createWidgets({
      components: { slow: lazyWidget('loaded') },
      chrome: { suspenseFallback: <div>factory</div> },
    });

    render(
      <Widgets
        chrome={{ suspenseFallback: <div>instance</div> }}
        items={[{ id: 's', type: 'slow' as const, props: {} }]}
      />,
    );

    expect(screen.getByText('instance')).toBeInTheDocument();
    expect(screen.queryByText('factory')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('loaded')).toBeInTheDocument());
  });

  it('cannot be stripped by a custom chrome.item', async () => {
    // The boundary lives in renderWidget, not in DefaultItem. This item chrome
    // renders children directly and still must not let the suspension escape.
    const BareItem = ({ children }: PropsWithChildren) => children;

    const { Widgets } = createWidgets({
      components: { slow: lazyWidget('loaded') },
      chrome: { item: BareItem, suspenseFallback: <div>waiting…</div> },
    });

    render(<Widgets items={[{ id: 's', type: 'slow' as const, props: {} }]} />);

    expect(screen.getByText('waiting…')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('loaded')).toBeInTheDocument());
  });

  it('isolates suspension per widget, so a resolved sibling renders immediately', async () => {
    const Fast = () => <div>fast</div>;
    const { Widgets } = createWidgets({
      components: { slow: lazyWidget('loaded'), fast: Fast },
      chrome: { suspenseFallback: <div>waiting…</div> },
    });

    render(
      <Widgets
        items={[
          { id: 's', type: 'slow' as const, props: {} },
          { id: 'f', type: 'fast' as const, props: {} },
        ]}
      />,
    );

    expect(screen.getByText('waiting…')).toBeInTheDocument();
    expect(screen.getByText('fast')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('loaded')).toBeInTheDocument());
  });

  it('suspends and resolves a data-fetching widget', async () => {
    // A widget that fetches its own data suspends through the same mechanism
    // whether it is `use(promise)` on the client or the `await` in an async
    // Server Component. `use` is the form this suite can exercise: rendering an
    // async component needs a flight renderer, which jsdom has none of.
    const fetched = new Map<string, Promise<string>>();
    const fetchValue = (id: string) => {
      const existing = fetched.get(id);
      if (existing) return existing;
      const promise = new Promise<string>((resolve) =>
        setTimeout(() => resolve(`fetched:${id}`), 10),
      );
      fetched.set(id, promise);
      return promise;
    };

    const AsyncWidget = ({ id }: { id: string }) => (
      <div>{React.use(fetchValue(id))}</div>
    );

    const { Widgets } = createWidgets({
      components: { async: AsyncWidget },
      chrome: { suspenseFallback: <div>waiting…</div> },
    });

    // The render has to happen inside an awaited act, or React warns that a
    // component suspended in an un-awaited act scope and never retries.
    await act(async () => {
      render(
        <Widgets
          items={[{ id: 'a', type: 'async' as const, props: { id: '7' } }]}
        />,
      );
      await fetchValue('7');
    });

    await waitFor(() =>
      expect(screen.getByText('fetched:7')).toBeInTheDocument(),
    );
  });

  it('lets a suspension escape the region under chrome.suspense: none', async () => {
    // What `none` gives up, asserted where it shows: with no boundary of its
    // own, a widget that suspends anyway suspends whatever boundary is above
    // the region, and the resolved sibling goes down with it.
    const Fast = () => <div>fast</div>;
    const { Widgets } = createWidgets({
      components: { slow: lazyWidget('loaded'), fast: Fast },
      chrome: { suspense: 'none', suspenseFallback: <div>inner</div> },
    });

    render(
      <React.Suspense fallback={<div>outer</div>}>
        <Widgets
          items={[
            { id: 's', type: 'slow' as const, props: {} },
            { id: 'f', type: 'fast' as const, props: {} },
          ]}
        />
      </React.Suspense>,
    );

    expect(screen.getByText('outer')).toBeInTheDocument();
    expect(screen.queryByText('inner')).not.toBeInTheDocument();
    expect(screen.queryByText('fast')).not.toBeInTheDocument();

    await waitFor(() => expect(screen.getByText('loaded')).toBeInTheDocument());
    expect(screen.getByText('fast')).toBeInTheDocument();
  });

  it('renders a synchronous region unchanged under chrome.suspense: none', () => {
    const Fast = ({ label }: { label: string }) => <div>{label}</div>;
    const { Widgets } = createWidgets({
      components: { fast: Fast },
      chrome: { suspense: 'none' },
    });

    const { container } = render(
      <Widgets
        items={[
          { id: 'a', type: 'fast' as const, props: { label: 'one' } },
          { id: 'b', type: 'fast' as const, props: { label: 'two' } },
        ]}
      />,
    );

    expect(screen.getByText('one')).toBeInTheDocument();
    expect(screen.getByText('two')).toBeInTheDocument();
    // The item chrome is outside the boundary either way, so turning it off
    // changes nothing a consumer keys off.
    expect(container.querySelectorAll('[data-widget-id]')).toHaveLength(2);
  });

  it('renders nothing rather than a placeholder when no fallback is configured', async () => {
    const { Widgets } = createWidgets({
      components: { slow: lazyWidget('loaded') },
    });

    const { container } = render(
      <Widgets items={[{ id: 's', type: 'slow' as const, props: {} }]} />,
    );

    expect(container.textContent).toBe('');
    await waitFor(() => expect(screen.getByText('loaded')).toBeInTheDocument());
  });
});
