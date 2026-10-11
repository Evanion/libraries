import { describe, expect, it } from 'vitest';

import { canonicalDocument } from './canonical.js';
import { configDigest } from './digest.js';
import { createFeatures } from './features.js';
import { validateConfig } from './validate.js';
import type {
  ConfigIssue,
  ConfigIssueCode,
  FeatureConfig,
  FieldType,
  SerializedCondition,
  ValueShape,
} from './config.js';

/**
 * The two vocabularies `schema` carries, read off the checker that enforces them.
 *
 * `apps/docs/content/feature/api.mdx` states what each half of a `FeatureSchema`
 * means and what `validateConfig` reports over it. Every sentence that page
 * makes about a code, a keyword, a suffix or a digest has a case here, so a
 * later edit to the walk fails a test rather than leaving a page wrong.
 *
 * `validate.spec.ts` already holds one case per code. These are the input
 * classes beside those: the four combinators and not one of them, every fenced
 * keyword at once, a keyword at depth, a name an author chose that spells a
 * keyword, the operator-to-suffix matrix, and the two halves of the schema that
 * declare nothing.
 */

/** The two members § 3 has travel with a served variant set. */
const TRAVELS = {
  variantBy: 'targetingKey',
  variantSeed: 'cta:variant',
} as const;

/** A document whose one variant declares the value shape under test. */
function shaped(shape: ValueShape): FeatureConfig {
  return {
    features: [
      {
        key: 'cta',
        enabled: true,
        ...TRAVELS,
        variants: [{ name: 'banner', weight: 1, order: 0 }],
      },
    ],
    schemaVersion: 's1',
    schema: { features: { cta: { variants: { banner: shape } } } },
  };
}

/** A document whose one rule reads the conditions under test. */
function reading(
  fields: Readonly<Record<string, FieldType>> | undefined,
  when: readonly SerializedCondition[],
): FeatureConfig {
  return {
    features: [{ key: 'beta', enabled: true, rules: [{ when }] }],
    schemaVersion: 's1',
    schema: { context: fields === undefined ? {} : { fields } },
  };
}

/** The issues a document reports, in the order the checker found them. */
function issuesOf(config: FeatureConfig): readonly ConfigIssue[] {
  const result = validateConfig(config);
  return result.ok ? [] : result.issues;
}

/** The codes a document reports, in that same order. */
function codesOf(config: FeatureConfig): readonly ConfigIssueCode[] {
  return issuesOf(config).map((issue) => issue.code);
}

/** The pointers a document reports, in that same order. */
function pathsOf(config: FeatureConfig): readonly (string | undefined)[] {
  return issuesOf(config).map((issue) => issue.path);
}

describe('validateConfig, on the keywords a value shape may use', () => {
  it('refuses each of the four combinators under its own pointer', () => {
    const paths = (['allOf', 'anyOf', 'oneOf', 'not'] as const).map((keyword) =>
      pathsOf(shaped({ [keyword]: [{ type: 'string' }] })),
    );

    expect(paths).toEqual([
      ['/schema/features/cta/variants/banner/allOf'],
      ['/schema/features/cta/variants/banner/anyOf'],
      ['/schema/features/cta/variants/banner/oneOf'],
      ['/schema/features/cta/variants/banner/not'],
    ]);
  });

  it('reports all four of them in one shape that writes all four', () => {
    const config = shaped({
      allOf: [],
      anyOf: [],
      oneOf: [],
      not: {},
    });

    expect(codesOf(config)).toEqual([
      'unfenced-schema',
      'unfenced-schema',
      'unfenced-schema',
      'unfenced-schema',
    ]);
  });

  it('refuses a keyword that is no combinator and no member of the fence', () => {
    // The page states the fence as a closed list, so a reader meets
    // `unfenced-schema` for a keyword nobody would call a combinator.
    const paths = (['pattern', 'minLength', 'format'] as const).map((keyword) =>
      pathsOf(shaped({ type: 'string', [keyword]: 1 })),
    );

    expect(paths).toEqual([
      ['/schema/features/cta/variants/banner/pattern'],
      ['/schema/features/cta/variants/banner/minLength'],
      ['/schema/features/cta/variants/banner/format'],
    ]);
  });

  it('refuses the 2020-12 keyword that replaced a tuple items', () => {
    expect(codesOf(shaped({ prefixItems: [{ type: 'string' }] }))).toEqual([
      'unfenced-schema',
    ]);
  });

  it('accepts a shape writing every one of the eleven fenced keywords', () => {
    const config = shaped({
      $defs: { Label: { type: 'string' } },
      type: 'object',
      title: 'Banner copy',
      description: 'What the banner reads.',
      properties: {
        label: { $ref: '#/$defs/Label' },
        tier: { enum: ['bronze', 'silver'] },
        kind: { const: 'banner' },
        tags: { type: 'array', items: { type: 'string' } },
      },
      required: ['label'],
      additionalProperties: false,
    });

    expect(validateConfig(config)).toEqual({ ok: true });
  });

  it('names the feature the shape belongs to on every schema issue', () => {
    expect(issuesOf(shaped({ allOf: [] }))[0]).toMatchObject({
      code: 'unfenced-schema',
      key: 'cta',
    });
  });

  it('refuses a combinator two shape positions below the variant', () => {
    const config = shaped({
      type: 'object',
      properties: { tags: { items: { anyOf: [{ type: 'string' }] } } },
    });

    expect(pathsOf(config)).toEqual([
      '/schema/features/cta/variants/banner/properties/tags/items/anyOf',
    ]);
  });

  it('refuses a combinator under additionalProperties, which holds one shape', () => {
    expect(pathsOf(shaped({ additionalProperties: { not: {} } }))).toEqual([
      '/schema/features/cta/variants/banner/additionalProperties/not',
    ]);
  });

  it('accepts additionalProperties written as the boolean the walk stops at', () => {
    expect(validateConfig(shaped({ additionalProperties: false }))).toEqual({
      ok: true,
    });
  });

  it('accepts a property an author named after a combinator', () => {
    // `properties` holds a map from a name its author chose, so the walk
    // descends into the value and tests no name.
    const config = shaped({
      type: 'object',
      properties: { oneOf: { type: 'string' }, not: { type: 'number' } },
    });

    expect(validateConfig(config)).toEqual({ ok: true });
  });

  it('accepts a definition an author named after a combinator', () => {
    const config = shaped({
      $defs: { allOf: { type: 'string' } },
      type: 'object',
      properties: { label: { $ref: '#/$defs/allOf' } },
    });

    expect(validateConfig(config)).toEqual({ ok: true });
  });

  it('accepts a combinator spelled as a key inside a const', () => {
    expect(
      validateConfig(shaped({ const: { oneOf: ['banner'] } })),
    ).toStrictEqual({ ok: true });
  });

  it('accepts a combinator spelled inside an enum member', () => {
    const config = shaped({ enum: [{ allOf: 1 }, 'bronze'] });

    expect(validateConfig(config)).toEqual({ ok: true });
  });

  it('accepts a combinator named in a required list', () => {
    const config = shaped({
      type: 'object',
      properties: { allOf: { type: 'string' } },
      required: ['allOf'],
    });

    expect(validateConfig(config)).toEqual({ ok: true });
  });

  it('accepts a combinator written under title and under description', () => {
    const config = shaped({
      type: 'string',
      title: { anyOf: [] },
      description: { not: {} },
    });

    expect(validateConfig(config)).toEqual({ ok: true });
  });

  it('reads past a combinator hidden in an items array, which 2020-12 has no form for', () => {
    // `items` holds one shape in 2020-12 and the walk descends into the value.
    // An array is no shape, so the walk stops at it and the `not` inside goes
    // unreported. `prefixItems` is how 2020-12 spells a tuple and the fence
    // refuses that keyword, so the only document reaching here is one whose
    // author wrote draft-07.
    const config = shaped({ type: 'array', items: [{ not: {} }] });

    expect(validateConfig(config)).toEqual({ ok: true });
  });

  it('reads past a properties member that arrived as an array', () => {
    const config = shaped({ type: 'object', properties: [{ oneOf: [] }] });

    expect(validateConfig(config)).toEqual({ ok: true });
  });

  it('writes a slash in a variant name as the escape a JSON pointer reads', () => {
    const config: FeatureConfig = {
      features: [
        {
          key: 'cta',
          enabled: true,
          ...TRAVELS,
          variants: [{ name: 'a/b', weight: 1, order: 0 }],
        },
      ],
      schemaVersion: 's1',
      schema: { features: { cta: { variants: { 'a/b': { oneOf: [] } } } } },
    };

    expect(pathsOf(config)).toEqual([
      '/schema/features/cta/variants/a~1b/oneOf',
    ]);
  });

  it('reports one issue per variant shape a feature declares two defects over', () => {
    const config: FeatureConfig = {
      features: [
        {
          key: 'cta',
          enabled: true,
          ...TRAVELS,
          variants: [
            { name: 'banner', weight: 1, order: 0 },
            { name: 'strip', weight: 1, order: 1 },
          ],
        },
      ],
      schemaVersion: 's1',
      schema: {
        features: {
          cta: { variants: { banner: { allOf: [] }, strip: { not: {} } } },
        },
      },
    };

    expect(pathsOf(config)).toEqual([
      '/schema/features/cta/variants/banner/allOf',
      '/schema/features/cta/variants/strip/not',
    ]);
  });

  it('reads nothing off a schema whose features member is not a map', () => {
    const config = {
      features: [{ key: 'cta', enabled: true }],
      schemaVersion: 's1',
      schema: { features: [{ variants: { banner: { oneOf: [] } } }] },
    } as unknown as FeatureConfig;

    expect(validateConfig(config)).toEqual({ ok: true });
  });

  it('reads nothing off a feature shape whose variants member is not a map', () => {
    const config = {
      features: [{ key: 'cta', enabled: true }],
      schemaVersion: 's1',
      schema: { features: { cta: { variants: 'banner' } } },
    } as unknown as FeatureConfig;

    expect(validateConfig(config)).toEqual({ ok: true });
  });
});

describe('validateConfig, on the $ref a value shape may write', () => {
  it('refuses a $ref into a sibling of $defs', () => {
    expect(codesOf(shaped({ $ref: '#/definitions/Label' }))).toEqual([
      'unfenced-schema',
    ]);
  });

  it('refuses a $ref that resolves against the document root', () => {
    expect(codesOf(shaped({ $ref: '#' }))).toEqual(['unfenced-schema']);
  });

  it('refuses a $ref whose prefix only begins like the local one', () => {
    expect(codesOf(shaped({ $ref: '#/$defsLabel' }))).toEqual([
      'unfenced-schema',
    ]);
  });

  it('refuses a $ref that arrived as a number', () => {
    const config = shaped({ $ref: 42 });

    expect(issuesOf(config)[0]).toMatchObject({
      code: 'unfenced-schema',
      path: '/schema/features/cta/variants/banner/$ref',
    });
  });

  it('accepts a $ref naming a $defs entry the document does not carry', () => {
    // The fence reads the prefix and resolves nothing. A generator reading this
    // document answers for the dangling pointer, and no issue code names it.
    expect(validateConfig(shaped({ $ref: '#/$defs/Missing' }))).toStrictEqual({
      ok: true,
    });
  });

  it('accepts the bare local prefix, which names no entry at all', () => {
    expect(validateConfig(shaped({ $ref: '#/$defs/' }))).toStrictEqual({
      ok: true,
    });
  });

  it('reads no sibling keyword of a $ref it already refused', () => {
    const config = shaped({ $ref: 'https://example.test/l.json', oneOf: [] });

    expect(codesOf(config)).toEqual(['unfenced-schema', 'unfenced-schema']);
  });
});

describe('validateConfig, on the schemaVersion an inline schema states', () => {
  it('reads nothing about a document carrying neither member', () => {
    const config: FeatureConfig = { features: [{ key: 'a', enabled: true }] };

    expect(validateConfig(config)).toEqual({ ok: true });
  });

  it('refuses an inline schema that declares nothing and names no version', () => {
    const config: FeatureConfig = {
      features: [{ key: 'a', enabled: true }],
      schema: {},
    };

    expect(issuesOf(config)[0]).toMatchObject({
      code: 'missing-schema-version',
      path: '/schema',
    });
  });

  it('accepts a schemaVersion written as the empty string', () => {
    // The check reads whether the member travelled and not what it says, so a
    // publisher that writes an empty version satisfies it and caches a schema
    // every other document also names the empty string.
    const config: FeatureConfig = {
      features: [{ key: 'a', enabled: true }],
      schema: { context: { fields: { plan: 'string' } } },
      schemaVersion: '',
    };

    expect(validateConfig(config)).toEqual({ ok: true });
  });
});

describe('validateConfig, on the context fields a rule reads', () => {
  it('reads no condition of a document whose schema omits a context', () => {
    const config = reading(undefined, [
      { field: 'tier', op: 'eq', value: 'gold' },
    ]);

    expect(validateConfig(config)).toEqual({ ok: true });
  });

  it('refuses every field of a document declaring an empty field map', () => {
    // An empty `fields` map is a declaration of zero fields, so the lookup runs
    // and finds nothing. A document meaning "no contract" omits the member.
    const config = reading({}, [{ field: 'tier', op: 'eq', value: 'gold' }]);

    expect(codesOf(config)).toEqual(['unknown-context-field']);
  });

  it('reads no day-of-week condition against the declared fields', () => {
    const config = reading({ plan: 'string' }, [
      { field: 'now', op: 'day-of-week', zone: 'UTC', value: ['mon'] },
    ]);

    expect(validateConfig(config)).toEqual({ ok: true });
  });

  it('reads no window condition against the declared fields', () => {
    // `before` and `after` read `now`, which no schema declares as a field.
    const config = reading({ plan: 'string' }, [
      { field: 'now', op: 'after', value: '2026-10-01T00:00:00Z' },
    ]);

    expect(validateConfig(config)).toEqual({ ok: true });
  });

  it('reports one unknown field per condition a rule writes over one', () => {
    const config = reading({ plan: 'string' }, [
      { field: 'tier', op: 'eq', value: 'gold' },
      { field: 'tier', op: 'ne', value: 'bronze' },
    ]);

    expect(pathsOf(config)).toEqual([
      '/features/0/rules/0/when/0/field',
      '/features/0/rules/0/when/1/field',
    ]);
  });

  it('points at the operator and not at the field on a type mismatch', () => {
    const config = reading({ tier: 'string' }, [
      { field: 'tier', op: 'contains', value: 'gold' },
    ]);

    expect(pathsOf(config)).toEqual(['/features/0/rules/0/when/0/op']);
  });

  it('names the declared type in the message a mismatch carries', () => {
    const config = reading({ tags: 'string[]' }, [
      { field: 'tags', op: 'eq', value: ['gold'] },
    ]);

    expect(issuesOf(config)[0]?.message).toContain(
      'the schema declares string[]',
    );
  });

  it('reads a field declared under a prototype member name off the declaration', () => {
    // The lookup goes through `hasOwnProperty`, so a field named `constructor`
    // reads the type its author declared and not the function on
    // `Object.prototype`. The value asserts its type because TypeScript reads
    // the contextual type of `constructor` off `Object.prototype` and never off
    // the index signature, which `config.test-d.ts` holds as its own case.
    const config = reading({ constructor: 'string' as FieldType }, [
      { field: 'constructor', op: 'eq', value: 'gold' },
    ]);

    expect(validateConfig(config)).toEqual({ ok: true });
  });

  it('holds a field named after a prototype member to its declared type', () => {
    const config = reading({ constructor: 'string' as FieldType }, [
      { field: 'constructor', op: 'contains', value: 'gold' },
    ]);

    expect(codesOf(config)).toEqual(['field-type-mismatch']);
  });

  it('resolves a contains over a boolean member off for every subject', () => {
    // `evaluateCondition` reads the context member as the list it searches, and
    // `Array.isArray(true)` is false. The sibling store compares the same
    // member with `eq`, so the difference is the operator and not the subject.
    // Neither document declares a schema, which is what leaves both buildable.
    const searching = createFeatures(
      reading(undefined, [{ field: 'staff', op: 'contains', value: true }]),
    );
    const comparing = createFeatures(
      reading(undefined, [{ field: 'staff', op: 'eq', value: true }]),
    );

    expect([
      searching.isEnabled('beta', { staff: true }),
      comparing.isEnabled('beta', { staff: true }),
    ]).toEqual([false, true]);
  });

  it('refuses the document at createFeatures, where validateConfig reports it', () => {
    const config = reading({ staff: 'boolean' }, [
      { field: 'staff', op: 'contains', value: true },
    ]);

    expect(() => createFeatures(config)).toThrow(
      'applies "contains" to the context field "staff", which the schema declares boolean',
    );
  });

  it('refuses a condition over an undeclared field at createFeatures too', () => {
    const config = reading({ plan: 'string' }, [
      { field: 'tier', op: 'eq', value: 'gold' },
    ]);

    expect(() => createFeatures(config)).toThrow(
      'reads the context field "tier", which the schema does not declare',
    );
  });

  it('reads a __proto__ field a parsed document carries as its own key', () => {
    const config = JSON.parse(
      '{"features":[{"key":"beta","enabled":true,"rules":[{"when":[{"field":"__proto__","op":"eq","value":1}]}]}],"schemaVersion":"s1","schema":{"context":{"fields":{"__proto__":"number"}}}}',
    ) as FeatureConfig;

    expect(validateConfig(config)).toEqual({ ok: true });
  });
});

describe('validateConfig, on the operator a declared suffix admits', () => {
  /** One condition over `audience`, declared as the type under test. */
  const fits = (declared: FieldType, op: SerializedCondition['op']): boolean =>
    validateConfig(
      reading({ audience: declared }, [
        { field: 'audience', op, value: 'gold' } as SerializedCondition,
      ]),
    ).ok;

  it('takes contains over an array and over an optional array', () => {
    expect([
      fits('string[]', 'contains'),
      fits('string[]?', 'contains'),
    ]).toEqual([true, true]);
  });

  it('refuses contains over a scalar and over an optional scalar', () => {
    expect([fits('string', 'contains'), fits('string?', 'contains')]).toEqual([
      false,
      false,
    ]);
  });

  it('refuses each of the four scalar operators over an array', () => {
    const over = (['eq', 'ne', 'in', 'not-in'] as const).map((op) =>
      fits('string[]', op),
    );

    expect(over).toEqual([false, false, false, false]);
  });

  it('refuses each of the four scalar operators over an optional array', () => {
    const over = (['eq', 'ne', 'in', 'not-in'] as const).map((op) =>
      fits('string[]?', op),
    );

    expect(over).toEqual([false, false, false, false]);
  });

  it('takes each of the four scalar operators over a scalar', () => {
    const over = (['eq', 'ne', 'in', 'not-in'] as const).map((op) =>
      fits('instant', op),
    );

    expect(over).toEqual([true, true, true, true]);
  });

  it('takes each base name on its own and each base name as an array', () => {
    const bases = ['string', 'number', 'boolean', 'instant'] as const;
    const scalars = bases.map((base) => fits(base, 'eq'));
    const arrays = bases.map((base) => fits(`${base}[]`, 'contains'));

    expect([scalars, arrays]).toEqual([
      [true, true, true, true],
      [true, true, true, true],
    ]);
  });

  it('reads the optional mark off a scalar before it judges the operator', () => {
    const bases = ['string', 'number', 'boolean', 'instant'] as const;

    expect(bases.map((base) => fits(`${base}?`, 'in'))).toEqual([
      true,
      true,
      true,
      true,
    ]);
  });
});

describe('createFeatures, on a variant value its own schema contradicts', () => {
  /** A document declaring a string label and carrying a number at it. */
  const config: FeatureConfig = {
    features: [
      {
        key: 'cta',
        enabled: true,
        ...TRAVELS,
        variants: [
          { name: 'banner', weight: 1, order: 0, value: { label: 7 } },
        ],
      },
    ],
    schemaVersion: 's1',
    schema: {
      features: {
        cta: {
          variants: {
            banner: {
              type: 'object',
              properties: { label: { type: 'string' } },
              required: ['label'],
            },
          },
        },
      },
    },
  };

  it('accepts the document, because no walk reads a variant value', () => {
    expect(validateConfig(config)).toEqual({ ok: true });
  });

  it('hands the value to valueOf as the document wrote it', () => {
    const features = createFeatures(config);

    expect(features.valueOf('cta', { targetingKey: 'shopper-1' })).toEqual({
      label: 7,
    });
  });

  it('reads a value shape for a variant the document does not carry', () => {
    // A schema is immutable at its `schemaVersion`, so it outlives the variant
    // a later document dropped and no issue code names the orphan.
    const orphaned: FeatureConfig = {
      ...config,
      schema: {
        features: {
          cta: { variants: { banner: {}, retired: { type: 'string' } } },
        },
      },
    };

    expect(validateConfig(orphaned)).toEqual({ ok: true });
  });
});

describe('createFeatures, on the order a feature shape does not fix', () => {
  /** Two even bands, walked in the order the two numbers declare. */
  function ordered(
    banner: number,
    strip: number,
    shapes: Readonly<Record<string, ValueShape>> = {
      banner: { type: 'string' },
      strip: { type: 'string' },
    },
  ): FeatureConfig {
    return {
      features: [
        {
          key: 'cta',
          enabled: true,
          ...TRAVELS,
          variants: [
            { name: 'banner', weight: 50, order: banner, value: 'banner' },
            { name: 'strip', weight: 50, order: strip, value: 'strip' },
          ],
        },
      ],
      schemaVersion: 's1',
      schema: { features: { cta: { variants: shapes } } },
    };
  }

  it('moves a subject when the two variants swap the order they declare', () => {
    // `bucketingOrder` sorts on `order`, so one subject's bucket falls in the
    // first band under one document and in the second under the other.
    const at = { targetingKey: 'shopper-1' };
    const forward = createFeatures(ordered(0, 1));
    const reversed = createFeatures(ordered(1, 0));

    expect(forward.valueOf('cta', at)).not.toBe(reversed.valueOf('cta', at));
  });

  it('moves nobody when the schema lists the two value shapes the other way', () => {
    const at = { targetingKey: 'shopper-1' };
    const listed = createFeatures(ordered(0, 1));
    const reversed = createFeatures(
      ordered(0, 1, { strip: { type: 'string' }, banner: { type: 'string' } }),
    );

    expect(listed.valueOf('cta', at)).toBe(reversed.valueOf('cta', at));
  });

  it('accepts the schema whose key order reverses the document order', () => {
    const config = ordered(0, 1, {
      strip: { type: 'string' },
      banner: { type: 'string' },
    });

    expect(validateConfig(config)).toEqual({ ok: true });
  });
});

describe('createFeatures, on the schema defects a document carries', () => {
  it('refuses a value shape writing a keyword the fence does not admit', () => {
    // An author who builds a store from their own document reads the refusal
    // at construction, where `validateConfig` reports it to a holder.
    expect(() => createFeatures(shaped({ oneOf: [] }))).toThrow(
      'the value shape at /schema/features/cta/variants/banner/oneOf uses the keyword "oneOf", which the fence refuses',
    );
  });

  it('refuses a $ref that leaves the document at construction too', () => {
    expect(() =>
      createFeatures(shaped({ $ref: 'https://example.test/l.json' })),
    ).toThrow('may reference only a $defs entry in the same document');
  });

  it('refuses an inline schema that names no version at construction too', () => {
    const config: FeatureConfig = {
      features: [{ key: 'a', enabled: true }],
      schema: { context: { fields: { plan: 'string' } } },
    };

    expect(() => createFeatures(config)).toThrow(
      'the document carries an inline schema and no schemaVersion',
    );
  });

  it('builds a store from a document whose schema names its version', () => {
    const config: FeatureConfig = {
      features: [{ key: 'a', enabled: true }],
      schemaVersion: 's1',
      schema: { context: { fields: { plan: 'string' } } },
    };

    expect(createFeatures(config).isEnabled('a')).toBe(true);
  });
});

describe('configDigest, on the one JsonValue arm a transport changes', () => {
  /**
   * A document whose one condition compares against the list it is given.
   *
   * `JsonValue` refuses an `undefined` element, so the condition is assembled
   * past the type. A publisher that reached this document reached it the same
   * way: off a column, out of a splice, or through a `delete`.
   */
  function listing(value: readonly (string | undefined)[]): FeatureConfig {
    return {
      features: [
        {
          key: 'beta',
          enabled: true,
          rules: [
            {
              when: [{ field: 'tier', op: 'in', value } as SerializedCondition],
            },
          ],
        },
      ],
    };
  }

  /**
   * A list holding `'silver'` at index 2 and a hole at index 1.
   *
   * Written by index, because no literal spells a hole and `JSON.parse` writes
   * none. `structuredClone` in `createFeatures` keeps one, so a publisher that
   * deleted an element reaches here. `serializeConfig` refuses the document.
   */
  function holed(): readonly (string | undefined)[] {
    const value: (string | undefined)[] = [];
    value[0] = 'gold';
    value[2] = 'silver';
    return value;
  }

  it('writes an element a publisher wrote as undefined under that name', () => {
    expect(canonicalDocument(listing(['gold', undefined, 'silver']))).toContain(
      '["gold",undefined,"silver"]',
    );
  });

  it('writes a hole as nothing, because a map over an array walks past one', () => {
    expect(canonicalDocument(listing(holed()))).toContain('["gold",,"silver"]');
  });

  it('writes the element a transport carried as null', () => {
    const carried = JSON.parse(
      JSON.stringify(listing(['gold', undefined, 'silver'])),
    ) as FeatureConfig;

    expect(canonicalDocument(carried)).toContain('["gold",null,"silver"]');
  });

  it('digests the publisher document and the one a transport carried apart', () => {
    const published = listing(['gold', undefined, 'silver']);
    const carried = JSON.parse(JSON.stringify(published)) as FeatureConfig;

    expect(configDigest(carried)).not.toBe(configDigest(published));
  });

  it('digests a document holding a hole apart from the one a transport carried', () => {
    const published = listing(holed());
    const carried = JSON.parse(JSON.stringify(published)) as FeatureConfig;

    expect(configDigest(carried)).not.toBe(configDigest(published));
  });

  it('has the holder report the digest its own document disagrees with', () => {
    const published = listing(['gold', undefined, 'silver']);
    const served = JSON.parse(
      JSON.stringify({ ...published, digest: configDigest(published) }),
    ) as FeatureConfig;

    expect(issuesOf(served)[0]).toMatchObject({
      code: 'digest-mismatch',
      path: '/digest',
    });
  });

  it('digests a member nobody wrote and an absent member alike', () => {
    const written: FeatureConfig = {
      features: [
        {
          key: 'beta',
          enabled: true,
          rules: [
            {
              when: [
                {
                  field: 'tier',
                  op: 'eq',
                  value: { plan: 'gold', seat: undefined },
                },
              ],
            },
          ],
        },
      ],
    };
    const absent: FeatureConfig = {
      features: [
        {
          key: 'beta',
          enabled: true,
          rules: [
            { when: [{ field: 'tier', op: 'eq', value: { plan: 'gold' } }] },
          ],
        },
      ],
    };

    expect(configDigest(written)).toBe(configDigest(absent));
  });
});
