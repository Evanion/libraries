import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { readValueClaim } from '@evanion/doc-examples/claims';
import { readRegion } from '@evanion/doc-examples/regions';

import type { Probe } from './probe';

/**
 * What ties a probe to the example the page renders above it.
 *
 * The README block is executed by Vitest, because it always was. The page
 * renders that block, because the region loader fills it and a missing region
 * fails `next build`. This module supplies the third leg: the probe's opening
 * argument is read out of the same block at build time, and
 * `tested-region.test.ts` holds the probe's output to every value the block
 * claims.
 *
 * Build-time only. It reads the filesystem, and nothing here is reachable from
 * a client component.
 */

/**
 * The repository root, found by walking up from the working directory.
 *
 * `next build` runs in the app directory and `vitest` runs where its config
 * is, so neither one's cwd is the root the READMEs are addressed from. The
 * marker is `nx.json`, which exists only at the root.
 */
function workspaceRoot(): string {
  let at = process.cwd();

  for (;;) {
    try {
      readFileSync(join(at, 'nx.json'));
      return at;
    } catch {
      const up = dirname(at);
      if (up === at) throw new Error(`no nx.json above ${process.cwd()}`);
      at = up;
    }
  }
}

/** The code of the README block a probe points at. */
export function regionOf(probe: Probe): string {
  const path = join(workspaceRoot(), probe.region.file);

  return readRegion(
    readFileSync(path, 'utf8'),
    probe.region.file,
    probe.region.name,
  ).code;
}

/** A claim the probe reproduces: the argument it was called with, and the value. */
export interface ProbeClaim {
  /** The argument, read out of the call the README wrote. */
  input: string;
  /** The value the README claims, as source text. */
  claimed: string;
}

/** A single-quoted or double-quoted string literal, and nothing else. */
const STRING_LITERAL = /^(?:'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")$/;

/** The escapes a documented argument can carry. */
const UNESCAPED: Record<string, string> = {
  n: '\n',
  r: '\r',
  t: '\t',
};

/**
 * The value of a string literal.
 *
 * Read character by character rather than evaluated: this runs over README
 * text during `next build`, and a scanner cannot be talked into running
 * something that is not a string.
 */
function valueOf(literal: string): string {
  const body = literal.slice(1, -1);
  let value = '';

  for (let i = 0; i < body.length; i++) {
    const char = body[i] as string;
    if (char !== '\\') {
      value += char;
      continue;
    }
    const escaped = body[++i] as string;
    value += UNESCAPED[escaped] ?? escaped;
  }

  return value;
}

/**
 * The leading string argument of `f(x, …)`, when the call opens with one.
 *
 * Only the first argument is read, because only the first is what a probe
 * makes editable: `inRollout(customerId, 10, 'new-checkout')` holds the
 * percentage and the flag key fixed and hands the reader the customer id. The
 * rest of the list is not parsed and does not need to be — `claimsOf` renders
 * the value it found back through `probe.source` and keeps the line only when
 * the result is the call the README wrote, character for character, so a probe
 * pointed at a call the region does not make still finds nothing.
 */
function leadingStringArgument(statement: string): string | null {
  const call = statement.match(/^[\w.]+\((.*)\)$/s);
  if (!call) return null;

  const args = call[1] as string;
  const first = args.match(/^(?:'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")/);

  if (!first || !STRING_LITERAL.test(first[0])) return null;

  const rest = args.slice(first[0].length);
  if (rest !== '' && !rest.startsWith(',')) return null;

  return valueOf(first[0]);
}

/**
 * Every claim in `code` that the probe's own call reproduces.
 *
 * A line qualifies when rendering its argument back through `probe.source`
 * gives the expression the README wrote, character for character. That is the
 * tie: a probe pointed at a call the region does not make finds nothing, and
 * both callers below fail rather than seeding from, or checking against, an
 * example the page never shows.
 */
export function claimsOf(probe: Probe, code: string): ProbeClaim[] {
  return code.split('\n').flatMap((line) => {
    const claim = readValueClaim(line);
    if (claim === null) return [];

    const input = leadingStringArgument(claim.statement);
    if (input === null || probe.source(input) !== claim.statement) return [];

    return [{ input, claimed: claim.expected }];
  });
}

/** The argument the region's first such call makes, which the probe opens on. */
export function seedOf(probe: Probe): string {
  const claims = claimsOf(probe, regionOf(probe));
  const first = claims[0];

  if (first === undefined) {
    throw new Error(
      `${probe.region.file} region '${probe.region.name}' makes no call this ` +
        `probe reproduces. The probe writes ${probe.source('x')}.`,
    );
  }

  return first.input;
}
