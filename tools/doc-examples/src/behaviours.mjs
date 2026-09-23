import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import ts from 'typescript';

/**
 * What a package's tests state, read from their sources.
 *
 * A reference entry lists the sentences the suite carries about the export it
 * heads, and attribution is stated rather than inferred: a case belongs to an
 * export when a `describe` in its chain spells that name exactly. So this reads
 * chains, not references and not coverage. `ruleId`'s lines are executed by 19
 * of `@evanion/acl`'s test files and named by 3, and only the `describe` says
 * what the author meant the case to be about.
 *
 * Read from the sources rather than from a run, because the reference pages
 * build without running a test: `next build` expands a directive and a 20-second
 * sweep behind a page's rebuild buys nothing. `doc-behaviour-run.test.ts` holds
 * what this reads against what a run reports, so a sentence on the page is a
 * sentence that ran.
 *
 * Two readers take what this produces. `apps/docs/tools/behaviour-data.mjs`
 * writes it out for the reference loader, and `doc-behaviour.test.ts` asks it
 * which names a package's `describe` blocks spell.
 */

/** A file the convention is read from. */
const TEST_FILE = /\.(test|spec)\.tsx?$/;

/** Where the adversarial suite lives, relative to a package root. */
const SECURITY = join('src', 'security');

/**
 * Every test source under a package, with the adversarial suite left out.
 *
 * `libs/acl/src/security` names its blocks after register entries, `SEC-007 a
 * narrowed write never carries a prototype setter (CWE-1321)`, and
 * `security-register.test.ts` holds the register, the suite and the published
 * page together on that identifier while `SECURITY.md`'s tier decides what a
 * test there may claim. Those titles are a register's language and not a
 * sentence about an export, so nothing here reads them.
 */
export function testFilesOf(packageRoot) {
  const security = join(packageRoot, SECURITY);

  function walk(dir) {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return path === security ? [] : walk(path);
      return TEST_FILE.test(entry.name) ? [path] : [];
    });
  }

  return walk(join(packageRoot, 'src')).sort();
}

/** The runners a chain is built from, and the ones a case is recorded from. */
const SUITES = new Set(['describe', 'suite']);
const CASES = new Set(['it', 'test']);

/** Modifiers that mean the runner never gets to the case. */
const UNRUN = new Set(['skip', 'todo']);

/** Modifiers that mean the title is computed per row rather than written. */
const SEEDED = new Set(['each', 'for']);

/**
 * What a call is, for a call that runs something.
 *
 * `it.each(SEEDS)('seed %i', …)` arrives as a call of a call, and
 * `describe.skip('…', …)` as a call on a property, so the runner's own name is
 * the leftmost identifier and every property between it and the argument list
 * is a modifier this has to read.
 */
function runnerOf(node) {
  const modifiers = [];
  let current = node.expression;

  for (;;) {
    if (ts.isCallExpression(current)) {
      current = current.expression;
      continue;
    }
    if (ts.isPropertyAccessExpression(current)) {
      modifiers.push(current.name.text);
      current = current.expression;
      continue;
    }
    if (ts.isTaggedTemplateExpression(current)) {
      current = current.tag;
      continue;
    }
    break;
  }

  if (!ts.isIdentifier(current)) return null;

  const name = current.text;
  if (!SUITES.has(name) && !CASES.has(name)) return null;

  return {
    suite: SUITES.has(name),
    unrun: modifiers.some((each) => UNRUN.has(each)),
    seeded: modifiers.some((each) => SEEDED.has(each)),
  };
}

/** The literal title a call was given, where it was given one. */
function titleOf(node) {
  const [first] = node.arguments;
  if (!first) return null;
  return ts.isStringLiteralLike(first) ? first.text : null;
}

/**
 * Every chain a file states, outermost `describe` first.
 *
 * A generated case carries no sentence of its own. 450 of `@evanion/acl`'s
 * cases are `it.each` seeds titled `seed %i` under
 * `an overlay that matches nothing changes no decision`, and that `describe` is
 * already the statement the seeds are about, so the chain stops there and the
 * seeds collapse into it. A case whose own title is computed collapses the same
 * way, for the same reason.
 *
 * A `describe` with a computed title states nothing a reader can be shown, so
 * its cases are dropped rather than attached to a title nobody wrote. A skipped
 * case is dropped because the page may only carry a sentence a run produces.
 */
export function chainsOf(path) {
  const source = ts.createSourceFile(
    path,
    readFileSync(path, 'utf8'),
    ts.ScriptTarget.ESNext,
    true,
    /\.tsx$/.test(path) ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  const found = [];

  const visit = (node, chain) => {
    if (!ts.isCallExpression(node)) {
      ts.forEachChild(node, (child) => visit(child, chain));
      return;
    }

    const runner = runnerOf(node);
    if (runner === null || runner.unrun) {
      ts.forEachChild(node, (child) => visit(child, chain));
      return;
    }

    const title = titleOf(node);

    if (runner.suite) {
      // A seeded `describe` titles itself per row: `describe.each(INSTANCES)`
      // writes `over the %s instance` and the runner reports `over the URN
      // instance`. The title on the page would then be a format string no
      // runner ever produced, so the block and everything under it is dropped.
      const below = title === null || runner.seeded ? null : [...chain, title];
      ts.forEachChild(node, (child) => visit(child, below));
      return;
    }

    if (chain === null) return;
    if (runner.seeded || title === null) {
      if (chain.length > 0) found.push({ chain, generated: true });
      return;
    }

    found.push({ chain: [...chain, title], generated: false });
  };

  visit(source, []);

  return found;
}

/** One chain, as a key that tells two of them apart. */
const keyOf = (each) =>
  `${each.generated ? 'group' : 'case'}:${each.chain.join('\u0000')}`;

/**
 * What a package's tests state, keyed by the name each `describe` spells.
 *
 * Keyed by every `describe` title rather than by the package's export names,
 * because nothing here asks a compiler what a package exports. The reference
 * loader knows which export it is rendering and asks for that name, so the data
 * states what each block is about and the page decides whose entry it belongs
 * on. A case under `describe('hydratePolicy') > describe('canFields')` states
 * something about both and is keyed under both, which is what puts it on both
 * entries.
 */
export function behavioursOf(packageRoot) {
  const files = testFilesOf(packageRoot);
  const states = new Map();

  for (const path of files) {
    for (const each of chainsOf(path)) {
      for (const segment of each.chain) {
        const held = states.get(segment) ?? new Map();
        held.set(keyOf(each), each);
        states.set(segment, held);
      }
    }
  }

  return { files, states };
}

/** Every name a package's `describe` blocks spell, at any depth. */
export function describedBy(packageRoot) {
  return new Set(behavioursOf(packageRoot).states.keys());
}
