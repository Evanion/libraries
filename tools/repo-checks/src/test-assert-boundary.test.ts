import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { workspaceRoot } from '@nx/devkit';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { testFilesOf } from '@evanion/doc-examples/behaviours';

import { packages } from './released-exports.js';

/**
 * A case body puts a blank line in front of its first assertion.
 *
 * The behaviour catalogue on each API reference entry shows the case verbatim,
 * with nothing the file does not contain. A reader who opens a sentence there
 * meets the body as one paragraph of code, and the setup the case needed reads
 * like part of the claim it makes. The blank line is the one mark that tells
 * them where the arrangement stops and the assertion starts, and the renderer
 * may not add it, because a pane that inserts lines the source has not got is
 * showing the reader something else.
 *
 * So this holds the source to it. The boundary it checks is mechanical: the
 * first top-level statement of the case body whose expression tree contains a
 * call to `expect`. That statement carries a blank line above it unless it
 * opens the body, where there is nothing to separate it from.
 *
 * What it does not check. Test authors also separate the act from the
 * arrangement, and the act is a judgement: `const access = hydratePolicy(matrix)`
 * arranges in one case and acts in the next. A rule that guessed would fail
 * bodies whose author was right. The codemod that introduced this spacing placed
 * that second line where the enclosing `describe` chain named the call, and this
 * check leaves it alone.
 *
 * A body that opens with its assertion is exempt, because no arrangement stands
 * above it. 329 of the 923 case bodies in the libraries open that way and 584
 * carry the boundary. A body whose assertion shares a line with the statement
 * above it is skipped as well, since that line holds no blank line to give; the
 * libraries have none today.
 *
 * The files come from `@evanion/doc-examples/behaviours`, which is the reader
 * the catalogue renders from, so the check covers what a reader can open and
 * skips each package's `src/security` for the reason `behaviours.mjs` states.
 *
 * This fails rather than reports. The codemod left no case behind it, so an
 * allowance here would hold nothing and would let the next case skip the rule.
 */

/** The runners whose callbacks hold a case body. */
const CASES = new Set(['it', 'test']);

/** The leftmost identifier of a call, and every property name above it. */
function calleeNames(node: ts.CallExpression): string[] {
  const names: string[] = [];
  let current: ts.Node = node.expression;

  for (;;) {
    if (ts.isCallExpression(current)) {
      current = current.expression;
      continue;
    }
    if (ts.isPropertyAccessExpression(current)) {
      names.push(current.name.text);
      current = current.expression;
      continue;
    }
    if (ts.isTaggedTemplateExpression(current)) {
      current = current.tag;
      continue;
    }
    break;
  }

  if (ts.isIdentifier(current)) names.push(current.text);
  return names;
}

/** Whether a statement's expression tree calls `expect`. */
function asserts(node: ts.Node): boolean {
  let found = false;

  function visit(each: ts.Node): void {
    if (found) return;
    if (ts.isCallExpression(each) && calleeNames(each).includes('expect')) {
      found = true;
      return;
    }
    ts.forEachChild(each, visit);
  }

  visit(node);
  return found;
}

/**
 * The line a statement opens on, counting a comment written above it.
 *
 * A comment explaining an assertion belongs to it, so the blank line goes above
 * the comment and the check reads the boundary from there.
 */
function opensOn(
  source: ts.SourceFile,
  text: string,
  statement: ts.Statement,
): number {
  const comments = ts.getLeadingCommentRanges(text, statement.getFullStart());
  const at = comments?.[0]?.pos ?? statement.getStart(source);
  return source.getLineAndCharacterOfPosition(at).line;
}

/** Every case in a file whose first assertion has no blank line above it. */
function crowdedIn(path: string): { line: number; title: string }[] {
  const text = readFileSync(path, 'utf8');
  const source = ts.createSourceFile(
    path,
    text,
    ts.ScriptTarget.ESNext,
    true,
    path.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const found: { line: number; title: string }[] = [];

  function visit(node: ts.Node): void {
    ts.forEachChild(node, visit);
    if (!ts.isCallExpression(node)) return;

    const [name] = calleeNames(node).slice(-1);
    if (name === undefined || !CASES.has(name)) return;

    const callback = node.arguments.find(
      (each) => ts.isArrowFunction(each) || ts.isFunctionExpression(each),
    ) as ts.ArrowFunction | ts.FunctionExpression | undefined;
    if (!callback || !callback.body || !ts.isBlock(callback.body)) return;

    const statements = callback.body.statements;
    const at = statements.findIndex((each) => asserts(each));
    if (at < 1) return;

    const assertion = statements[at] as ts.Statement;
    const above = statements[at - 1] as ts.Statement;
    const opens = opensOn(source, text, assertion);
    const closes = source.getLineAndCharacterOfPosition(above.getEnd()).line;
    if (opens - closes !== 1) return;

    const [title] = node.arguments;
    found.push({
      line: opens + 1,
      title:
        title && ts.isStringLiteralLike(title)
          ? title.text
          : source
              .getText()
              .slice(node.getStart(source), node.getStart(source) + 40),
    });
  }

  visit(source);
  return found;
}

describe('a case body', () => {
  it('opens a blank line in front of its first assertion', async () => {
    const failures: string[] = [];

    for (const item of await packages()) {
      for (const path of testFilesOf(join(workspaceRoot, item.root))) {
        for (const { line, title } of crowdedIn(path)) {
          failures.push(
            `${relative(workspaceRoot, path)}:${line}: "${title}" asserts ` +
              `directly under its arrangement. Put one blank line above the ` +
              `first \`expect\`, so the catalogue shows a reader where the ` +
              `claim starts. No assertion moves.`,
          );
        }
      }
    }

    expect(failures.sort()).toEqual([]);
  });

  it('reads the cases the catalogue renders', async () => {
    const [item] = (await packages()).filter(
      (each) => each.name === '@evanion/acl',
    );

    expect(item).toBeDefined();

    const files = testFilesOf(join(workspaceRoot, item?.root ?? ''));

    expect(files.length).toBeGreaterThan(0);
    expect(
      crowdedIn(join(workspaceRoot, 'libs/acl/src/hydrate-policy.test.ts')),
    ).toEqual([]);
  });
});
