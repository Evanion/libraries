import { describe, expect, it } from 'vitest';

import { hydratePolicy } from './hydrate-policy.js';
import {
  FieldTypeMismatchError,
  InvalidSchemaError,
  UnknownFieldError,
} from './errors.js';
import { parseMatrix } from './parse-matrix.js';
import type { Condition, Matrix, MatrixSchema } from './types.js';

const schema: MatrixSchema = {
  subject: { fields: { id: 'string', roles: 'string[]' } },
  objects: {
    comment: {
      fields: {
        authorId: 'string',
        status: 'string',
        tags: 'string[]',
        score: 'number',
        pinned: 'boolean',
        publishedAt: 'instant',
        note: 'string?',
      },
      relations: { post: 'post' },
    },
  },
};

/** One condition on `comment.update`, with and without the schema. */
function withCondition(condition: Condition, declared?: MatrixSchema): Matrix {
  return {
    ...(declared === undefined ? {} : { schema: declared }),
    permissions: [
      {
        key: 'comment.update',
        object: 'comment',
        action: 'update',
        rules: [{ id: 'r', when: [condition] }],
      },
    ],
  };
}

/** The same condition, accepted without a schema and refused with one. */
function refused(condition: Condition, error: unknown): void {
  expect(() => parseMatrix(withCondition(condition))).not.toThrow();
  expect(() => parseMatrix(withCondition(condition, schema))).toThrow(
    error as never,
  );
}

describe('schema shape', () => {
  const cases: [unknown, string][] = [
    [42, 'schema'],
    ['schema', 'schema'],
    [[], 'schema'],
    [{ subject: 7 }, 'schema.subject'],
    [{ subject: { fields: 'id' } }, 'schema.subject.fields'],
    [{ objects: 7 }, 'schema.objects'],
    [{ objects: { comment: null } }, 'schema.objects.comment'],
    [
      { objects: { comment: { fields: { status: 'enum' } } } },
      'schema.objects.comment.fields.status',
    ],
    [
      { objects: { comment: { fields: { status: 'string[]]' } } } },
      'schema.objects.comment.fields.status',
    ],
    [
      { objects: { comment: { relations: { post: 7 } } } },
      'schema.objects.comment.relations.post',
    ],
    [
      {
        objects: {
          comment: { fields: { post: 'string' }, relations: { post: 'post' } },
        },
      },
      'schema.objects.comment.relations.post',
    ],
  ];

  for (const [declared, where] of cases) {
    it(`refuses ${JSON.stringify(declared)}`, () => {
      const matrix = {
        schema: declared,
        permissions: [],
      } as unknown as Matrix;
      expect(() => parseMatrix(matrix)).toThrow(InvalidSchemaError);
      expect(() => parseMatrix(matrix)).toThrow(where);
    });
  }

  it('accepts every field type form', () => {
    const forms = [
      'string',
      'number',
      'boolean',
      'instant',
      'string[]',
      'number?',
      'instant[]?',
    ];
    const fields = Object.fromEntries(forms.map((form, i) => [`f${i}`, form]));
    expect(() =>
      parseMatrix({
        schema: { objects: { comment: { fields } } },
        permissions: [],
      } as unknown as Matrix),
    ).not.toThrow();
  });
});

describe('a condition against a declared field name', () => {
  it('refuses a field the kind does not declare', () => {
    refused(
      { field: 'object.authorID', op: 'eq', path: 'subject.id' },
      UnknownFieldError,
    );
  });

  it('refuses a subject field the schema does not declare', () => {
    refused(
      { field: 'subject.rolez', op: 'contains', value: 'editor' },
      UnknownFieldError,
    );
  });

  it('refuses a path comparand the schema does not declare', () => {
    refused(
      { field: 'object.authorId', op: 'eq', path: 'subject.uid' },
      UnknownFieldError,
    );
  });

  it('refuses a relation, which is not a value a condition compares', () => {
    refused({ field: 'object.post', op: 'eq', value: 'p1' }, UnknownFieldError);
  });

  it('checks deny rules as well as allow rules', () => {
    const matrix: Matrix = {
      schema,
      permissions: [
        {
          key: 'comment.update',
          object: 'comment',
          action: 'update',
          rules: [{ id: 'r', when: [] }],
          denyRules: [
            {
              id: 'd',
              when: [{ field: 'object.statuz', op: 'eq', value: 'locked' }],
            },
          ],
        },
      ],
    };
    expect(() => parseMatrix(matrix)).toThrow(UnknownFieldError);
  });

  it('leaves an undeclared kind unchecked', () => {
    const matrix: Matrix = {
      schema,
      permissions: [
        {
          key: 'media.read',
          object: 'media',
          action: 'read',
          rules: [
            {
              id: 'r',
              when: [{ field: 'object.whatever', op: 'eq', value: 1 }],
            },
          ],
        },
      ],
    };
    expect(() => parseMatrix(matrix)).not.toThrow();
  });

  it('leaves subject paths unchecked when the schema declares no subject', () => {
    const noSubject: MatrixSchema = { objects: schema.objects };
    expect(() =>
      parseMatrix(
        withCondition(
          { field: 'subject.rolez', op: 'contains', value: 'editor' },
          noSubject,
        ),
      ),
    ).not.toThrow();
  });
});

describe('a condition against a declared field type', () => {
  it('refuses contains against a field that is not an array', () => {
    refused(
      { field: 'object.status', op: 'contains', value: 'draft' },
      FieldTypeMismatchError,
    );
  });

  it('accepts contains against an array field', () => {
    expect(() =>
      parseMatrix(
        withCondition(
          { field: 'object.tags', op: 'contains', value: 'news' },
          schema,
        ),
      ),
    ).not.toThrow();
  });

  it('refuses contains against the wrong element type', () => {
    refused(
      { field: 'object.tags', op: 'contains', value: 7 },
      FieldTypeMismatchError,
    );
  });

  it('refuses an equality against an array field', () => {
    refused(
      { field: 'object.tags', op: 'eq', value: 'news' },
      FieldTypeMismatchError,
    );
  });

  it('refuses a literal of the wrong type', () => {
    refused(
      { field: 'object.score', op: 'eq', value: 'high' },
      FieldTypeMismatchError,
    );
    refused(
      { field: 'object.pinned', op: 'ne', value: 'yes' },
      FieldTypeMismatchError,
    );
  });

  it('refuses an in list holding the wrong type', () => {
    refused(
      { field: 'object.status', op: 'in', value: ['draft', 7] },
      FieldTypeMismatchError,
    );
  });

  it('refuses a path comparand whose two sides disagree', () => {
    refused(
      { field: 'object.score', op: 'eq', path: 'subject.id' },
      FieldTypeMismatchError,
    );
  });

  it('accepts a path comparand whose two sides agree', () => {
    expect(() =>
      parseMatrix(
        withCondition(
          { field: 'object.authorId', op: 'eq', path: 'subject.id' },
          schema,
        ),
      ),
    ).not.toThrow();
  });

  it('accepts an instant compared against the clock, which reads as a number', () => {
    expect(() =>
      parseMatrix(
        withCondition(
          { field: 'object.publishedAt', op: 'eq', path: 'now' },
          schema,
        ),
      ),
    ).not.toThrow();
  });

  it('accepts null against any declared type: present and null is present', () => {
    expect(() =>
      parseMatrix(
        withCondition(
          { field: 'object.status', op: 'ne', value: null },
          schema,
        ),
      ),
    ).not.toThrow();
  });

  it('accepts a field declared optional: optionality is not checked here', () => {
    expect(() =>
      parseMatrix(
        withCondition({ field: 'object.note', op: 'eq', value: 'x' }, schema),
      ),
    ).not.toThrow();
  });
});

describe('a matrix with no schema', () => {
  const matrix: Matrix = {
    permissions: [
      {
        key: 'comment.update',
        object: 'comment',
        action: 'update',
        rules: [
          {
            id: 'typo',
            when: [{ field: 'object.authorID', op: 'eq', path: 'subject.id' }],
          },
        ],
      },
    ],
  };

  it('behaves exactly as before: a mistyped field decides unevaluable', () => {
    const access = hydratePolicy(matrix);
    const decision = access.can({ id: 's1' }, 'comment', 'update', {
      authorId: 's1',
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('unevaluable');
    expect(decision.missing).toEqual(['object.authorID']);
  });

  it('carries no schema on the access object or the document', () => {
    const access = hydratePolicy(matrix);
    expect(access.schema).toBeUndefined();
    expect(access.matrix.schema).toBeUndefined();
    expect(Object.hasOwn(access.matrix, 'schema')).toBe(false);
  });
});

describe('a schema on the frozen document', () => {
  it('is cloned, frozen, and survives a JSON round trip', () => {
    const source: MatrixSchema = {
      objects: { comment: { fields: { authorId: 'string' } } },
    };
    const access = hydratePolicy({
      schema: source,
      permissions: [
        {
          key: 'comment.update',
          object: 'comment',
          action: 'update',
          rules: [
            {
              id: 'r',
              when: [
                { field: 'object.authorId', op: 'eq', path: 'subject.id' },
              ],
            },
          ],
        },
      ],
    });

    expect(access.schema).toEqual(source);
    expect(access.schema).not.toBe(source);
    expect(Object.isFrozen(access.schema?.objects?.['comment'])).toBe(true);

    const round = JSON.parse(JSON.stringify(access.matrix)) as Matrix;
    expect(round).toEqual(access.matrix);
    expect(hydratePolicy(round).schema).toEqual(source);
  });
});
