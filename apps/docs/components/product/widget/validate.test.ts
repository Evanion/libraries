import { describe, expect, it } from 'vitest';
import { FAULTS, listing, page, problemsFor, summary } from './validate';

describe('the validate scene', () => {
  it('reports no problems for the page as the CMS saved it', () => {
    expect(problemsFor([])).toEqual([]);
  });

  it('names the shelf when its type is renamed', () => {
    expect(problemsFor(['rename'])).toEqual([
      {
        index: 1,
        id: 'tonight',
        type: 'featured-shelf',
        message: 'unknown widget type',
      },
    ]);
  });

  it('names the listing whose required title is blanked', () => {
    expect(problemsFor(['blank'])).toEqual([
      {
        index: 0,
        id: 'wingspan',
        type: 'listing',
        message: 'missing field title',
      },
    ]);
  });

  it('names the second item that reuses an id', () => {
    expect(problemsFor(['duplicate'])).toEqual([
      {
        index: 1,
        id: 'brass',
        type: 'shelf',
        message: 'duplicate sibling id',
      },
    ]);
  });

  it('reports every fault at once', () => {
    expect(problemsFor(['rename', 'blank', 'duplicate'])).toHaveLength(3);
  });

  it('does not change the page for a fault that is not chosen', () => {
    const clean = JSON.stringify(page([]));
    expect(clean).toContain('"type":"shelf"');
    expect(page(['rename'])[1]?.type).toBe('featured-shelf');
    expect(JSON.stringify(page([]))).toBe(clean);
  });

  it('lists every fault with a label', () => {
    expect(FAULTS.map((f) => f.id)).toEqual(['rename', 'blank', 'duplicate']);
    for (const f of FAULTS) expect(f.label).toBeTruthy();
  });

  it('shows each item as a line of the payload, lighting the edited ones', () => {
    expect(listing([]).some((l) => l.lit)).toBe(false);
    const lit = listing(['rename']).filter((l) => l.lit);
    expect(lit).toHaveLength(1);
    expect(lit[0]?.text).toContain("'featured-shelf'");
  });

  it('says whether the build can go ahead', () => {
    expect(summary([])).toBe('No problems. The build can go ahead.');
    expect(summary([{ index: 0, id: 'a', type: 'b', message: 'm' }])).toBe(
      '1 problem. The build stops.',
    );
    expect(
      summary([
        { index: 0, id: 'a', type: 'b', message: 'm' },
        { index: 1, id: 'a', type: 'b', message: 'm' },
      ]),
    ).toBe('2 problems. The build stops.');
  });
});
