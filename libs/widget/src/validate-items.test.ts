import { describe, it, expect } from 'vitest';
import { validateItems } from './validate-items.js';
import { createWidgets } from './widget.js';
import { VALIDATION_MESSAGES } from './constants.js';

// Bodies are irrelevant here: validateItems only ever looks at the map's keys.
const Leaf = (_props: { label: string }) => null;
const Box = (_props: { children?: unknown }) => null;

const components = { leaf: Leaf, box: Box };
const knownTypes = ['leaf', 'box'] as const;

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
      { index: -1, id: '-', type: '-', message: VALIDATION_MESSAGES.NOT_A_LIST },
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
    expect(validateItems([{ id: 1, type: 'leaf', props: {} }], knownTypes)).toEqual(
      [{ index: 0, id: '-', type: 'leaf', message: VALIDATION_MESSAGES.INVALID_ID }],
    );
  });

  it('reports a non-string type', () => {
    expect(validateItems([{ id: 'a', type: 1, props: {} }], knownTypes)).toEqual([
      { index: 0, id: 'a', type: '-', message: VALIDATION_MESSAGES.INVALID_TYPE },
    ]);
  });

  it('reports an unknown type', () => {
    expect(
      validateItems([{ id: 'a', type: 'nope', props: {} }], knownTypes),
    ).toEqual([
      { index: 0, id: 'a', type: 'nope', message: VALIDATION_MESSAGES.UNKNOWN_TYPE },
    ]);
  });

  it('does not accept an inherited Object.prototype key as a known type', () => {
    expect(
      validateItems([{ id: 'a', type: 'toString', props: {} }], components),
    ).toEqual([
      {
        index: 0,
        id: 'a',
        type: 'toString',
        message: VALIDATION_MESSAGES.UNKNOWN_TYPE,
      },
    ]);
  });

  it('reports non-object props', () => {
    expect(
      validateItems([{ id: 'a', type: 'leaf', props: 'nope' }], knownTypes),
    ).toEqual([
      { index: 0, id: 'a', type: 'leaf', message: VALIDATION_MESSAGES.INVALID_PROPS },
    ]);
  });

  it('accepts a missing props field', () => {
    expect(validateItems([{ id: 'a', type: 'leaf' }], knownTypes)).toEqual([]);
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
      { index: 0, id: 'b', type: 'nope', message: VALIDATION_MESSAGES.UNKNOWN_TYPE },
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

describe('createWidgets().validateItems', () => {
  it('is bound to the factory component map', () => {
    const { validateItems: bound } = createWidgets({ components });

    expect(bound([{ id: 'a', type: 'leaf', props: { label: 'a' } }])).toEqual([]);
    expect(bound([{ id: 'a', type: 'nope', props: {} }])).toEqual([
      { index: 0, id: 'a', type: 'nope', message: VALIDATION_MESSAGES.UNKNOWN_TYPE },
    ]);
  });
});
