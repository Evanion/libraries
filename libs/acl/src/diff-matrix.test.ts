import { describe, expect, it } from 'vitest';

import { diffMatrix } from './diff-matrix.js';
import { parseMatrix } from './parse-matrix.js';
import { ruleId } from './rule-id.js';
import type { DiffFinding } from './diff-matrix.js';
import type { Condition, Matrix, Permission, Rule } from './types.js';

type Subject = { id?: string; role?: string; roles?: string[] };

function matrix(permissions: readonly Permission[], version = 'v1'): Matrix {
  return { version, permissions };
}

function permission(
  key: string,
  rules: readonly Rule[],
  denyRules?: readonly Rule[],
): Permission {
  const [object, action] = key.split('.') as [string, string];
  return { key, object, action, rules, denyRules };
}

const isAdmin: Condition = { field: 'subject.role', op: 'eq', value: 'admin' };
const isOperator: Condition = {
  field: 'subject.roles',
  op: 'contains',
  value: 'operator',
};
const ownTenant: Condition = {
  field: 'subject.tenantId',
  op: 'eq',
  path: 'object.tenantId',
};
const locked: Condition = { field: 'object.locked', op: 'eq', value: true };

const of = <K extends DiffFinding['kind']>(
  findings: readonly DiffFinding[],
  kind: K,
): Extract<DiffFinding, { kind: K }>[] =>
  findings.filter(
    (each): each is Extract<DiffFinding, { kind: K }> => each.kind === kind,
  );

describe('diffMatrix', () => {
  it('reports nothing for two documents stating one policy', () => {
    const before = matrix([permission('doc.read', [{ when: [isAdmin] }])]);
    const after = matrix([permission('doc.read', [{ when: [isAdmin] }])]);

    expect(diffMatrix(before, after).unchanged).toBe(true);
  });

  it('reports nothing when the rules are reordered', () => {
    const a: Rule = { when: [isAdmin] };
    const b: Rule = { when: [isOperator] };
    const before = matrix([permission('doc.read', [a, b])]);
    const after = matrix([permission('doc.read', [b, a])]);

    expect(diffMatrix(before, after).unchanged).toBe(true);
  });

  it('reports nothing when a condition arrives with its keys in another order', () => {
    const before = matrix([
      permission('doc.read', [
        { when: [{ field: 'subject.role', op: 'eq', value: 'admin' }] },
      ]),
    ]);
    const after = matrix([
      permission('doc.read', [
        { when: [{ op: 'eq', value: 'admin', field: 'subject.role' }] },
      ]),
    ]);

    expect(diffMatrix(before, after).unchanged).toBe(true);
  });

  describe('a widening', () => {
    it('reports an added allow branch as granted, naming the branch', () => {
      const before = matrix([
        permission('listing.reprice', [{ when: [isAdmin] }]),
      ]);
      const added: Rule = { when: [isOperator, ownTenant] };
      const after = matrix([
        permission('listing.reprice', [{ when: [isAdmin] }, added]),
      ]);

      const [finding] = of(diffMatrix(before, after).findings, 'granted');

      expect(finding?.cause).toBe('allow-branch-added');
      expect(finding?.key).toBe('listing.reprice');
      expect(finding?.rule).toBe(ruleId(added, 'allow'));
      expect(finding?.when).toEqual([isOperator, ownTenant]);
    });

    it('splits the branch into who, which rows and when', () => {
      const window: Condition = {
        field: 'now',
        op: 'after',
        value: '2026-01-01',
      };
      const before = matrix([permission('listing.reprice', [])]);
      const after = matrix([
        permission('listing.reprice', [
          { when: [isOperator, ownTenant, window] },
        ]),
      ]);

      const [finding] = of(diffMatrix(before, after).findings, 'granted');

      expect(finding?.groups.subject).toEqual([isOperator]);
      expect(finding?.groups.object).toEqual([ownTenant]);
      expect(finding?.groups.window).toEqual([window]);
    });

    it('reports a removed deny branch as granted', () => {
      const denied: Rule = { when: [locked] };
      const before = matrix([
        permission('doc.read', [{ when: [isAdmin] }], [denied]),
      ]);
      const after = matrix([permission('doc.read', [{ when: [isAdmin] }], [])]);

      const [finding] = of(diffMatrix(before, after).findings, 'granted');

      expect(finding?.cause).toBe('deny-branch-removed');
      expect(finding?.rule).toBe(ruleId(denied, 'deny'));
    });

    it('reports an added permission as granted once per allow branch', () => {
      const before = matrix([]);
      const after = matrix([
        permission('doc.read', [{ when: [isAdmin] }, { when: [isOperator] }]),
      ]);

      const findings = of(diffMatrix(before, after).findings, 'granted');

      expect(findings).toHaveLength(2);
      expect(findings.every((each) => each.cause === 'permission-added')).toBe(
        true,
      );
    });
  });

  describe('a narrowing', () => {
    it('reports an added deny branch as withdrawn', () => {
      const denied: Rule = { when: [locked] };
      const before = matrix([permission('doc.read', [{ when: [isAdmin] }])]);
      const after = matrix([
        permission('doc.read', [{ when: [isAdmin] }], [denied]),
      ]);

      const [finding] = of(diffMatrix(before, after).findings, 'withdrawn');

      expect(finding?.cause).toBe('deny-branch-added');
      expect(finding?.when).toEqual([locked]);
    });

    it('reports a removed allow branch as withdrawn', () => {
      const gone: Rule = { when: [isOperator] };
      const before = matrix([
        permission('doc.read', [{ when: [isAdmin] }, gone]),
      ]);
      const after = matrix([permission('doc.read', [{ when: [isAdmin] }])]);

      const [finding] = of(diffMatrix(before, after).findings, 'withdrawn');

      expect(finding?.cause).toBe('allow-branch-removed');
      expect(finding?.when).toEqual([isOperator]);
    });

    it('gives a removed permission both holders a sentence', () => {
      const before = matrix([
        permission('doc.read', [{ when: [isAdmin] }]),
        permission('doc.write', [{ when: [isAdmin] }]),
      ]);
      const after = matrix([permission('doc.write', [{ when: [isAdmin] }])]);

      const [finding] = of(diffMatrix(before, after).findings, 'withdrawn');

      expect(finding?.cause).toBe('permission-removed');
      expect(finding?.holders?.closed).toContain('unknown-action');
      expect(finding?.holders?.open).toContain('UnknownPermissionError');
    });

    it('names the object kind when the last permission of a kind goes', () => {
      const before = matrix([permission('doc.read', [{ when: [isAdmin] }])]);
      const after = matrix([]);

      const [finding] = of(diffMatrix(before, after).findings, 'withdrawn');

      expect(finding?.holders?.open).toContain('UnknownObjectKeyError');
      expect(finding?.holders?.open).toContain('doc');
    });
  });

  describe('what it refuses to classify', () => {
    it('reports a rule that kept its id and changed its conditions as undetermined', () => {
      const before = matrix([
        permission('doc.read', [{ id: 'r', when: [isAdmin] }]),
      ]);
      const after = matrix([
        permission('doc.read', [{ id: 'r', when: [isOperator] }]),
      ]);

      const findings = diffMatrix(before, after).findings;
      const [finding] = of(findings, 'undetermined');

      expect(finding?.cause).toBe('rule-edited');
      expect(finding?.rule).toBe('r');
      expect(finding?.before).toEqual([isAdmin]);
      expect(finding?.after).toEqual([isOperator]);
      expect(of(findings, 'granted')).toHaveLength(0);
      expect(of(findings, 'withdrawn')).toHaveLength(0);
    });

    it('refuses a direction when both sides of one permission moved', () => {
      const before = matrix([permission('doc.read', [{ when: [isAdmin] }])]);
      const after = matrix([
        permission(
          'doc.read',
          [{ when: [isAdmin] }, { when: [isOperator] }],
          [{ when: [locked] }],
        ),
      ]);

      const findings = diffMatrix(before, after).findings;

      expect(of(findings, 'undetermined')[0]?.cause).toBe('both-sides-changed');
      expect(of(findings, 'granted')).toHaveLength(0);
      expect(of(findings, 'withdrawn')).toHaveLength(0);
    });

    it('decides two literal name lists by set comparison', () => {
      const base = permission('doc.update', [{ when: [isAdmin] }]);
      const before = matrix([{ ...base, fields: { fields: ['title'] } }]);
      const after = matrix([
        { ...base, fields: { fields: ['title', 'body'] } },
      ]);

      const [finding] = of(diffMatrix(before, after).findings, 'granted');

      expect(finding?.cause).toBe('field-list-widened');
      expect(finding?.fields).toEqual(['body']);
    });

    it('refuses a comparison once a list carries a baseline or a subtraction', () => {
      const base = permission('doc.update', [{ when: [isAdmin] }]);
      const before = matrix([{ ...base, fields: { fields: ['*', '!price'] } }]);
      const after = matrix([{ ...base, fields: { fields: ['title'] } }]);

      const [finding] = of(diffMatrix(before, after).findings, 'undetermined');

      expect(finding?.cause).toBe('fields-changed');
    });
  });

  describe('the paths a decision reads', () => {
    it('reports a permission that started reading the object', () => {
      const before = matrix([permission('doc.read', [{ when: [isAdmin] }])]);
      const after = matrix([
        permission('doc.read', [{ when: [isAdmin] }], [{ when: [locked] }]),
      ]);

      const [finding] = of(diffMatrix(before, after).findings, 'reads-object');

      expect(finding?.before).toBe(false);
      expect(finding?.after).toBe(true);
      expect(finding?.paths.after).toEqual(['object.locked']);
    });

    it('is the finding an admin who supplied no object needs', () => {
      // The measured case: no access widened and every caller deciding without
      // the row broke. The diff has to say so, because neither the granted nor
      // the withdrawn list mentions this edit.
      const before = matrix([permission('doc.read', [{ when: [isAdmin] }])]);
      const after = matrix([
        permission('doc.read', [{ when: [isAdmin] }], [{ when: [locked] }]),
      ]);
      const subject: Subject = { role: 'admin' };

      const was = parseMatrix<Subject, { doc: { locked?: boolean } }>(
        before,
      ).can(subject, 'doc', 'read');
      const now = parseMatrix<Subject, { doc: { locked?: boolean } }>(
        after,
      ).can(subject, 'doc', 'read');

      expect(was.allowed).toBe(true);
      expect(now.allowed).toBe(false);
      expect(now.reason).toBe('unevaluable');
      expect(now.missing).toEqual(['object.locked']);
      expect(
        of(diffMatrix(before, after).findings, 'reads-object'),
      ).toHaveLength(1);
    });

    it('reports a changed path even when the permission read the object before', () => {
      const before = matrix([permission('doc.read', [{ when: [locked] }])]);
      const after = matrix([
        permission('doc.read', [
          { when: [{ field: 'object.archived', op: 'eq', value: true }] },
        ]),
      ]);

      const [finding] = of(diffMatrix(before, after).findings, 'reads-object');

      expect(finding?.paths.before).toEqual(['object.locked']);
      expect(finding?.paths.after).toEqual(['object.archived']);
    });
  });

  describe('the monotonicity the report rests on', () => {
    it('holds: an appended allow rule never removes an allow', () => {
      const subject: Subject = { role: 'admin' };
      const before = matrix([permission('doc.read', [{ when: [isAdmin] }])]);
      const after = matrix([
        permission('doc.read', [{ when: [isAdmin] }, { when: [isOperator] }]),
      ]);

      expect(
        parseMatrix<Subject, { doc: object }>(before).can(
          subject,
          'doc',
          'read',
        ).allowed,
      ).toBe(true);
      expect(
        parseMatrix<Subject, { doc: object }>(after).can(subject, 'doc', 'read')
          .allowed,
      ).toBe(true);
    });

    it('holds: an appended deny rule never adds an allow', () => {
      const subject: Subject = { role: 'nobody' };
      const before = matrix([permission('doc.read', [{ when: [isAdmin] }])]);
      const after = matrix([
        permission('doc.read', [{ when: [isAdmin] }], [{ when: [isAdmin] }]),
      ]);

      expect(
        parseMatrix<Subject, { doc: object }>(before).can(
          subject,
          'doc',
          'read',
        ).allowed,
      ).toBe(false);
      expect(
        parseMatrix<Subject, { doc: object }>(after).can(subject, 'doc', 'read')
          .allowed,
      ).toBe(false);
    });

    it('reports the granted branch a new subject is actually granted by', () => {
      const subject: Subject = { roles: ['operator'] };
      const before = matrix([permission('doc.read', [{ when: [isAdmin] }])]);
      const added: Rule = { when: [isOperator] };
      const after = matrix([
        permission('doc.read', [{ when: [isAdmin] }, added]),
      ]);

      const was = parseMatrix<Subject, { doc: object }>(before).can(
        subject,
        'doc',
        'read',
      );
      const now = parseMatrix<Subject, { doc: object }>(after).can(
        subject,
        'doc',
        'read',
      );

      expect(was.allowed).toBe(false);
      expect(now.allowed).toBe(true);
      expect(now.rule).toBe(
        of(diffMatrix(before, after).findings, 'granted')[0]?.rule,
      );
    });
  });

  it('carries both versions, so a report names what it compared', () => {
    const before = matrix([], 'a');
    const after = matrix([], 'b');

    expect(diffMatrix(before, after).version).toEqual({
      before: 'a',
      after: 'b',
    });
  });
});
