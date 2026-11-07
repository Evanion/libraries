import { describe, expect, it } from 'vitest';

import type { FeatureConfig } from './config.js';
import { escapeField, parsePath } from './field-path.js';
import { ambiguousFields, requirements } from './requirements.js';
import type {
  Condition,
  FeatureDefinition,
  RolloutSpec,
  Rule,
} from './types.js';

function withCondition(condition: unknown): FeatureConfig {
  return {
    features: [
      {
        key: 'f',
        enabled: true,
        rules: [{ id: 'r', when: [condition as never] }],
      },
    ],
  };
}

function withRollout(by: string): FeatureConfig {
  return {
    features: [
      {
        key: 'f',
        enabled: true,
        rules: [{ id: 'r', rollout: { percent: 50, by } }],
      },
    ],
  };
}

function withVariantBy(variantBy: string): FeatureConfig {
  return {
    features: [
      {
        key: 'f',
        enabled: true,
        variantBy,
        variants: [{ name: 'a', weight: 1 }],
      },
    ],
  };
}

const LEGACY = { version: '0.1.0', uses: [] } as const;

describe('requirements', () => {
  it('asks for 0.1.0 of a document with none of the new constructs', () => {
    const config: FeatureConfig = {
      features: [
        {
          key: 'f',
          enabled: true,
          variantBy: 'targetingKey',
          variants: [{ name: 'a', weight: 1 }],
          rules: [
            {
              id: 'r',
              when: [
                { field: 'plan', op: 'eq', value: 'pro' },
                { field: 'now', op: 'before', value: '2030-01-01T00:00:00Z' },
                {
                  field: 'now',
                  op: 'day-of-week',
                  zone: 'UTC',
                  value: ['mon'],
                },
              ],
              rollout: { percent: 10, by: 'userId' },
            },
          ],
        },
      ],
    };

    expect(requirements(config)).toEqual(LEGACY);
  });

  it('asks for 0.1.0 of an empty document', () => {
    expect(requirements({ features: [] })).toEqual(LEGACY);
  });

  describe('each construct alone', () => {
    it.each([
      [
        'a dotted field',
        withCondition({ field: 'subject.id', op: 'eq', value: 'x' }),
        ['path'],
      ],
      ['a dotted by', withRollout('subject.id'), ['path']],
      ['a dotted variantBy', withVariantBy('subject.id'), ['path']],
      [
        'an escaped flat name',
        withCondition({ field: 'a\\.b', op: 'eq', value: 'x' }),
        ['path'],
      ],
      ['an escaped flat by', withRollout('a\\.b'), ['path']],
      ['exists', withCondition({ field: 'plan', op: 'exists' }), ['exists']],
      [
        'not-exists',
        withCondition({ field: 'plan', op: 'not-exists' }),
        ['exists'],
      ],
      [
        'a non-now before',
        withCondition({
          field: 'createdAt',
          op: 'before',
          value: '2030-01-01T00:00:00Z',
        }),
        ['instant-field'],
      ],
      [
        'a non-now after',
        withCondition({
          field: 'createdAt',
          op: 'after',
          value: '2030-01-01T00:00:00Z',
        }),
        ['instant-field'],
      ],
      [
        'a fromNow boundary',
        withCondition({
          field: 'createdAt',
          op: 'after',
          value: { fromNow: '-P30D' },
        }),
        ['instant-field', 'relative-instant'],
      ],
    ] as const)('%s', (_label, config, uses) => {
      expect(requirements(config)).toEqual({ version: '0.2.0', uses });
    });
  });

  it('names the path of a dotted non-now instant field once each', () => {
    const config = withCondition({
      field: 'subject.createdAt',
      op: 'after',
      value: { fromNow: '-P30D' },
    });

    expect(requirements(config)).toEqual({
      version: '0.2.0',
      uses: ['instant-field', 'path', 'relative-instant'],
    });
  });

  it('dedupes and sorts uses across rules and features', () => {
    const config: FeatureConfig = {
      features: [
        {
          key: 'a',
          enabled: true,
          rules: [
            {
              when: [
                { field: 'x', op: 'exists' },
                { field: 'a.b', op: 'eq', value: 1 },
                { field: 'c.d', op: 'eq', value: 1 },
              ],
            },
          ],
        },
        {
          key: 'b',
          enabled: true,
          rules: [{ when: [{ field: 'y', op: 'not-exists' }] }],
        },
      ],
    };

    expect(requirements(config).uses).toEqual(['exists', 'path']);
  });

  it('ignores a schema key, which 0.1 never reads into a decision', () => {
    const config: FeatureConfig = {
      schemaVersion: '1',
      schema: { context: { fields: { 'subject.id': 'string' } } },
      features: [{ key: 'f', enabled: true }],
    };

    expect(requirements(config)).toEqual(LEGACY);
  });

  it('reads a document that is not shaped like one without throwing', () => {
    for (const input of [
      null,
      undefined,
      1,
      'x',
      [],
      {},
      { features: 3 },
      { features: [null, 1, {}, { rules: 3 }, { rules: [null, { when: 4 }] }] },
      { features: [{ rules: [{ when: [null, {}, { field: 3, op: 'eq' }] }] }] },
    ]) {
      expect(requirements(input as never)).toEqual(LEGACY);
    }
  });

  describe('exhaustiveness', () => {
    // Adding a Condition op makes this table fail to compile until the op is
    // listed with a condition of that op and the constructs it needs.
    const BY_OP = {
      eq: [{ field: 'a', op: 'eq', value: 1 }, []],
      ne: [{ field: 'a', op: 'ne', value: 1 }, []],
      in: [{ field: 'a', op: 'in', value: [1] }, []],
      'not-in': [{ field: 'a', op: 'not-in', value: [1] }, []],
      contains: [{ field: 'a', op: 'contains', value: 1 }, []],
      exists: [{ field: 'a', op: 'exists' }, ['exists']],
      'not-exists': [{ field: 'a', op: 'not-exists' }, ['exists']],
      before: [
        { field: 'a', op: 'before', value: '2030-01-01T00:00:00Z' },
        ['instant-field'],
      ],
      after: [
        { field: 'a', op: 'after', value: '2030-01-01T00:00:00Z' },
        ['instant-field'],
      ],
      'day-of-week': [
        { field: 'now', op: 'day-of-week', zone: 'UTC', value: ['mon'] },
        [],
      ],
    } as const satisfies Record<
      Condition['op'],
      readonly [Condition, readonly string[]]
    >;

    it.each(Object.entries(BY_OP))('%s', (_op, [condition, uses]) => {
      expect(requirements(withCondition(condition)).uses).toEqual(uses);
    });

    it.each(Object.entries(BY_OP))(
      '%s over a dotted field also needs path',
      (_op, [condition]) => {
        const dotted = { ...condition, field: 'a.b' };

        expect(requirements(withCondition(dotted)).uses).toContain('path');
      },
    );

    // Adding a member to one of these types makes the table fail to compile
    // until it is classified. A member that names a context field must then
    // set `path` on a dotted name, which the second test checks.
    const RULE_MEMBERS = {
      id: null,
      when: null,
      rollout: null,
      variant: null,
    } as const satisfies Record<keyof Rule, null>;
    const ROLLOUT_MEMBERS = {
      percent: null,
      by: (value: string): FeatureConfig => withRollout(value),
      seed: null,
    } as const satisfies Record<
      keyof RolloutSpec,
      null | ((value: string) => FeatureConfig)
    >;
    const DEFINITION_MEMBERS = {
      key: null,
      enabled: null,
      dependsOn: null,
      rules: null,
      seed: null,
      freezeTimeAtBuild: null,
      variants: null,
      variantBy: (value: string): FeatureConfig => withVariantBy(value),
      variantSeed: null,
    } as const satisfies Record<
      keyof FeatureDefinition,
      null | ((value: string) => FeatureConfig)
    >;

    it('classifies every member of Rule', () => {
      expect(Object.keys(RULE_MEMBERS).sort()).toEqual(
        ['id', 'rollout', 'variant', 'when'].sort(),
      );
    });

    it.each(
      [
        ...Object.entries(ROLLOUT_MEMBERS),
        ...Object.entries(DEFINITION_MEMBERS),
      ].filter(([, build]) => build !== null),
    )(
      'the field-naming member %s reads a dotted name as a path',
      (_member, build) => {
        expect(
          requirements((build as (v: string) => FeatureConfig)('a.b')).uses,
        ).toEqual(['path']);
      },
    );
  });
});

describe('ambiguousFields', () => {
  it('returns nothing for a document with no dotted name', () => {
    expect(
      ambiguousFields(withCondition({ field: 'a', op: 'exists' })),
    ).toEqual([]);
    expect(ambiguousFields({ features: [] })).toEqual([]);
    expect(ambiguousFields({})).toEqual([]);
  });

  it('lists a dotted field, by, variantBy and schema key with their pointers', () => {
    const config: FeatureConfig = {
      schemaVersion: '1',
      schema: { context: { fields: { 'a.b': 'string', ok: 'string' } } },
      features: [
        {
          key: 'x',
          enabled: true,
          variantBy: 'v.w',
          variants: [{ name: 'a', weight: 1 }],
          rules: [
            { when: [{ field: 'c.d', op: 'eq', value: 1 }] },
            {
              when: [
                { field: 'e', op: 'eq', value: 1 },
                { field: 'f.g', op: 'exists' },
              ],
              rollout: { percent: 5, by: 'h.i' },
            },
          ],
        },
      ],
    };

    expect(ambiguousFields(config)).toEqual([
      { pointer: '/schema/context/fields/a.b', name: 'a.b' },
      { pointer: '/features/0/variantBy', name: 'v.w' },
      { pointer: '/features/0/rules/0/when/0/field', name: 'c.d' },
      { pointer: '/features/0/rules/1/when/1/field', name: 'f.g' },
      { pointer: '/features/0/rules/1/rollout/by', name: 'h.i' },
    ]);
  });

  it('lists the keys of a bare context schema', () => {
    expect(
      ambiguousFields({ fields: { 'a.b': 'string', c: 'number' } }),
    ).toEqual([{ pointer: '/fields/a.b', name: 'a.b' }]);
  });

  it('escapes ~ and / in a schema key pointer', () => {
    expect(ambiguousFields({ fields: { 'a/b~c.d': 'string' } })).toEqual([
      { pointer: '/fields/a~1b~0c.d', name: 'a/b~c.d' },
    ]);
  });

  it('skips a name whose every dot is escaped', () => {
    expect(
      ambiguousFields(withCondition({ field: 'a\\.b', op: 'exists' })),
    ).toEqual([]);
  });

  it('lists a name with an escaped dot and an unescaped one', () => {
    expect(
      ambiguousFields(withCondition({ field: 'a\\.b.c', op: 'exists' })),
    ).toEqual([
      { pointer: '/features/0/rules/0/when/0/field', name: 'a\\.b.c' },
    ]);
  });

  it('reads an escaped backslash before a dot as an unescaped dot', () => {
    expect(
      ambiguousFields(withCondition({ field: 'a\\\\.b', op: 'exists' })),
    ).toHaveLength(1);
  });

  it('does not throw on a document that is not shaped like one', () => {
    expect(ambiguousFields(null as never)).toEqual([]);
    expect(
      ambiguousFields({
        features: [null, { rules: [{ when: [1] }] }],
      } as never),
    ).toEqual([]);
  });
});

describe('escapeField', () => {
  it.each(['plain', 'a.b', 'a\\b', '.', '\\.', 'a.b\\c.d'])(
    'round-trips %j through parsePath',
    (name) => {
      expect(parsePath(escapeField(name))).toEqual([name]);
    },
  );

  it('leaves no unescaped dot for ambiguousFields to list', () => {
    expect(
      ambiguousFields(
        withCondition({ field: escapeField('a.b'), op: 'exists' }),
      ),
    ).toEqual([]);
  });
});
