import { describe, expect, it } from 'vitest';
import {
  addLine,
  cartSize,
  parseCart,
  readCart,
  removeLine,
  setQuantity,
} from './cart.js';

/**
 * The cart is a cookie a reader can edit, so most of this file is about what
 * comes back from a cookie holding something other than a cart.
 */
describe('parseCart', () => {
  it('reads well-formed lines', () => {
    expect(parseCart([{ urn: 'urn:game:azul', quantity: 2 }])).toEqual([
      { urn: 'urn:game:azul', quantity: 2 },
    ]);
  });

  it.each([undefined, null, 'azul', 42, {}])(
    'returns an empty cart for %s',
    (value) => {
      expect(parseCart(value)).toEqual([]);
    },
  );

  it('drops an entry with no urn', () => {
    expect(parseCart([{ quantity: 2 }, { urn: '', quantity: 1 }])).toEqual([]);
  });

  it('drops a line asking for nothing', () => {
    expect(parseCart([{ urn: 'urn:game:azul', quantity: 0 }])).toEqual([]);
  });

  it('caps a hand-edited quantity', () => {
    expect(parseCart([{ urn: 'urn:game:azul', quantity: 10_000 }])).toEqual([
      { urn: 'urn:game:azul', quantity: 99 },
    ]);
  });

  it('truncates a fractional quantity rather than carrying it into a total', () => {
    expect(parseCart([{ urn: 'urn:game:azul', quantity: 2.7 }])).toEqual([
      { urn: 'urn:game:azul', quantity: 2 },
    ]);
  });
});

describe('readCart', () => {
  it('returns an empty cart when the cookie is not valid json', () => {
    const cookies = {
      get: () => ({
        json: () => {
          throw new SyntaxError('unexpected token');
        },
      }),
    };

    expect(readCart(cookies)).toEqual([]);
  });

  it('returns an empty cart when there is no cookie', () => {
    expect(readCart({ get: () => undefined })).toEqual([]);
  });
});

describe('addLine', () => {
  it('merges into the existing line for the same urn', () => {
    const cart = addLine(
      [{ urn: 'urn:game:azul', quantity: 1 }],
      'urn:game:azul',
      2,
    );

    expect(cart).toEqual([{ urn: 'urn:game:azul', quantity: 3 }]);
  });

  it('appends a line for a urn not in the cart', () => {
    const cart = addLine(
      [{ urn: 'urn:game:azul', quantity: 1 }],
      'urn:game:root',
      1,
    );

    expect(cart).toEqual([
      { urn: 'urn:game:azul', quantity: 1 },
      { urn: 'urn:game:root', quantity: 1 },
    ]);
  });

  it('adds an expansion as its own line', () => {
    const cart = addLine([], 'urn:expansion:wingspan:europe', 1);

    expect(cart).toEqual([
      { urn: 'urn:expansion:wingspan:europe', quantity: 1 },
    ]);
  });

  it('leaves the cart alone when asked for no copies', () => {
    expect(addLine([], 'urn:game:azul', 0)).toEqual([]);
  });
});

describe('setQuantity', () => {
  it('sets the line', () => {
    expect(
      setQuantity([{ urn: 'urn:game:azul', quantity: 1 }], 'urn:game:azul', 4),
    ).toEqual([{ urn: 'urn:game:azul', quantity: 4 }]);
  });

  it('removes the line at zero, which is what a cart does', () => {
    expect(
      setQuantity([{ urn: 'urn:game:azul', quantity: 1 }], 'urn:game:azul', 0),
    ).toEqual([]);
  });
});

describe('removeLine', () => {
  it('drops only the named urn', () => {
    const cart = removeLine(
      [
        { urn: 'urn:game:azul', quantity: 1 },
        { urn: 'urn:game:root', quantity: 1 },
      ],
      'urn:game:azul',
    );

    expect(cart).toEqual([{ urn: 'urn:game:root', quantity: 1 }]);
  });
});

describe('cartSize', () => {
  it('counts copies, not lines', () => {
    expect(
      cartSize([
        { urn: 'urn:game:azul', quantity: 2 },
        { urn: 'urn:game:root', quantity: 3 },
      ]),
    ).toBe(5);
  });
});
