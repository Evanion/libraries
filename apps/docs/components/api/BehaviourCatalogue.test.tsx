import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import BehaviourCatalogue from './BehaviourCatalogue';

/**
 * The rail names a case and the pane shows it.
 *
 * The one thing a reader can check against this block is that the source in the
 * pane is the source of the sentence they picked, so that is what these drive:
 * a click, then an arrow key, then what the pane holds each time. The sidecar
 * is stubbed because the component's job is the pairing, and
 * `doc-behaviour-render.test.ts` holds the real sidecar against the real
 * sentences.
 */

const GROUPS = [
  {
    label: 'diffMatrix',
    rows: [{ title: 'carries both versions', id: 7 }],
  },
  {
    label: 'a widening',
    rows: [
      { title: 'reports an added allow branch as granted', id: 11 },
      { title: 'splits the branch into who, which rows and when', id: 12 },
    ],
  },
];

const SIDECAR = {
  bodies: {
    7: {
      where: 'libs/acl/src/diff-matrix.test.ts',
      line: 412,
      html: '<span>expect(report.version)</span>',
    },
    11: {
      where: 'libs/acl/src/diff-matrix.test.ts',
      line: 69,
      html: "<span>expect(finding?.cause).toBe('allow-branch-added')</span>",
    },
    12: {
      where: 'libs/acl/src/diff-matrix.test.ts',
      line: 88,
      html: '<span>expect(finding?.groups.subject)</span>',
    },
  },
  styles: { bh0: '--shiki-light:#005CC5;--shiki-dark:#79B8FF' },
  popups: {},
};

/**
 * A case whose tokens the compiler gave types, under its own library.
 *
 * Its own library because the fetch is cached per library for the lifetime of
 * the module, and the cases above are the ones the rail's tests read. The two
 * tokens are what `behaviour-data.mjs` writes: the class the theme styles, and
 * the number of the type in the sidecar's own dictionary.
 */
const TYPED_GROUPS = [
  {
    label: 'parse',
    rows: [{ title: 'reads the namespace off the front', id: 3 }],
  },
];

const TYPED = {
  bodies: {
    3: {
      where: 'libs/urn/src/parse.test.ts',
      line: 18,
      html:
        '<span class="twoslash-hover" data-pop="0">urn</span>' +
        '<span> = </span>' +
        '<span class="twoslash-hover" data-pop="1">parse</span>',
    },
  },
  styles: {},
  popups: {
    0: '<code class="twoslash-popup-code">const urn: URN</code>',
    1: '<code class="twoslash-popup-code">function parse(text: string): URN</code>',
  },
};

/**
 * The browser pieces jsdom does not bring, at their narrowest.
 *
 * `IntersectionObserver` fires once so the fetch happens, and `matchMedia`
 * answers "wide", which is the layout that puts the pane in its own column.
 */
beforeEach(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(private readonly seen: (entries: unknown[]) => void) {}
      observe() {
        this.seen([{ isIntersecting: true }]);
      }
      disconnect() {
        return undefined;
      }
      unobserve() {
        return undefined;
      }
    },
  );

  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));

  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => ({
      ok: true,
      json: async () => (url.includes('/urn.json') ? TYPED : SIDECAR),
    })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// The fetch is cached per library for the whole module, which is what makes
// one request serve a hundred entries on a page. A case that wants a different
// answer from the network asks for a different library.
const mount = (library = 'acl') =>
  render(
    <BehaviourCatalogue library={library} name="diffMatrix" groups={GROUPS} />,
  );

const mountTyped = () =>
  render(
    <BehaviourCatalogue library="urn" name="parse" groups={TYPED_GROUPS} />,
  );

/** The typed token spelling a name, once the sidecar has reached the pane. */
function reach(container: HTMLElement, text: string): HTMLElement {
  const found = [...container.querySelectorAll<HTMLElement>('[data-pop]')].find(
    (each) => each.textContent === text,
  );
  if (!found) throw new Error(`no token spells ${text}`);
  return found;
}

describe('BehaviourCatalogue', () => {
  it('names every sentence in the rail, under the group the suite wrote', () => {
    mount();

    expect(
      screen.getByRole('group', { name: 'a widening' }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('option').map((each) => each.textContent),
    ).toEqual([
      'carries both versions',
      'reports an added allow branch as granted',
      'splits the branch into who, which rows and when',
    ]);
  });

  it('shows the case behind the sentence the rail selected', async () => {
    mount();

    await waitFor(() =>
      expect(
        screen.getByText('libs/acl/src/diff-matrix.test.ts:412'),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText('expect(report.version)')).toBeInTheDocument();
  });

  it('follows a click to the case the clicked sentence names', async () => {
    mount();
    fireEvent.click(
      screen.getByRole('option', {
        name: 'splits the branch into who, which rows and when',
      }),
    );

    await waitFor(() =>
      expect(
        screen.getByText('expect(finding?.groups.subject)'),
      ).toBeInTheDocument(),
    );
    expect(
      screen.getByText('libs/acl/src/diff-matrix.test.ts:88'),
    ).toBeInTheDocument();
  });

  it('moves the selection down the rail on an arrow key', async () => {
    mount();
    const rail = screen.getByRole('listbox');
    fireEvent.keyDown(rail, { key: 'ArrowDown' });

    const selected = screen.getByRole('option', { selected: true });
    expect(selected).toHaveTextContent(
      'reports an added allow branch as granted',
    );
    expect(rail).toHaveAttribute('aria-activedescendant', selected.id);
    await waitFor(() =>
      expect(
        screen.getByText("expect(finding?.cause).toBe('allow-branch-added')"),
      ).toBeInTheDocument(),
    );
  });

  it('stops at the last sentence rather than wrapping past it', () => {
    mount();
    const rail = screen.getByRole('listbox');
    fireEvent.keyDown(rail, { key: 'End' });
    fireEvent.keyDown(rail, { key: 'ArrowDown' });

    expect(screen.getByRole('option', { selected: true })).toHaveTextContent(
      'splits the branch into who, which rows and when',
    );
  });

  it('says what happened when the cases do not load', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 404 })),
    );
    mount('widget');

    await waitFor(() =>
      expect(
        screen.getByText(/The cases for widget did not load/),
      ).toBeInTheDocument(),
    );
  });

  it('states the type behind a token the pointer reached', async () => {
    const { container } = mountTyped();
    const token = await waitFor(() => reach(container, 'urn'));

    fireEvent.pointerOver(token);

    expect(screen.getByRole('tooltip')).toHaveTextContent('const urn: URN');
    expect(token).toHaveAttribute(
      'aria-describedby',
      screen.getByRole('tooltip').id,
    );
  });

  it('walks the typed tokens from the one tab stop the pane holds', async () => {
    const { container } = mountTyped();
    const [first, second] = await waitFor(() => [
      reach(container, 'urn'),
      reach(container, 'parse'),
    ]);

    first?.focus();
    fireEvent.keyDown(first as HTMLElement, { key: 'ArrowRight' });

    expect(
      [first, second].map((each) => each?.tabIndex),
      'A reference page mounts a hundred of these, so the pane offers one ' +
        'stop and the arrows move it.',
    ).toEqual([-1, 0]);
    expect(screen.getByRole('tooltip')).toHaveTextContent(
      'function parse(text: string): URN',
    );
  });

  it('takes the card back down on Escape', async () => {
    const { container } = mountTyped();
    const token = await waitFor(() => reach(container, 'urn'));

    fireEvent.pointerOver(token);
    fireEvent.keyDown(token, { key: 'Escape' });

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('keeps the cases out of the search index', () => {
    const { container } = mount();

    expect(
      container.querySelector('.docs-behaviours__pane'),
      'Pagefind indexes the prerendered markup, and the sentences are what a ' +
        'reader searches for; the cases are code and stay out of it.',
    ).toHaveAttribute('data-pagefind-ignore', 'all');
  });
});
