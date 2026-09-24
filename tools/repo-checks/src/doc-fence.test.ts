import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { workspaceRoot } from '@nx/devkit';
import { describe, expect, it } from 'vitest';

/**
 * G3 of `docs/specs/2026-09-25-documentation-standard.md` § 9 and § 14: no
 * unexplained fence.
 *
 * § 9 states the rule. A fence in `apps/docs/content/` is a `file=… region=…`
 * reference to a doctested region, a shell command, or a block carrying one of
 * five exemption tags, and a hand-written `ts` fence with none of the three is
 * a sample nothing ran and nothing says so.
 *
 * § 9 adds that there is no fourth case. Two constants below are fourth cases,
 * each with the tree that forced it written beside it: a `mermaid` fence, whose
 * spec landed after the rule was written, and a `twoslash` fence, which the pilot
 * section ships six of and which two compilers check.
 *
 * `doc-fence-allowance.json` is the ratchet, and `doc-control-allowance.json`
 * uses the same mechanism: a section carries the number of unexplained fences
 * it has today, and the guard fails when that number goes up. It runs down one
 * section at a time, because converting a fence means wiring doctest into
 * the package behind it rather than editing the page.
 *
 * Two things this reaches that a reader cannot:
 *
 * - The count per section, which is the ratchet.
 * - `anti-example` and `no-run` outnumbering the section's executed regions,
 *   which § 9 names as the abuse to expect: they are the two tags a writer
 *   reaches for when the alternative is wiring doctest into a package.
 *
 * What it does not reach: whether a region a fence cites shows what the prose
 * above it claims. `doc-regions.test.ts` holds the region to existing and
 * `doc-twoslash.test.ts` compiles it; that the two agree is a reading § 14
 * lists as the reviewer's.
 *
 * A fence carrying no info string at all -- the thrown error messages several
 * pages print -- is counted. It is not code, so none of the five tags fits it
 * honestly, and § 9's list is closed and not this guard's to extend. Counting
 * it keeps the number true and the ratchet absorbs it; a tag for output is a
 * change to the standard first.
 */

const CONTENT = join(workspaceRoot, 'apps/docs/content');
const ALLOWANCE = join(
  dirname(fileURLToPath(import.meta.url)),
  'doc-fence-allowance.json',
);

/** § 9's closed list of exemption tags, and nothing beside it. */
const TAGS = [
  'signature',
  'no-run',
  'anti-example',
  'fails-type-check',
  'elided',
];

/** The tags § 9 expects to be abused, and which this guard counts separately. */
const ABUSABLE = ['anti-example', 'no-run'];

/** A command line is a command line; nothing here pretends to run one. */
const SHELL = ['bash', 'sh', 'shell', 'console'];

/**
 * A `mermaid` fence is a diagram, not a code sample.
 *
 * `2026-09-16-diagrams.md` owns it, `diagram-captions.test.ts` holds it to a
 * caption, and `apps/docs/components/diagram/diagram.test.ts` renders every one
 * on the site. § 9's three cases were written before that spec shipped, and
 * asking a picture to name a region would be asking it to be a different thing.
 */
const DIAGRAM = 'mermaid';

/**
 * A `twoslash` fence is compiled, which § 9's three cases do not account for.
 *
 * § 9 says there is no fourth case, and the tree says otherwise: `compose` was
 * written to this standard and `compose/type-checking.mdx` carries six bare
 * `twoslash` fences, each declaring an `// @errors:` list. Nextra compiles them
 * during `next build` and `doc-twoslash.test.ts` compiles them again in
 * `nx test`, holding every declared code in both directions. They are the most
 * checked fences on the site, and counting them as unexplained would ask the
 * pilot section to stop compiling its examples.
 *
 * What it guarantees is narrower than a region's: the fence compiles, and where
 * it declares errors those errors are still produced. No value printed beside a
 * call was produced by running it. So a `twoslash` fence is a rung above a
 * static one and a rung below a doctested region, and where a page can cite a
 * region it still should.
 */
const COMPILED = 'twoslash';

const allowance = JSON.parse(readFileSync(ALLOWANCE, 'utf8')) as Record<
  string,
  number
>;

function mdxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return mdxFiles(path);
    return entry.name.endsWith('.mdx') ? [path] : [];
  });
}

/**
 * The info string of every fence in one document.
 *
 * The same scan `doc-twoslash.test.ts` walks: a fence closes on a marker at
 * least as wide as the one that opened it, so a fence quoting a fence is one
 * block and its inner markers are content.
 */
function fenceInfo(source: string): string[] {
  const info: string[] = [];
  let open: string | null = null;

  for (const line of source.split('\n')) {
    const marker = line.match(/^\s*(`{3,})(.*)$/);

    if (marker === null) continue;

    if (open === null) {
      open = marker[1] as string;
      info.push((marker[2] as string).trim());
      continue;
    }

    if ((marker[1] as string).startsWith(open)) open = null;
  }

  return info;
}

/** The section a page belongs to: the first segment under `content/`. */
function sectionOf(page: string): string {
  return relative(CONTENT, page).split(sep)[0] as string;
}

interface Tally {
  /** Fences with none of § 9's three cases. */
  unexplained: number;
  /** Fences citing a doctested region. */
  regions: number;
  /** Fences carrying `anti-example` or `no-run`. */
  abusable: number;
}

/** Every section under `content/`, with what its fences are. */
function tally(): Map<string, Tally> {
  const sections = new Map<string, Tally>();

  for (const page of mdxFiles(CONTENT)) {
    const section = sectionOf(page);
    const held = sections.get(section) ?? {
      unexplained: 0,
      regions: 0,
      abusable: 0,
    };

    for (const info of fenceInfo(readFileSync(page, 'utf8'))) {
      const words = info.split(/\s+/).filter(Boolean);
      const language = words[0] ?? '';

      if (info.includes('file=') && info.includes('region=')) {
        held.regions += 1;
        continue;
      }

      if (words.some((word) => ABUSABLE.includes(word))) held.abusable += 1;

      if (
        SHELL.includes(language) ||
        language === DIAGRAM ||
        words.includes(COMPILED) ||
        words.some((word) => TAGS.includes(word))
      ) {
        continue;
      }

      held.unexplained += 1;
    }

    sections.set(section, held);
  }

  return sections;
}

describe('an unexplained fence', () => {
  const sections = tally();

  it('is counted over every section', () => {
    expect(sections.size).toBeGreaterThan(0);
  });

  it('is held to the count its section records', () => {
    const risen: string[] = [];

    for (const [section, held] of sections) {
      const allowed = allowance[section] ?? 0;

      if (held.unexplained > allowed) {
        risen.push(
          `${section}: ${held.unexplained} unexplained fences, allowance ${allowed}`,
        );
      }
    }

    expect(
      risen.sort(),
      'A fence with no `file=… region=…`, no shell language and no exemption ' +
        'tag from documentation standard § 9 is a sample nothing ran. Cite a ' +
        'doctested region, or tag the block. The allowance in ' +
        'tools/repo-checks/src/doc-fence-allowance.json only goes down.',
    ).toEqual([]);
  });

  it('leaves no allowance larger than the section needs', () => {
    const slack: string[] = [];

    for (const [section, allowed] of Object.entries(allowance)) {
      const held = sections.get(section);

      if (held === undefined) {
        slack.push(`${section}: no such section`);
        continue;
      }

      if (held.unexplained < allowed) {
        slack.push(
          `${section}: ${held.unexplained} left, allowance ${allowed}`,
        );
      }
    }

    expect(
      slack.sort(),
      'Lower these in tools/repo-checks/src/doc-fence-allowance.json to the ' +
        'count the section now has, and remove the entry at zero. An ' +
        'allowance above the real number is room the next page can spend.',
    ).toEqual([]);
  });

  it('does not let a section explain itself entirely by exemption', () => {
    const lopsided: string[] = [];

    for (const [section, held] of sections) {
      if (held.abusable === 0) continue;

      if (held.abusable > held.regions) {
        lopsided.push(
          `${section}: ${held.abusable} tagged anti-example or no-run, ${held.regions} executed regions`,
        );
      }
    }

    expect(
      lopsided.sort(),
      '`anti-example` and `no-run` are the two tags a writer reaches for when ' +
        'the alternative is wiring doctest into the package, which is why ' +
        'documentation standard § 9 caps them at the number of regions the ' +
        'section actually executes. Wire the package.',
    ).toEqual([]);
  });
});
