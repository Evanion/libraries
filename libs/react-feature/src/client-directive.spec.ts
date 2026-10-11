import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/**
 * The `'use client'` directive on the entry, which is why this package exists.
 *
 * A directive holds only as the module's first statement. An import line or a
 * re-export moved above it turns it into a string expression the bundler
 * copies and React never reads, and the failure surfaces in a consumer's
 * Next.js build as `createContext is not a function` on the server -- nothing
 * in this package's own suite renders in an RSC pass, so no case here would
 * notice.
 *
 * The core must carry none, and that half is asserted where the core's files
 * are: `@evanion/feature` is emitted file-per-file, so the rule is about every
 * module under its `src` and not about its entry, and
 * `libs/feature/src/lib/core-boundary.spec.ts` already walks that tree.
 *
 * Read with the parser, not the text: `src/index.tsx`'s own docblock writes
 * `'use client'` in prose two lines below the directive, and a scan over raw
 * text passes a file that kept the sentence and lost the statement.
 */

const ENTRY = join(import.meta.dirname, 'index.tsx');
const HYDRATE = join(import.meta.dirname, 'hydrate.ts');

function parse(file: string, text: string): ts.SourceFile {
  return ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

/**
 * The directive a module opens with, or `undefined` for one that opens with
 * code.
 *
 * A plain string literal and nothing else. A template literal with nothing
 * substituted into it reads the same to a human and is an expression at
 * runtime, so `isStringLiteral` is the predicate and not `isStringLiteralLike`.
 */
function leadingDirective(source: ts.SourceFile): string | undefined {
  const first = source.statements[0];
  if (first === undefined) return undefined;
  if (!ts.isExpressionStatement(first)) return undefined;
  if (!ts.isStringLiteral(first.expression)) return undefined;
  return first.expression.text;
}

function directiveOf(file: string): string | undefined {
  return leadingDirective(parse(file, readFileSync(file, 'utf8')));
}

describe('the directive the published modules carry', () => {
  it('opens the adapter entry with use client', () => {
    expect(directiveOf(ENTRY)).toBe('use client');
  });

  it('opens hydrate.ts with no directive, because the entry carries the one', () => {
    // The bundle is one module and the entry is its first statement, so a
    // second directive here would state the same thing in a place a consumer
    // importing the entry never reaches.
    expect(directiveOf(HYDRATE)).toBeUndefined();
  });
});

describe('the directive the reader reports', () => {
  const read = (...lines: readonly string[]): string | undefined =>
    leadingDirective(parse('index.tsx', lines.join('\n')));

  it('reads a single-quoted directive', () => {
    expect(read("'use client';", "import { useMemo } from 'react';")).toBe(
      'use client',
    );
  });

  it('reads a double-quoted directive, which is the same statement', () => {
    expect(read('"use client";')).toBe('use client');
  });

  it('reads a directive a docblock sits under', () => {
    expect(
      read("'use client';", '', '/** The adapter. */', 'export const a = 1;'),
    ).toBe('use client');
  });

  it('reads no directive from a module whose first statement is an import', () => {
    // The regression this file is for. The string is still in the file and
    // React never reads it.
    expect(
      read("import { useMemo } from 'react';", "'use client';"),
    ).toBeUndefined();
  });

  it('reads no directive from a module whose first statement is a re-export', () => {
    expect(
      read("export type { ReactNode } from 'react';", "'use client';"),
    ).toBeUndefined();
  });

  it('reads no directive from a docblock that writes the words', () => {
    expect(
      read(
        "/** `'use client'` is a per-module directive. */",
        'export const a = 1;',
      ),
    ).toBeUndefined();
  });

  it('reads no directive from a template literal, which is an expression', () => {
    expect(read('`use client`;')).toBeUndefined();
  });

  it('reads no directive from an empty module', () => {
    expect(read('')).toBeUndefined();
  });

  it('reads the directive a module states and not the one it means to', () => {
    expect(read("'use server';")).toBe('use server');
  });
});
