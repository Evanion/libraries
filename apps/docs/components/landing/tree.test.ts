import { describe, expect, it } from 'vitest';
import { listing } from './listing';
import { moved, nameOf, openingNodes, rows, within, type Node } from './tree';

/** The listing as one string, the way a reader would select and copy it. */
function text(nodes: Node[]): string {
  return rows(nodes)
    .map((row) => row.text)
    .join('\n');
}

describe('the items listing', () => {
  it('is JSON that parses back to the items the page rendered', () => {
    expect(JSON.parse(text(openingNodes))).toEqual(openingNodes);
  });

  it('stays JSON after an item has moved', () => {
    const next = moved(openingNodes, [1, 0], 1);
    expect(JSON.parse(text(next))).toEqual(next);
  });

  it('offers controls on every item and on no other line', () => {
    const withItem = rows(openingNodes).filter((row) => row.item);
    expect(withItem.map((row) => row.item!.name)).toEqual([
      'week',
      'Bikes in',
      'Collected',
      'Turnaround',
      'desk',
      'On the stands',
      'Parts on order',
    ]);
  });

  it('marks the ends of each sibling list, not of the listing', () => {
    const ends = rows(openingNodes)
      .filter((row) => row.item)
      .map((row) => [row.item!.first, row.item!.last]);

    expect(ends).toEqual([
      [true, false],
      [true, false],
      [false, false],
      [false, true],
      [false, true],
      [true, false],
      [false, true],
    ]);
  });
});

describe('moving an item', () => {
  it('carries a container and everything nested under it', () => {
    const next = moved(openingNodes, [1], -1);
    expect(next.map((node) => node.id)).toEqual(['desk', 'week']);
    expect(next[0]!.children!.map((node) => node.id)).toEqual([
      'stands',
      'parts',
    ]);
  });

  it('swaps siblings inside a container and leaves the rest alone', () => {
    const next = moved(openingNodes, [0, 2], -1);
    expect(next[0]!.children!.map((node) => node.id)).toEqual([
      'intake',
      'turnaround',
      'collected',
    ]);
    expect(next[1]).toBe(openingNodes[1]);
  });

  it('carries the item its own width', () => {
    const next = moved(openingNodes, [1, 0], 1);
    expect(
      next[1]!.children!.map((node) => [node.id, node.meta?.span]),
    ).toEqual([
      ['parts', undefined],
      ['stands', 2],
    ]);
  });

  it('refuses a move off either end', () => {
    expect(moved(openingNodes, [0], -1)).toBe(openingNodes);
    expect(moved(openingNodes, [1], 1)).toBe(openingNodes);
  });
});

describe('lighting the block a control will move', () => {
  it('covers the container, its nested items and its closing line', () => {
    const lit = rows(openingNodes)
      .filter((row) => within([1], row.path))
      .map((row) => row.key);

    expect(lit).toEqual(['desk', 'stands', 'parts', 'desk/end']);
  });

  it('covers one item alone when the item holds nothing', () => {
    const lit = rows(openingNodes)
      .filter((row) => within([0, 1], row.path))
      .map((row) => row.key);

    expect(lit).toEqual(['collected']);
  });

  it('leaves the lines bracketing the whole list out of every block', () => {
    const brackets = rows(openingNodes).filter((row) => row.path === undefined);
    expect(brackets.map((row) => row.key)).toEqual(['/open', '/close']);
    expect(brackets.some((row) => within([0], row.path))).toBe(false);
  });
});

describe('naming an item', () => {
  it('prefers the title it carries, then its label, then its id', () => {
    expect(nameOf({ id: 'a', type: 'jobs', props: { title: 'Stands' } })).toBe(
      'Stands',
    );
    expect(nameOf({ id: 'b', type: 'metric', props: { label: 'Bikes' } })).toBe(
      'Bikes',
    );
    expect(nameOf({ id: 'c', type: 'columns', props: {} })).toBe('c');
  });
});

describe('the one-line formatter', () => {
  it('keeps a short object on one line and breaks a long one', () => {
    const out = listing([
      { id: 'a', meta: { rule: true } },
      { id: 'd', props: { line: 'x'.repeat(80) } },
    ]);

    expect(out).toContain('  { "id": "a", "meta": { "rule": true } },');
    expect(out).toContain('  {\n    "id": "d",\n    "props": {\n');
  });
});
