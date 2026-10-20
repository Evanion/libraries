import { describe, expect, it } from 'vitest';
import { changes, review } from './diff';

describe('the diff scene', () => {
  it('reports who gained access when a rule is added', () => {
    const report = review('sellers-reprice');
    expect(report.unchanged).toBe(false);
    expect(report.lines).toContainEqual(
      expect.objectContaining({
        kind: 'granted',
        text: expect.stringMatching(/booksellers.*reprice/i),
      }),
    );
  });

  it('leads each finding with who, in plain words, and keeps the raw key and cause apart', () => {
    const [granted] = review('sellers-reprice').lines;
    expect(granted?.who).toBe('Booksellers');
    expect(granted?.text.startsWith('Booksellers can now reprice')).toBe(true);
    expect(granted?.key).toBe('listing.reprice');
    expect(granted?.cause).toBe('allow-branch-added');
    const [lost] = review('lock-published').lines;
    expect(lost?.who).toBe('Nobody');
    const dropped = review('drop-publish').lines[0];
    expect(dropped?.who).toBe('Owners');
  });

  it('reports who lost access when a deny rule is added', () => {
    const report = review('lock-published');
    expect(report.lines.map((l) => l.kind)).toContain('withdrawn');
    expect(report.lines.map((l) => l.kind)).toContain('reads-object');
  });

  it('reports a removed permission as lost for everyone who held it', () => {
    const report = review('drop-publish');
    expect(report.lines).toContainEqual(
      expect.objectContaining({
        kind: 'withdrawn',
        text: expect.stringMatching(/publish/i),
      }),
    );
  });

  it('reports nothing when the rules only change order', () => {
    const report = review('reorder');
    expect(report.unchanged).toBe(true);
    expect(report.lines).toEqual([]);
  });

  it('offers each change once, with a label', () => {
    const ids = changes.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const change of changes) expect(change.label).toBeTruthy();
  });

  it('every change is reviewed from the real library output', () => {
    for (const change of changes) {
      const report = review(change.id);
      expect(report.versions.before).not.toBe(report.versions.after);
    }
  });
});
