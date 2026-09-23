import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { workspaceRoot } from '@nx/devkit';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/**
 * An `it` title states a behaviour the library has, in the indicative.
 *
 * `docs/specs/2026-09-22-docs-tests-per-export.md` renders the behaviour
 * catalogue on each API reference entry from these titles, so a title is the
 * sentence a reader meets under the export. `refuses a key the document never
 * held` reads as something the library does. `should refuse a key the document
 * never held` reads as a task nobody finished.
 *
 * Two rules, both read off the first word.
 *
 * A title does not open with `should`, `will`, `must` or `can`. A modal puts
 * the sentence in the future or the obligatory, which is the mood of a
 * specification rather than of a record of what ran.
 *
 * A title starts lower-case, unless it opens with two capitals. Title Case
 * turns the sentence into a heading, and a heading does not continue the
 * `describe` chain it hangs under. The two-capital opening is the acronym used
 * as a verb, which `@evanion/feature` carries three times: `ORs the rules: one
 * matching rule is enough`.
 *
 * What the rules do not ask, and why. A title starting with a third-person verb
 * is the stronger rule and is refused here: 435 of the 1739 titles in the
 * workspace would fail it, and they are the model, not the debt. `deny wins
 * over a concurrent allow`, `a document with no version and no schema omits
 * both keys` and `cannot turn a conditional rule into an unconditional one`
 * each lead with the subject the sentence is about. A rule that the title is a
 * full sentence cannot be stated precisely enough to check.
 *
 * This fails rather than reports. The change that adopted these rules left no
 * debt behind it, and a ratchet holding nothing is a ratchet nobody maintains.
 *
 * `describe` titles are not read. `doc-behaviour.test.ts` holds those against
 * the export names they attribute a case to, which is a different rule with a
 * different shape of name.
 */

/** Where test sources live. */
const ROOTS = ['libs', 'tools', 'apps', 'internal'];

/** A file the rules are read from. */
const TEST_FILE = /\.(test|spec)\.[cm]?[jt]sx?$/;

/** The moods a title may not open in. */
const MODALS = new Set(['should', 'will', 'must', 'can']);

/**
 * Titles the repository accepts, each with its reason.
 *
 * Kept inline on `doc-behaviour.test.ts`'s reading: a name here is a decision
 * that the rule does not apply, not a debt somebody intends to pay, and a
 * reason a reader meets beside the rule is likelier to be argued with than one
 * in a JSON list.
 */
const ACCEPTED: Readonly<Record<string, string>> = {
  'libs/acl/src/hydrate-policy.test.ts: can evaluates a single decision':
    '`can` is the method the case is about, not a modal. It is the subject of ' +
    'the sentence, the way `canMany` and `canFields` are the subjects of the ' +
    'sibling titles, and the verb that follows it is already indicative.',
};

/** Every test source under the workspace. */
function testFiles(): string[] {
  function walk(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      if (entry.name === 'node_modules' || entry.name === 'dist') return [];
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return walk(path);
      return TEST_FILE.test(entry.name) ? [path] : [];
    });
  }

  return ROOTS.flatMap((root) => walk(join(workspaceRoot, root)));
}

/**
 * The literal title of an `it` or `test` call, where it has one.
 *
 * A template title is read from its head, so `` `seed ${n}` `` is judged on
 * `seed`. A title that opens with an interpolation has no first word to judge
 * and returns null.
 */
function titleOf(node: ts.CallExpression): string | null {
  let callee = node.expression;
  while (ts.isPropertyAccessExpression(callee) || ts.isCallExpression(callee)) {
    callee = callee.expression;
  }
  if (!ts.isIdentifier(callee)) return null;
  if (callee.text !== 'it' && callee.text !== 'test') return null;

  const [first] = node.arguments;
  if (!first) return null;
  if (ts.isStringLiteralLike(first)) return first.text;
  if (ts.isTemplateExpression(first)) {
    return first.head.text === '' ? null : first.head.text;
  }
  return null;
}

/** Every `it` title a file carries, with the line it sits on. */
function titlesIn(path: string): { line: number; title: string }[] {
  const source = ts.createSourceFile(
    path,
    readFileSync(path, 'utf8'),
    ts.ScriptTarget.ESNext,
    true,
    path.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const found: { line: number; title: string }[] = [];

  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node)) {
      const title = titleOf(node);
      if (title !== null) {
        found.push({
          line: source.getLineAndCharacterOfPosition(node.getStart(source))
            .line,
          title,
        });
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(source);
  return found;
}

/** Why a title breaks a rule, or null when it keeps both. */
function faultOf(title: string): string | null {
  const [word = ''] = title.split(/[^\p{L}\p{N}'-]/u);

  if (MODALS.has(word.toLowerCase())) {
    return `opens in the "${word}" mood -- say what the code does`;
  }
  if (/^\p{Lu}/u.test(title) && !/^\p{Lu}\p{Lu}/u.test(title)) {
    return 'starts upper-case -- a title continues its describe chain';
  }
  return null;
}

describe('a test title', () => {
  it('states a behaviour rather than asking for one', () => {
    const found: string[] = [];

    for (const path of testFiles()) {
      const relative = path.slice(workspaceRoot.length + 1);

      for (const { line, title } of titlesIn(path)) {
        const fault = faultOf(title);
        if (fault === null) continue;
        if (`${relative}: ${title}` in ACCEPTED) continue;
        found.push(`${relative}:${line + 1}: "${title}" -- ${fault}`);
      }
    }

    expect(found.sort()).toEqual([]);
  });

  it('is accepted by name only where a reason is written down', () => {
    const live = new Set(
      testFiles().flatMap((path) => {
        const relative = path.slice(workspaceRoot.length + 1);
        return titlesIn(path)
          .filter(({ title }) => faultOf(title) !== null)
          .map(({ title }) => `${relative}: ${title}`);
      }),
    );

    expect(
      Object.keys(ACCEPTED).filter((name) => !live.has(name)),
      'An accepted title that no longer breaks a rule is an exemption with ' +
        'nothing behind it. Delete the entry.',
    ).toEqual([]);
  });
});
