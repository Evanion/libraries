import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import ExplorerScreen, { DEBOUNCE } from './ExplorerScreen';
import {
  adopt,
  conditionText,
  declared,
  decide,
  objectKinds,
  rowFor,
  readJsonObject,
  sample,
  sampleText,
} from './explorer';

/** The box the reader pastes a document into. */
function box(): HTMLTextAreaElement {
  return screen.getByLabelText('The matrix document, as JSON');
}

/**
 * Waits out the document box's debounce.
 *
 * Real timers rather than fake ones: the component also settles React state
 * inside the timeout, and `act` around a real wait flushes both without the
 * test having to know which order they happen in. The delay is the
 * component's own constant, so a change to it cannot leave this guessing.
 */
async function settle(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, DEBOUNCE + 30));
  });
}

async function paste(text: string): Promise<void> {
  fireEvent.change(box(), { target: { value: text } });
  await settle();
}

/**
 * Presses the toolbar's Load the sample.
 *
 * The empty state offers a second one beside the sample it prints, so the
 * query takes all of them and the toolbar's is the first in document order.
 * Both set the same text.
 */
async function loadSample(): Promise<void> {
  fireEvent.click(
    screen.getAllByRole('button', { name: 'Load the sample' })[0]!,
  );
  await settle();
}

/** The sample, adopted, with the narrowing a test can assert against. */
function adopted() {
  const adoption = adopt(sampleText);
  if (adoption.state !== 'ready') {
    throw new Error(`the sample did not adopt: ${adoption.state}`);
  }
  return adoption.access;
}

/** One row of the decision table, as `column: value`. */
function row(container: HTMLElement, key: string): Record<string, string> {
  const head = [...container.querySelectorAll('thead th')].map(
    (cell) => cell.textContent!,
  );
  const found = [...container.querySelectorAll('tbody tr')].find(
    (tr) => tr.querySelector('th')?.textContent === key,
  );

  const cells = [
    found!.querySelector('th')!.textContent!,
    ...[...found!.querySelectorAll('td')].map((cell) => cell.textContent!),
  ];

  return Object.fromEntries(head.map((column, at) => [column, cells[at]!]));
}

/**
 * The explorer reports the document, and the package decides it.
 *
 * Two halves, and the split is what the assertions are about. `adopt`,
 * `declared` and `decide` are held against `@evanion/acl` directly, so a
 * change to what the engine answers breaks the test rather than the screen.
 * The rendering half is held against the empty state, the two refusals and the
 * decision table, which are the four things a reader can land on.
 */
describe('the matrix explorer', () => {
  it('opens with an instruction and the sample document in the markup', async () => {
    const { container } = render(<ExplorerScreen />);

    expect(screen.getByText('Start with this one')).toBeInTheDocument();
    expect(container.querySelector('.explorer__sample')).toHaveTextContent(
      '"version": "shop@12"',
    );
    expect(box()).toHaveValue('');
  });

  it('adopts the sample when the button is pressed', async () => {
    render(<ExplorerScreen />);

    await loadSample();

    expect(box()).toHaveValue(sampleText);
    expect(screen.getByText('What it declares')).toBeInTheDocument();
  });

  it('reports the version, the budget and the public count', async () => {
    const report = declared(adopted());

    expect(report.version).toBe('shop@12');
    expect(report.maxStale).toBe('900000 ms, 15 minutes');
    expect(report.publishedCount).toBe(2);
    expect(report.kinds.map((kind) => kind.kind)).toEqual(['listing', 'order']);
  });

  it('marks the permission the package says needs the row', async () => {
    const report = declared(adopted());
    const needs = report.permissions
      .filter((permission) => permission.readsObject)
      .map((permission) => permission.key);

    expect(needs).toEqual(['listing.update']);
  });

  it('decides every permission against the subject in the box', async () => {
    const { container } = render(<ExplorerScreen />);

    await loadSample();

    expect(row(container, 'listing.read')['reason']).toBe('allow');
    expect(row(container, 'order.refund')['reason']).toBe('no-rule-matched');
    expect(row(container, 'listing.update')['reason']).toBe('unevaluable');
    expect(row(container, 'listing.update')['missing']).toBe(
      'object.status, object.sellerId',
    );
  });

  it('moves the decisions when the subject changes', async () => {
    const { container } = render(<ExplorerScreen />);

    await loadSample();
    fireEvent.change(screen.getByLabelText('The subject, as JSON'), {
      target: { value: '{"id":"u_31","roles":["support"]}' },
    });

    expect(row(container, 'order.refund')['reason']).toBe('allow');
    expect(row(container, 'order.refund')['allowed']).toBe('true');
  });

  it('renders the reason the package returned, for every permission', async () => {
    const { container } = render(<ExplorerScreen />);

    await loadSample();

    for (const { decision } of decide(adopted(), {
      id: 'u_31',
      roles: ['seller'],
    })) {
      expect(row(container, decision.key)['reason']).toBe(decision.reason);
    }
  });

  it('separates text that is not JSON from a document the package refused', async () => {
    render(<ExplorerScreen />);

    await paste('{');
    expect(screen.getByText('That text is not JSON yet')).toBeInTheDocument();

    await paste('{"permissions":"nope"}');
    expect(screen.getByText('InvalidMatrixError')).toBeInTheDocument();
  });

  it('locates a refused value by key, field and where', async () => {
    const broken = {
      ...sample,
      permissions: [
        {
          ...sample.permissions[1]!,
          rules: [
            {
              id: 'seller',
              when: [
                { field: 'object.seller_id', op: 'eq', path: 'subject.id' },
              ],
            },
          ],
        },
      ],
    };

    const adoption = adopt(JSON.stringify(broken));

    expect(adoption).toMatchObject({
      state: 'refused',
      name: 'UnknownFieldError',
      configFault: true,
      at: {
        key: 'listing.update',
        field: 'object.seller_id',
        where: 'rules[0].when[0]',
      },
    });
  });

  it('shows the located values on the screen', async () => {
    render(<ExplorerScreen />);

    await paste(
      JSON.stringify({
        permissions: [
          {
            key: 'listing.read',
            object: 'listing',
            action: 'read',
            rules: [
              { when: [{ field: 'subject.id', op: 'equals', value: 'x' }] },
            ],
          },
        ],
      }),
    );

    expect(screen.getByText('InvalidConditionError')).toBeInTheDocument();
    expect(screen.getByText('rules[0].when[0]')).toBeInTheDocument();
  });

  it('refuses a subject that is not an object, and keeps the document', async () => {
    render(<ExplorerScreen />);

    await loadSample();
    fireEvent.change(screen.getByLabelText('The subject, as JSON'), {
      target: { value: '[1,2]' },
    });

    // Twice: once under the box, and once where the table would have been.
    expect(screen.getAllByText(/a subject is a json object/i)).toHaveLength(2);
    expect(screen.getByText('What it declares')).toBeInTheDocument();
  });

  it('announces what reading the box produced', async () => {
    const { container } = render(<ExplorerScreen />);
    const live = container.querySelector('[aria-live="polite"]')!;

    expect(live).toHaveTextContent('No document yet.');
    await loadSample();
    expect(live).toHaveTextContent('3 permissions');
  });

  it('reads a subject or a row the same way it reads a document', async () => {
    expect(readJsonObject('{"id":"u_31"}')).toEqual({
      state: 'ready',
      value: { id: 'u_31' },
    });
    expect(readJsonObject('3')).toEqual({ state: 'not-an-object' });
    expect(readJsonObject('{').state).toBe('unparsed');
  });

  it('writes a condition as one line, on either operand', async () => {
    expect(
      conditionText({ field: 'object.sellerId', op: 'eq', path: 'subject.id' }),
    ).toBe('object.sellerId eq subject.id');
    expect(
      conditionText({ field: 'subject.roles', op: 'contains', value: 'staff' }),
    ).toBe('subject.roles contains "staff"');
    expect(
      conditionText({ field: 'now', op: 'before', value: '2026-01-01' }),
    ).toBe('now before "2026-01-01"');
  });

  it('says in the document pane head what reading the box produced', async () => {
    const { container } = render(<ExplorerScreen />);
    const status = () =>
      container.querySelector('.explorer__status')!.textContent;

    expect(status()).toBe('empty');
    await paste('{');
    expect(status()).toBe('not JSON');
    await paste('{"permissions":"nope"}');
    expect(status()).toBe('refused');
    await loadSample();
    expect(status()).toBe('adopted');
  });

  /**
   * Mid-keystroke JSON is invalid most of the time, so the reports have to
   * stand rather than blank, and the screen has to say which document they
   * belong to.
   */
  it('leaves the reports standing while the box will not adopt', async () => {
    const { container } = render(<ExplorerScreen />);

    await loadSample();
    expect(row(container, 'listing.read')['reason']).toBe('allow');

    await paste(`${sampleText}  {{{`);

    expect(container.querySelector('.explorer__standing')).toBeInTheDocument();
    expect(row(container, 'listing.read')['reason']).toBe('allow');
    expect(screen.getByText('What it declares')).toBeInTheDocument();
  });

  it('drops the standing reports when the box is cleared', async () => {
    render(<ExplorerScreen />);

    await loadSample();
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    await settle();

    expect(screen.getByText('Start with this one')).toBeInTheDocument();
    expect(screen.queryByText('What it declares')).not.toBeInTheDocument();
  });

  it('names the line a JSON refusal gave up on', async () => {
    const { container } = render(<ExplorerScreen />);

    await paste('{\n  "a": 1,\n  oops\n}');

    expect(screen.getAllByText(/line 3, column 3/).length).toBeGreaterThan(0);
    expect(
      container.querySelector('.explorer__line[data-error]')?.textContent,
    ).toContain('oops');
  });

  it('names the line a construction refusal points at', async () => {
    const { container } = render(<ExplorerScreen />);

    await paste(sampleText.replace('object.sellerId', 'object.seller_id'));

    expect(screen.getByText('UnknownFieldError')).toBeInTheDocument();
    expect(
      container.querySelector('.explorer__line[data-error]')?.textContent,
    ).toContain('listing.update');
  });

  it('highlights the JSON in the box with the shared token classes', async () => {
    const { container } = render(<ExplorerScreen />);

    await loadSample();
    const layer = container.querySelector('.explorer__layer')!;

    expect(layer).toHaveAttribute('aria-hidden', 'true');
    expect(layer.textContent).toBe(sampleText);
    expect(layer.querySelector('.json-token--key')?.textContent?.trim()).toBe(
      '"version":',
    );
    expect(layer.querySelector('.json-token--string')?.textContent).toBe(
      '"shop@12"',
    );
    expect(layer.querySelector('.json-token--literal')).not.toBeNull();
  });

  /**
   * The splitter is the one thing on the screen a reader moves rather than
   * fills in, so the keyboard half is asserted rather than left to a drag
   * nothing in jsdom can perform.
   */
  it('moves the pane split from the keyboard, within its bounds', async () => {
    const { container } = render(<ExplorerScreen />);
    const split = screen.getByRole('separator');
    const width = () =>
      (
        container.querySelector('.explorer__panes') as HTMLElement
      ).style.getPropertyValue('--explorer-split');

    expect(width()).toBe('42%');
    expect(split).toHaveAttribute('aria-valuenow', '42');

    fireEvent.keyDown(split, { key: 'ArrowRight' });
    expect(width()).toBe('44%');

    fireEvent.keyDown(split, { key: 'Home' });
    expect(width()).toBe('25%');

    fireEvent.keyDown(split, { key: 'End' });
    expect(width()).toBe('75%');

    for (let press = 0; press < 20; press += 1) {
      fireEvent.keyDown(split, { key: 'ArrowRight' });
    }
    expect(width()).toBe('80%');
  });

  /**
   * The object row, and the three states the coordinator asked to be
   * reachable: no row, a row short of a path, and a path holding a value that
   * fails. Each is asserted against what the engine answered, not against a
   * screen the test wrote down.
   */
  describe('an object row', () => {
    /** The box for one kind, which only exists once a document is adopted. */
    function rowBox(kind: string): HTMLTextAreaElement {
      return screen.getByLabelText(`The ${kind} row, as JSON`);
    }

    function enter(kind: string, value: string): void {
      fireEvent.change(rowBox(kind), { target: { value } });
    }

    it('is asked for only where a permission reads the object', async () => {
      expect(objectKinds(adopted())).toEqual(['listing']);
    });

    it('is absent until a document names a kind that reads the object', async () => {
      render(<ExplorerScreen />);

      expect(
        screen.queryByLabelText('The listing row, as JSON'),
      ).not.toBeInTheDocument();

      await loadSample();
      expect(rowBox('listing')).toHaveValue('');
    });

    it('opens on unevaluable, with the row empty', async () => {
      const { container } = render(<ExplorerScreen />);

      await loadSample();

      expect(row(container, 'listing.update')['reason']).toBe('unevaluable');
      expect(row(container, 'listing.update')['asked']).toBe('capabilities');
    });

    it('decides through can once the row is entered', async () => {
      const { container } = render(<ExplorerScreen />);

      await loadSample();
      enter('listing', '{"sellerId":"u_31","status":"live"}');

      expect(row(container, 'listing.update')['reason']).toBe('allow');
      expect(row(container, 'listing.update')['allowed']).toBe('true');
      expect(row(container, 'listing.update')['asked']).toBe('can');
    });

    it('stays unevaluable for a row short of a path the rules read', async () => {
      const { container } = render(<ExplorerScreen />);

      await loadSample();
      enter('listing', '{"sellerId":"u_31"}');

      expect(row(container, 'listing.update')['reason']).toBe('unevaluable');
      expect(row(container, 'listing.update')['missing']).toBe('object.status');
      expect(row(container, 'listing.update')['asked']).toBe('can');
    });

    it('separates an empty value from an absent one', async () => {
      const { container } = render(<ExplorerScreen />);

      await loadSample();
      enter('listing', '{"sellerId":"","status":"live"}');

      expect(row(container, 'listing.update')['reason']).toBe(
        'no-rule-matched',
      );
      expect(row(container, 'listing.update')['missing']).toBe('none');
    });

    it('reaches denied through the deny rule the row matches', async () => {
      const { container } = render(<ExplorerScreen />);

      await loadSample();
      enter('listing', '{"sellerId":"u_31","status":"archived"}');

      expect(row(container, 'listing.update')['reason']).toBe('denied');
      expect(row(container, 'listing.update')['rule']).toBe('archived');
    });

    it('leaves a permission that reads no object on the cheap path', async () => {
      const { container } = render(<ExplorerScreen />);

      await loadSample();
      enter('listing', '{"sellerId":"u_31","status":"live"}');

      expect(row(container, 'listing.read')['asked']).toBe('capabilities');
      expect(row(container, 'order.refund')['asked']).toBe('capabilities');
    });

    /**
     * The control that fills a box. It never runs on its own, so the screen
     * still opens on `unevaluable`, and what it drops in is text the reader
     * can edit into any of the three states.
     */
    it('fills the box with a row the subject owns, on one press', async () => {
      const { container } = render(<ExplorerScreen />);

      await loadSample();
      expect(rowBox('listing')).toHaveValue('');
      expect(row(container, 'listing.update')['reason']).toBe('unevaluable');

      fireEvent.click(screen.getByRole('button', { name: 'Fill in a row' }));

      expect(JSON.parse(rowBox('listing').value)).toEqual({
        id: 'l_7',
        sellerId: 'u_31',
        status: 'live',
        title: 'Wingspan',
        price: 59,
      });
      expect(row(container, 'listing.update')['reason']).toBe('allow');
    });

    it('leaves what it filled in editable', async () => {
      const { container } = render(<ExplorerScreen />);

      await loadSample();
      fireEvent.click(screen.getByRole('button', { name: 'Fill in a row' }));

      const filled = JSON.parse(rowBox('listing').value);
      enter('listing', JSON.stringify({ ...filled, status: 'archived' }));
      expect(row(container, 'listing.update')['reason']).toBe('denied');

      enter('listing', JSON.stringify({ ...filled, sellerId: 'u_99' }));
      expect(row(container, 'listing.update')['reason']).toBe(
        'no-rule-matched',
      );
    });

    it('builds a row from the schema where no sample row fits', () => {
      const document = {
        schema: {
          objects: {
            order: {
              fields: {
                id: 'string',
                total: 'number',
                paid: 'boolean',
                tags: 'string[]',
                placedAt: 'instant?',
              },
            },
          },
        },
        permissions: [
          {
            key: 'order.read',
            object: 'order',
            action: 'read',
            rules: [
              { when: [{ field: 'object.paid', op: 'eq', value: true }] },
            ],
          },
        ],
      };

      const adoption = adopt(JSON.stringify(document));
      if (adoption.state !== 'ready') throw new Error(adoption.state);

      expect(rowFor(adoption.access, 'order')).toEqual({
        source: 'schema',
        row: { id: '', total: 0, paid: false, tags: [], placedAt: '' },
      });
    });

    it('offers nothing for a kind the schema describes no fields for', async () => {
      render(<ExplorerScreen />);

      await paste(
        JSON.stringify({
          permissions: [
            {
              key: 'order.read',
              object: 'order',
              action: 'read',
              rules: [
                { when: [{ field: 'object.paid', op: 'eq', value: true }] },
              ],
            },
          ],
        }),
      );

      expect(
        screen.getByRole('button', { name: 'Fill in a row' }),
      ).toBeDisabled();
      expect(
        screen.getByText(/declares no fields for order/),
      ).toBeInTheDocument();
    });

    it('reports a malformed row and decides as though it had none', async () => {
      const { container } = render(<ExplorerScreen />);

      await loadSample();
      enter('listing', '{"sellerId":');

      expect(screen.getByText(/not json yet/i)).toBeInTheDocument();
      expect(row(container, 'listing.update')['reason']).toBe('unevaluable');
      expect(row(container, 'listing.update')['asked']).toBe('capabilities');
    });
  });

  it('leaves the split alone for a key it does not bind', async () => {
    const { container } = render(<ExplorerScreen />);

    fireEvent.keyDown(screen.getByRole('separator'), { key: 'a' });

    expect(
      (
        container.querySelector('.explorer__panes') as HTMLElement
      ).style.getPropertyValue('--explorer-split'),
    ).toBe('42%');
  });
});
