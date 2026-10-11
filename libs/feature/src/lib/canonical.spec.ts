import { describe, expect, it } from 'vitest';
import { canonical, canonicalDocument } from './canonical.js';

describe('canonical', () => {
  it('sorts object keys', () => {
    expect(canonical({ b: 1, a: 2 })).toBe(canonical({ a: 2, b: 1 }));
  });

  it('preserves array order', () => {
    expect(canonical(['a', 'b'])).not.toBe(canonical(['b', 'a']));
  });

  it('drops an undefined property', () => {
    expect(canonical({ a: 1, b: undefined })).toBe(canonical({ a: 1 }));
  });

  it('writes a date as its ISO string', () => {
    expect(canonical(new Date(0))).toBe('"1970-01-01T00:00:00.000Z"');
  });

  it('writes null', () => {
    expect(canonical(null)).toBe('null');
  });

  it('separates a nested object from a string that spells it', () => {
    expect(canonical({ a: { b: 1 } })).not.toBe(canonical({ a: '{"b":1}' }));
  });

  it('writes undefined as a string', () => {
    expect(canonical(undefined)).toBe('undefined');
  });

  it('writes a bigint with a trailing n', () => {
    expect(canonical(10n)).toBe('10n');
  });

  it('separates a bigint from the number of the same value', () => {
    expect(canonical(10n)).not.toBe(canonical(10));
  });

  it('writes a non-finite number behind a number tag', () => {
    expect(canonical(Number.NaN)).toBe('number:NaN');
    expect(canonical(Number.POSITIVE_INFINITY)).toBe('number:Infinity');
    expect(canonical(Number.NEGATIVE_INFINITY)).toBe('number:-Infinity');
  });

  it('separates NaN, Infinity, -Infinity and the null JSON writes for them', () => {
    // `toEpoch` at `conditions.ts:18-22` returns a number window instant
    // untouched, so a `before` boundary of `Infinity` matches every `now`, one
    // of `-Infinity` matches none, and one of `NaN` fails the guard at
    // `conditions.ts:73`. `JSON.stringify` writes one text for all three.
    const texts = new Set([
      canonical(Number.NaN),
      canonical(Number.POSITIVE_INFINITY),
      canonical(Number.NEGATIVE_INFINITY),
      canonical(null),
    ]);

    expect(texts.size).toBe(4);
  });

  it('separates a non-finite number from the string that spells its text', () => {
    expect(canonical(Number.NaN)).not.toBe(canonical('number:NaN'));
    expect(canonical(Number.POSITIVE_INFINITY)).not.toBe(
      canonical('number:Infinity'),
    );
  });

  it('writes a finite number the way JSON.stringify writes it', () => {
    // A producer in another language reproduces this text or it computes a
    // different digest for every document carrying a variant weight, a variant
    // order, a `rollout.percent` or a `maxStale`. `JSON.stringify` is
    // ECMAScript `Number::toString`, so an integral double writes no `.0`, the
    // exponent forms carry a sign and a lowercase `e`, and a decimal writes the
    // shortest text that round-trips. Java's `Double.toString` writes `1.0`,
    // `1.0E21` and `1.0E-7` for three of these.
    expect(canonical(41)).toBe('41');
    expect(canonical(1)).toBe('1');
    expect(canonical(-0)).toBe('0');
    expect(canonical(1e21)).toBe('1e+21');
    expect(canonical(1e-7)).toBe('1e-7');
    expect(canonical(0.1 + 0.2)).toBe('0.30000000000000004');
  });

  it('writes a string the way JSON.stringify escapes it', () => {
    // The other half of the same cross-language contract. `JSON.stringify`
    // escapes a tab and a control character, writes lowercase hex in a `\u`
    // escape, escapes a lone surrogate, and leaves `/`, U+2028 and every
    // non-ASCII character raw. A port that escapes `/`, writes uppercase hex or
    // escapes every non-ASCII character disagrees on every document carrying
    // one of them.
    expect(canonical('a\tb')).toBe('"a\\tb"');
    expect(canonical('a\u0001b')).toBe('"a\\u0001b"');
    expect(canonical('a\u001fb')).toBe('"a\\u001fb"');
    expect(canonical('a/b')).toBe('"a/b"');
    expect(canonical('a\u2028b')).toBe('"a\u2028b"');
    expect(canonical('a\udfffb')).toBe('"a\\udfffb"');
    expect(canonical('caf\u00e9')).toBe('"caf\u00e9"');
  });

  it('writes a function as a string instead of returning undefined', () => {
    expect(typeof canonical(() => 1)).toBe('string');
  });

  it('writes a symbol as a string instead of returning undefined', () => {
    expect(typeof canonical(Symbol('x'))).toBe('string');
  });

  it('separates two functions with different source', () => {
    expect(canonical(() => 1)).not.toBe(canonical(() => 2));
  });

  it('reads a value two paths reach once', () => {
    // A getter counts the reads. 16 levels of diamond give the leaf 2^16 paths,
    // and a walk with no memo takes every one of them, which is the cost
    // `serialized` at `serialize.ts:134` already refuses to pay on the same
    // graph.
    let reads = 0;
    const leaf = {
      get depth() {
        reads += 1;
        return 1;
      },
    };
    let held: object = leaf;
    for (let level = 0; level < 16; level += 1) held = { l: held, r: held };

    canonical(held);

    expect(reads).toBe(1);
  });

  it('writes a shared value as the copies JSON expands it into', () => {
    // The memo is a walk memo, not a back-reference in the text. A holder
    // parses the document JSON handed it, where the sharing is gone, and
    // computes the same text over it.
    const leaf = { depth: 1 };
    const shared = { l: leaf, r: leaf };

    expect(canonical(shared)).toBe(
      canonical(JSON.parse(JSON.stringify(shared)) as unknown),
    );
  });

  it('refuses a value that holds itself', () => {
    // The memo entry is written after the recursion, so a cycle reaches no
    // entry for a text it has not finished and the stack throws.
    const shape: Record<string, unknown> = {};
    shape['self'] = shape;

    expect(() => canonical(shape)).toThrow(RangeError);
  });

  it('sorts an integer-like key by its text and not by its number', () => {
    // `Object.entries` hands back `'2'` ahead of `'10'`, because a JavaScript
    // object orders an integer-like key numerically whichever order an author
    // wrote the two in. The sort compares the key text, so a producer in
    // another language matches it whether or not its own maps order keys at
    // all. A schema's `features` map is keyed by feature key and `FeatureKey`
    // admits a number, so a document keyed on a numeric enum reaches this.
    expect(canonical({ 10: 'a', 2: 'b' })).toBe('{"10":"a","2":"b"}');
  });

  it('writes one text for two integer-like keys in either order', () => {
    expect(canonical({ 2: 'b', 10: 'a' })).toBe(canonical({ 10: 'a', 2: 'b' }));
  });

  it('sorts a key by its code units, which is the order a port matches', () => {
    // `<` compares UTF-16 code units, so `z` at 0x7a precedes the accented
    // key at 0xe9. A locale collation orders the two the other way, and
    // `fnv1a` in `rule-id.ts` walks code units for the same reason this does:
    // a port in another language matches code units.
    expect(canonical({ é: 1, z: 2 })).toBe('{"z":2,"\u00e9":1}');
  });

  it('writes a date naming no instant the way JSON writes it', () => {
    // `Date.prototype.toJSON` answers `null` for a date it cannot represent,
    // so an unparseable `Date` and a literal `null` carry one text. The
    // `number:` tag keeps `NaN` apart from `null` and this value reaches
    // neither branch. `instantText` at `rule-id.ts:16-22` reads a window
    // boundary through the epoch rather than through this function for that
    // reason.
    expect(canonical(new Date(Number.NaN))).toBe('null');
    expect(canonical(new Date(Number.NaN))).toBe(canonical(null));
  });

  it('separates undefined from the string that spells its text', () => {
    expect(canonical(undefined)).not.toBe(canonical('undefined'));
  });

  it('writes a Map as the empty object its entries are not members of', () => {
    // `AttributeCondition.value` is `unknown`, so a Map reaches here.
    // `Object.entries` reads none of its pairs, which is what `JSON.stringify`
    // does with one too, so two Maps holding different pairs carry one text
    // and two rules matching on them derive one id. `evaluateCondition`
    // compares with `===`, so neither rule matches a context that did not
    // carry that same object, and `ruleIdErrors` reports the pair as
    // `duplicate-rule-id` where they sit on one feature.
    expect(canonical(new Map([['a', 1]]))).toBe('{}');
    expect(canonical(new Map([['a', 1]]))).toBe(canonical(new Map()));
  });

  it('meets the string ceiling at the depth JSON.stringify meets it', () => {
    // A fat leaf reaches the ceiling three levels down, so the walk allocates
    // the host's longest string once and no 25-level diamond is built. The
    // depth is read off `JSON.stringify` and not written down here, because
    // the ceiling is the host's number: a document too deep to digest is a
    // document too deep to serve, and the two walks agree on which one that
    // is.
    const leaf = { depth: 'x'.repeat(2 ** 26) };
    let held: object = leaf;
    let threw = false;
    for (let level = 0; level < 8 && !threw; level += 1) {
      held = { l: held, r: held };
      try {
        JSON.stringify(held);
      } catch {
        threw = true;
      }
    }

    expect(threw).toBe(true);
    expect(() => canonical(held)).toThrow(RangeError);
  });
});

describe('canonicalDocument', () => {
  it('writes a non-finite number the way JSON carries it', () => {
    expect(canonicalDocument(Number.NaN)).toBe('null');
    expect(canonicalDocument(Number.POSITIVE_INFINITY)).toBe('null');
    expect(canonicalDocument(Number.NEGATIVE_INFINITY)).toBe('null');
  });

  it('agrees between an overflowing literal and the null one JSON hop writes', () => {
    // JSON's number grammar accepts any exponent, so a holder that parses
    // `1e999` holds `Infinity` and a holder that round-tripped the same bytes
    // through `JSON.stringify` holds `null`. `configDigest` compares those two
    // holders, and the `number:` tag would have them disagree over one served
    // document.
    const parsed = JSON.parse('{"maxStale":1e999}') as unknown;
    const cached = JSON.parse(JSON.stringify(parsed)) as unknown;

    expect(canonicalDocument(parsed)).toBe('{"maxStale":null}');
    expect(canonicalDocument(cached)).toBe(canonicalDocument(parsed));
  });

  it('writes every other value the way canonical writes it', () => {
    const value = {
      b: 1e21,
      a: [new Date(0), 'a\tb', null, 10n],
      c: { d: undefined, e: -0 },
    };

    expect(canonicalDocument(value)).toBe(canonical(value));
  });

  it('separates NaN from the string that spells the text JSON writes', () => {
    expect(canonicalDocument(Number.NaN)).not.toBe(canonicalDocument('null'));
  });
});
