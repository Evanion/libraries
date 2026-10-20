import { describe, expect, it } from 'vitest';
import { FAULTS, listing, page, problemsFor, summary } from './validate';

describe('the validate scene', () => {
  it('reports no problems for the page as the CMS saved it', () => {
    expect(problemsFor([])).toEqual([]);
  });

  it('names the shelf when its type is renamed, and only that', () => {
    expect(problemsFor(['rename'])).toEqual([
      {
        index: 1,
        id: 'tonight',
        type: 'featured-shelf',
        message: 'unknown widget type',
      },
    ]);
  });

  it('names the listing whose required title is blanked, and only that', () => {
    expect(problemsFor(['blank'])).toEqual([
      {
        index: 0,
        id: 'wingspan',
        type: 'listing',
        message: 'missing field title',
      },
    ]);
  });

  it('names the block that reuses an id, and only that', () => {
    expect(problemsFor(['duplicate'])).toEqual([
      {
        index: 2,
        id: 'brass',
        type: 'listing',
        message: 'duplicate sibling id',
      },
    ]);
  });

  it('keeps the three faults independent: each adds exactly one problem', () => {
    expect(problemsFor(['rename', 'blank', 'duplicate'])).toHaveLength(3);
    expect(problemsFor(['rename', 'duplicate'])).toHaveLength(2);
  });

  it('leaves the shelf alone when only an id is reused', () => {
    const items = page(['duplicate']);
    expect(items[1]).toMatchObject({ id: 'tonight', type: 'shelf' });
    expect(items[2]?.id).toBe('brass');
  });

  it('lists every fault with a label', () => {
    expect(FAULTS.map((f) => f.id)).toEqual(['rename', 'blank', 'duplicate']);
    for (const f of FAULTS) expect(f.label).toBeTruthy();
  });

  it('shows each block as a line of the payload, lighting the edited ones', () => {
    expect(listing([]).some((l) => l.lit)).toBe(false);
    const lit = listing(['duplicate']).filter((l) => l.lit);
    expect(lit).toHaveLength(1);
    expect(lit[0]?.text).toContain("id: 'brass'");
    expect(listing(['rename']).filter((l) => l.lit)[0]?.text).toContain(
      "'featured-shelf'",
    );
  });

  it('says whether the check passes', () => {
    expect(summary([])).toBe('No problems.');
    expect(summary([{ index: 0, id: 'a', type: 'b', message: 'm' }])).toBe(
      '1 problem.',
    );
    expect(
      summary([
        { index: 0, id: 'a', type: 'b', message: 'm' },
        { index: 1, id: 'a', type: 'b', message: 'm' },
      ]),
    ).toBe('2 problems.');
  });
});
