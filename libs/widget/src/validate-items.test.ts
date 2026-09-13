import { describe, it, expect } from 'vitest';
import { validateItems } from './validate-items.js';
import { VALIDATION_MESSAGES } from './constants.js';

const registry = { leaf: {}, box: {} };
const knownTypes = ['leaf', 'box'] as const;

/**
 * Names `Object.prototype` carries. A CMS text field can hold any of them, and
 * a lookup written with `in` or a bare index finds them on the prototype of
 * every plain object.
 *
 * This is the rule the two validators this one replaces both got wrong, and
 * both had fixed separately. `tools/repo-checks/src/inherited-type-keys.test.ts`
 * holds every adapter's public surface to it from outside the package.
 */
const inheritedKeys = [
  'constructor',
  'toString',
  'valueOf',
  'hasOwnProperty',
  '__proto__',
];

describe('validateItems', () => {
  it('returns no problems for a well-formed list', () => {
    expect(
      validateItems(
        [{ id: 'a', type: 'leaf', props: { label: 'a' } }],
        knownTypes,
      ),
    ).toEqual([]);
  });

  it('reports a non-array root rather than throwing', () => {
    expect(validateItems(undefined, knownTypes)).toEqual([
      {
        index: -1,
        id: '-',
        type: '-',
        message: VALIDATION_MESSAGES.NOT_A_LIST,
      },
    ]);
    expect(validateItems('nope', knownTypes)).toHaveLength(1);
  });

  it('reports a null or non-object item', () => {
    expect(validateItems([null], knownTypes)).toEqual([
      {
        index: 0,
        id: '-',
        type: '-',
        message: VALIDATION_MESSAGES.NOT_AN_OBJECT,
      },
    ]);
    expect(validateItems(['nope'], knownTypes)).toHaveLength(1);
  });

  it('reports a non-string id', () => {
    expect(
      validateItems([{ id: 1, type: 'leaf', props: {} }], knownTypes),
    ).toEqual([
      {
        index: 0,
        id: '-',
        type: 'leaf',
        message: VALIDATION_MESSAGES.INVALID_ID,
      },
    ]);
  });

  it('reports a missing id, which every runtime now requires', () => {
    expect(validateItems([{ type: 'leaf', props: {} }], knownTypes)).toEqual([
      {
        index: 0,
        id: '-',
        type: 'leaf',
        message: VALIDATION_MESSAGES.INVALID_ID,
      },
    ]);
  });

  it('reports a non-string type', () => {
    expect(
      validateItems([{ id: 'a', type: 1, props: {} }], knownTypes),
    ).toEqual([
      {
        index: 0,
        id: 'a',
        type: '-',
        message: VALIDATION_MESSAGES.INVALID_TYPE,
      },
    ]);
  });

  it('reports an unknown type', () => {
    expect(
      validateItems([{ id: 'a', type: 'nope', props: {} }], knownTypes),
    ).toEqual([
      {
        index: 0,
        id: 'a',
        type: 'nope',
        message: VALIDATION_MESSAGES.UNKNOWN_TYPE,
      },
    ]);
  });

  it.each(inheritedKeys)(
    'does not accept the inherited Object.prototype key %s as a known type',
    (type) => {
      let problems: ReturnType<typeof validateItems> = [];
      expect(() => {
        problems = validateItems([{ id: 'a', type, props: {} }], registry, {
          leaf: ['label'],
        });
      }).not.toThrow();

      expect(problems).toEqual([
        {
          index: 0,
          id: 'a',
          type,
          message: VALIDATION_MESSAGES.UNKNOWN_TYPE,
        },
      ]);
    },
  );

  it.each(inheritedKeys)(
    'accepts %s as a type the registry actually declares',
    (type) => {
      expect(
        validateItems([{ id: 'a', type, props: {} }], { [type]: {} }),
      ).toEqual([]);
    },
  );

  it.each(inheritedKeys)(
    'treats a required map without an entry for %s as no required fields',
    (type) => {
      let problems: ReturnType<typeof validateItems> = [];
      expect(() => {
        problems = validateItems(
          [{ id: 'a', type, props: {} }],
          { [type]: {} },
          {},
        );
      }).not.toThrow();

      expect(problems).toEqual([]);
    },
  );

  it('reports non-object props', () => {
    expect(
      validateItems([{ id: 'a', type: 'leaf', props: 'nope' }], knownTypes),
    ).toEqual([
      {
        index: 0,
        id: 'a',
        type: 'leaf',
        message: VALIDATION_MESSAGES.INVALID_PROPS,
      },
    ]);
  });

  it('reports a missing props field, which a flat 0.2.x payload has', () => {
    expect(validateItems([{ id: 'a', type: 'leaf' }], knownTypes)).toEqual([
      {
        index: 0,
        id: 'a',
        type: 'leaf',
        message: VALIDATION_MESSAGES.INVALID_PROPS,
      },
    ]);
  });

  it('reports the whole of a flat item, so the migration gate is loud', () => {
    // What every 0.2.x @evanion/astro-widget payload looks like: props at the
    // top level, and on the Astro side an id that may not be there at all.
    expect(
      validateItems([{ type: 'leaf', label: 'Hello' }], knownTypes).map(
        (problem) => problem.message,
      ),
    ).toEqual([
      VALIDATION_MESSAGES.INVALID_ID,
      VALIDATION_MESSAGES.INVALID_PROPS,
    ]);
  });

  it('reports non-array children', () => {
    expect(
      validateItems(
        [{ id: 'a', type: 'box', props: {}, children: 'oops' }],
        knownTypes,
      ),
    ).toEqual([
      {
        index: 0,
        id: 'a',
        type: 'box',
        message: VALIDATION_MESSAGES.INVALID_CHILDREN,
      },
    ]);
  });

  it('reports duplicate sibling ids once, naming the duplicate', () => {
    const problems = validateItems(
      [
        { id: 'same', type: 'leaf', props: {} },
        { id: 'same', type: 'leaf', props: {} },
      ],
      knownTypes,
    );
    expect(problems).toEqual([
      {
        index: 1,
        id: 'same',
        type: 'leaf',
        message: VALIDATION_MESSAGES.DUPLICATE_ID,
      },
    ]);
  });

  it('allows the same id at different levels, because keys are scoped per list', () => {
    expect(
      validateItems(
        [
          {
            id: 'same',
            type: 'box',
            props: {},
            children: [{ id: 'same', type: 'leaf', props: {} }],
          },
        ],
        knownTypes,
      ),
    ).toEqual([]);
  });

  it('recurses into children', () => {
    const problems = validateItems(
      [
        {
          id: 'a',
          type: 'box',
          props: {},
          children: [{ id: 'b', type: 'nope', props: {} }],
        },
      ],
      knownTypes,
    );
    expect(problems).toEqual([
      {
        index: 0,
        id: 'b',
        type: 'nope',
        message: VALIDATION_MESSAGES.UNKNOWN_TYPE,
      },
    ]);
  });

  it('accumulates every problem rather than short-circuiting on the first', () => {
    const problems = validateItems(
      [
        { id: 'a', type: 'nope', props: {} },
        { id: 'b', type: 'leaf', props: 'bad' },
        { id: 'c', type: 'box', props: {}, children: 'bad' },
      ],
      knownTypes,
    );
    expect(problems.map((problem) => problem.message)).toEqual([
      VALIDATION_MESSAGES.UNKNOWN_TYPE,
      VALIDATION_MESSAGES.INVALID_PROPS,
      VALIDATION_MESSAGES.INVALID_CHILDREN,
    ]);
  });
});

describe('required fields', () => {
  const required = { leaf: ['label'] };

  it('passes a prop that is present and non-blank', () => {
    expect(
      validateItems(
        [{ id: 'a', type: 'leaf', props: { label: 'Hello' } }],
        registry,
        required,
      ),
    ).toEqual([]);
  });

  it('reports a missing prop, naming it', () => {
    expect(
      validateItems([{ id: 'a', type: 'leaf', props: {} }], registry, required),
    ).toEqual([
      {
        index: 0,
        id: 'a',
        type: 'leaf',
        message: VALIDATION_MESSAGES.MISSING_FIELD('label'),
      },
    ]);
  });

  it('treats whitespace as missing, which is what an emptied CMS field is', () => {
    expect(
      validateItems(
        [{ id: 'a', type: 'leaf', props: { label: '   ' } }],
        registry,
        required,
      ),
    ).toHaveLength(1);
  });

  it('reads a required prop off the props object, not off its prototype', () => {
    expect(
      validateItems([{ id: 'a', type: 'leaf', props: {} }], registry, {
        leaf: ['toString'],
      }),
    ).toEqual([
      {
        index: 0,
        id: 'a',
        type: 'leaf',
        message: VALIDATION_MESSAGES.MISSING_FIELD('toString'),
      },
    ]);
  });

  it('reports the absent props rather than each prop it would have held', () => {
    // One problem, not one per required field: the item's props are missing as
    // a whole, and naming every field it did not supply buries that.
    expect(
      validateItems([{ id: 'a', type: 'leaf' }], registry, required),
    ).toEqual([
      {
        index: 0,
        id: 'a',
        type: 'leaf',
        message: VALIDATION_MESSAGES.INVALID_PROPS,
      },
    ]);
  });

  it('applies to nested items too', () => {
    expect(
      validateItems(
        [
          {
            id: 'a',
            type: 'box',
            props: {},
            children: [{ id: 'b', type: 'leaf', props: {} }],
          },
        ],
        registry,
        required,
      ),
    ).toEqual([
      {
        index: 0,
        id: 'b',
        type: 'leaf',
        message: VALIDATION_MESSAGES.MISSING_FIELD('label'),
      },
    ]);
  });
});
