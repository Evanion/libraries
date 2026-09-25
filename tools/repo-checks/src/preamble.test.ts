import { describe, expect, it } from 'vitest';

import { withPreamble, writesOwnImports } from '@evanion/doc-examples';

/**
 * The preamble is what a README block stands on when it imports nothing, and
 * the docs app's region loader has to put the same lines in front of a block
 * that the doctest run does, or a fence compiles against names it never ran
 * with.
 */

const preamble = "import { URN } from '@evanion/urn';\n";

describe('withPreamble', () => {
  it('puts the preamble behind a cut in front of a block that imports nothing', () => {
    expect(withPreamble(preamble, "URN.parse('urn:game:azul');")).toBe(
      `${preamble}// ---cut---\nURN.parse('urn:game:azul');`,
    );
  });

  it('leaves a block that imports a value to its own imports', () => {
    const code =
      "import { URN } from '@evanion/urn';\nURN.parse('urn:game:azul');";

    expect(withPreamble(preamble, code)).toBe(code);
  });

  it('keeps the preamble for a block that imports only a type', () => {
    const code =
      "import type { Parsed } from '@evanion/urn';\nlet parsed: Parsed;";

    expect(withPreamble(preamble, code)).toBe(
      `${preamble}// ---cut---\n${code}`,
    );
  });

  it('returns the block unchanged where the package has no preamble', () => {
    expect(withPreamble('', 'const a = 1;')).toBe('const a = 1;');
  });
});

describe('writesOwnImports', () => {
  it.each([
    ["import { URN } from '@evanion/urn';", true],
    ["import * as React from 'react';", true],
    ["import React from 'react';", true],
    ["import{ URN } from '@evanion/urn';", true],
    ["import type { Parsed } from '@evanion/urn';", false],
    ["import type{ Parsed } from '@evanion/urn';", false],
    ["import typeset from 'typeset';", true],
    ["const imported = 'import { URN }';", false],
  ])('reads %j as %s', (code, expected) => {
    expect(writesOwnImports(code)).toBe(expected);
  });
});
