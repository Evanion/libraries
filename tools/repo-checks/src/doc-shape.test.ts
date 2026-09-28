import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { workspaceRoot } from '@nx/devkit';
import { describe, expect, it } from 'vitest';

/**
 * G13 of `docs/specs/2026-09-25-documentation-standard.md` § 7 and § 14: the
 * four shape rules that are counts.
 *
 * § 7 adopts four of the density study's decisions as numbers:
 *
 * | Rule          | Decision | Count                                          | Limit |
 * | ------------- | -------- | ---------------------------------------------- | ----- |
 * | `lede`        | 3        | prose words before the first `##`              | 40    |
 * | `run`         | 5        | the longest run of consecutive prose sentences | 8     |
 * | `firstFence`  | 6        | prose sentences before the first code fence    | 8     |
 * | `firstSymbol` | 7        | prose words before the first backticked span   | 25    |
 *
 * All four read one classification of the page, so this file carries the
 * classifier and the four counts over it. The classifier follows the counter in
 * `docs/specs/2026-09-20-documentation-density.md` § 1, because that counter
 * produced every number § 7 adopts, and a limit read with a different counter
 * is a different limit. Where this file departs from it, the constant or
 * function says so.
 *
 * A page is a sequence of blocks, each one of six kinds:
 *
 * - `heading`, a line opening on one to six `#`.
 * - `fence`, a fenced code block, or a `<!-- reference … -->` directive.
 * - `list`, a line opening on `-`, `*`, `+` or a number and a period, with its
 *   continuation lines.
 * - `table`, a line opening on `|`.
 * - `jsx`, a line holding JSX tags and no text outside them.
 * - `prose`, everything else, one block per paragraph. The text a JSX wrapper
 *   holds is prose: `<Panel>` and `<WorkshopNotice>` render their children as
 *   sentences a reader reads, and the counter stripped the tags and kept the
 *   text.
 *
 * § 7's "How the counts are taken" settles six counting questions, and this
 * file encodes each answer:
 *
 * 1. A list item's sentences count toward no rule. A list is structure, and
 *    `firstFence` counts prose sentences only.
 * 2. A JSX component such as `<DataDemo />` breaks a prose run.
 *    `JSX_BREAKS_RUN` holds the answer.
 * 3. The text a JSX wrapper such as `<Panel>` or `<WorkshopNotice>` holds is
 *    prose, and counts toward every rule.
 * 4. A shell fence is not the first fence. `NOT_FIRST_FENCE` lists the
 *    languages that are not code a reader reads: the shell languages, whose
 *    fence is an install command, and `mermaid`, which decision 6 excludes.
 * 5. A `<!-- reference … -->` directive is a fence. `mdx-reference-loader.mjs`
 *    expands every one into a `ts twoslash` signature fence before the page
 *    renders, so the reader meets code at that point. A `file=… region=…`
 *    fence is a fence like any other.
 * 6. An inline code span in the lede counts as words, one per
 *    whitespace-delimited token, as the counter's rule 3 counts every token
 *    carrying a letter or a digit.
 *
 * `doc-shape-allowance.json` is the ratchet, keyed by page and then by rule,
 * holding the count the page has today. A page over a limit fails unless the
 * allowance records that count or a higher one, and an entry fails as stale
 * once the page's count drops below it, so the allowance goes down one page at
 * a time and never absorbs a page getting worse.
 *
 * `firstSymbol` reads a backticked span in a JSX attribute as well. `<Panel
 * heading>` renders its string as the panel's `h2`, and five pages open a panel
 * on a symbol that way.
 *
 * What this does not reach: `mdx-reference-loader.mjs` also writes the
 * export's docblock summary above its signature fence, which is prose the
 * source never shows. The guard reads the `.mdx` source and counts the page an
 * author wrote.
 */

const CONTENT = join(workspaceRoot, 'apps/docs/content');
const ALLOWANCE = join(
  dirname(fileURLToPath(import.meta.url)),
  'doc-shape-allowance.json',
);

/** § 7's four numbers. */
const LIMITS = {
  lede: 40,
  run: 8,
  firstFence: 8,
  firstSymbol: 25,
} as const;

type Rule = keyof typeof LIMITS;

const RULES = Object.keys(LIMITS) as Rule[];

/**
 * Whether a JSX block ends a prose run.
 *
 * `true` is § 7's answer: `<DataDemo />` interrupts the text on the rendered
 * page, so it breaks a run the way a table does. Changing it is a change to
 * § 7 first.
 */
const JSX_BREAKS_RUN = true;

/**
 * Fence languages that are not the first fence.
 *
 * Decision 6 counts a fence that shows code a reader reads. A shell fence is
 * an install command and a `mermaid` fence is a diagram. Each still ends a
 * prose run, because decision 5's break is any code block.
 */
const NOT_FIRST_FENCE = new Set(['bash', 'sh', 'shell', 'console', 'mermaid']);

const allowance = JSON.parse(readFileSync(ALLOWANCE, 'utf8')) as Record<
  string,
  Partial<Record<Rule, number>>
>;

type Kind = 'heading' | 'fence' | 'list' | 'table' | 'jsx' | 'prose';

interface Block {
  kind: Kind;
  /**
   * The block's text with JSX tags removed. A fence carries its info string and
   * a `jsx` block its source.
   */
  text: string;
  /** A heading's level, 1 to 6. */
  level?: number;
}

const FENCE = /^\s*(`{3,}|~{3,})(.*)$/;
const REFERENCE = /^<!--\s*reference\s.*-->$/;
const HEADING = /^(#{1,6})\s/;
const LIST = /^\s*(?:[-*+]|\d+[.)])\s+/;
const TABLE = /^\s*\|/;
const ESM =
  /^(?:import\s.*\sfrom\s|import\s+['"]|export\s+(?:const|let|function|default|\{|\*))/;

/** Where a JSX tag scan stands between lines. */
interface TagState {
  /** Inside a tag whose `>` has not arrived yet. */
  open: boolean;
  /** Brace depth inside the open tag's attributes. */
  depth: number;
  /** The quote character an attribute string is open on, or null. */
  quote: string | null;
}

/**
 * The text of one line outside any JSX tag, carrying tag state across lines.
 *
 * A tag opens on `<` followed by a letter, `/` or `>`, and closes on the first
 * `>` outside an attribute string and outside `{…}`, so `unlocks={[…]}` and
 * `() => x` in an attribute do not close it. A backticked span is left whole:
 * `Array<string>` in inline code is a symbol, not a tag.
 */
function outsideTags(line: string, state: TagState): string {
  let text = '';
  let index = 0;

  while (index < line.length) {
    const char = line[index] as string;

    if (state.open) {
      if (state.quote !== null) {
        if (char === state.quote) state.quote = null;
      } else if (char === '"' || char === "'" || char === '`') {
        state.quote = char;
      } else if (char === '{') {
        state.depth += 1;
      } else if (char === '}') {
        state.depth -= 1;
      } else if (char === '>' && state.depth === 0) {
        state.open = false;
      }
      index += 1;
      continue;
    }

    if (char === '`') {
      const close = line.indexOf('`', index + 1);
      const end = close === -1 ? line.length : close + 1;
      text += line.slice(index, end);
      index = end;
      continue;
    }

    if (char === '<' && /[A-Za-z/>]/.test(line[index + 1] ?? '')) {
      state.open = true;
      state.depth = 0;
      state.quote = null;
      text += ' ';
      index += 1;
      continue;
    }

    text += char;
    index += 1;
  }

  return text;
}

/**
 * A page as the sequence of blocks § 7's rules read.
 *
 * HTML comments other than a reference directive, MDX `{/* … *\/}` comments
 * and ESM lines are dropped, the counter's rule 1. A list continues over a
 * blank line while the next line is indented, which is how a loose list keeps
 * a second paragraph inside an item.
 */
function classify(source: string): Block[] {
  const blocks: Block[] = [];
  const tag: TagState = { open: false, depth: 0, quote: null };
  let paragraph: string[] = [];
  let fence: string | null = null;
  let comment: 'html' | 'mdx' | null = null;
  let esm = false;
  let blank = true;

  function flush(): void {
    if (paragraph.length > 0)
      blocks.push({ kind: 'prose', text: paragraph.join(' ') });
    paragraph = [];
  }

  function push(kind: Kind, text: string): void {
    const last = blocks.at(-1);
    if (
      last !== undefined &&
      last.kind === kind &&
      (kind === 'list' || kind === 'table' || kind === 'jsx')
    ) {
      last.text += `\n${text}`;
      return;
    }
    blocks.push({ kind, text });
  }

  for (const line of source.split('\n')) {
    const trimmed = line.trim();

    if (fence !== null) {
      const marker = line.match(FENCE);
      if (
        marker !== null &&
        (marker[1] as string).startsWith(fence) &&
        (marker[2] as string).trim() === ''
      )
        fence = null;
      continue;
    }

    if (comment !== null) {
      if (trimmed.includes(comment === 'html' ? '-->' : '*/}')) comment = null;
      continue;
    }

    if (esm) {
      if (trimmed === '') esm = false;
      blank = trimmed === '';
      continue;
    }

    if (tag.open) {
      const text = outsideTags(line, tag);
      if (/[\p{L}\p{N}]/u.test(text)) {
        paragraph.push(text.trim());
      } else {
        flush();
        push('jsx', trimmed);
      }
      blank = false;
      continue;
    }

    if (trimmed === '') {
      flush();
      blank = true;
      continue;
    }

    const marker = line.match(FENCE);
    if (marker !== null) {
      flush();
      fence = marker[1] as string;
      blocks.push({ kind: 'fence', text: (marker[2] as string).trim() });
      blank = false;
      continue;
    }

    if (REFERENCE.test(trimmed)) {
      flush();
      blocks.push({ kind: 'fence', text: 'ts twoslash' });
      blank = false;
      continue;
    }

    if (trimmed.startsWith('<!--')) {
      if (!trimmed.includes('-->')) comment = 'html';
      continue;
    }

    if (trimmed.startsWith('{/*')) {
      if (!trimmed.includes('*/}')) comment = 'mdx';
      continue;
    }

    if (blank && ESM.test(line)) {
      flush();
      esm = true;
      continue;
    }

    const heading = line.match(HEADING);
    if (heading !== null) {
      flush();
      blocks.push({
        kind: 'heading',
        text: line.slice((heading[0] as string).length).trim(),
        level: (heading[1] as string).length,
      });
      blank = false;
      continue;
    }

    if (TABLE.test(line)) {
      flush();
      push('table', trimmed);
      blank = false;
      continue;
    }

    const last = blocks.at(-1);
    const inList =
      paragraph.length === 0 &&
      last?.kind === 'list' &&
      (!blank || /^\s/.test(line));

    if (LIST.test(line) || inList) {
      flush();
      push('list', outsideTags(line, tag).trim());
      blank = false;
      continue;
    }

    const text = outsideTags(line, tag);
    if (/[\p{L}\p{N}]/u.test(text)) {
      paragraph.push(text.trim());
    } else {
      flush();
      push('jsx', trimmed);
    }
    blank = false;
  }

  flush();
  return blocks;
}

/** A block's text as a reader reads it: link targets and emphasis markers gone. */
function readable(text: string): string {
  return text
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\*+/g, '')
    .replace(/(^|\s)_+|_+(?=\s|$|[.,;:!?])/g, '$1');
}

/**
 * Words in a prose block: whitespace-delimited tokens carrying a letter or a
 * digit, the counter's rule 3, with backticked spans counted like any token.
 */
function words(text: string): number {
  return readable(text)
    .split(/\s+/)
    .filter((token) => /[\p{L}\p{N}]/u.test(token)).length;
}

/** Stands in for a backticked span while sentences are split. */
const SPAN = '\u0001';

/**
 * Sentences in a prose block, the counter's rule 7.
 *
 * A boundary is `.`, `!` or `?`, any closing quote or bracket after it,
 * whitespace, and then a capital, a backticked span or an opening quote. A
 * span is replaced first, so `cookies()` and `a.b` do not split a sentence.
 * The end of the block ends its last sentence.
 */
function sentences(text: string): number {
  const flat = readable(text.replace(/`[^`]*`/g, `${SPAN}x`));

  return flat
    .split(new RegExp(`[.!?]["'”’)\\]]*\\s+(?=[\\p{Lu}${SPAN}"'“‘])`, 'u'))
    .filter((piece) => /[\p{L}\p{N}]/u.test(piece)).length;
}

type Shape = Record<Rule, number>;

/** § 7's four counts over one page's blocks. */
function measure(blocks: Block[]): Shape {
  let lede = 0;
  let ledeOpen = true;
  let run = 0;
  let longest = 0;
  let toFence = 0;
  let fenceSeen = false;
  let toSymbol = 0;
  let symbolSeen = false;

  for (const block of blocks) {
    if (block.kind === 'heading' && block.level === 2) ledeOpen = false;

    if (!symbolSeen && block.kind !== 'fence' && block.text.includes('`')) {
      if (block.kind === 'prose')
        toSymbol += words(block.text.slice(0, block.text.indexOf('`')));
      symbolSeen = true;
    } else if (!symbolSeen && block.kind === 'prose') {
      toSymbol += words(block.text);
    }

    if (
      block.kind === 'fence' &&
      !NOT_FIRST_FENCE.has(block.text.split(/\s+/)[0] as string)
    )
      fenceSeen = true;

    if (block.kind === 'prose') {
      const count = sentences(block.text);
      if (ledeOpen) lede += words(block.text);
      if (!fenceSeen) toFence += count;
      run += count;
      longest = Math.max(longest, run);
      continue;
    }

    if (block.kind !== 'jsx' || JSX_BREAKS_RUN) run = 0;
  }

  return { lede, run: longest, firstFence: toFence, firstSymbol: toSymbol };
}

function mdxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return mdxFiles(path);
    return entry.name.endsWith('.mdx') ? [path] : [];
  });
}

/** Every page under `content/`, keyed `<section>/<page>.mdx`. */
function pages(): Map<string, Shape> {
  return new Map(
    mdxFiles(CONTENT).map((page) => [
      relative(CONTENT, page).split(sep).join('/'),
      measure(classify(readFileSync(page, 'utf8'))),
    ]),
  );
}

describe('a page shape', () => {
  const measured = pages();

  it('is measured over every page', () => {
    expect(measured.size).toBeGreaterThan(0);
  });

  it('is held to § 7 or to the count its page records', () => {
    const over: string[] = [];

    for (const [page, shape] of measured) {
      for (const rule of RULES) {
        if (shape[rule] <= LIMITS[rule]) continue;

        const allowed = allowance[page]?.[rule];
        if (allowed === undefined || shape[rule] > allowed) {
          over.push(
            `${page}: ${rule} ${shape[rule]}, limit ${LIMITS[rule]}` +
              (allowed === undefined ? '' : `, allowance ${allowed}`),
          );
        }
      }
    }

    expect(
      over.sort(),
      'Documentation standard § 7: the lede is at most 40 prose words, no ' +
        'prose run exceeds 8 sentences, the first code fence arrives within 8 ' +
        'prose sentences, and the first backticked symbol within 25 prose ' +
        'words. Break a run with a table, a list or a fence, and cut the ' +
        'lede. The counts in tools/repo-checks/src/doc-shape-allowance.json ' +
        'only go down.',
    ).toEqual([]);
  });

  it('leaves no allowance larger than the page needs', () => {
    const slack: string[] = [];

    for (const [page, rules] of Object.entries(allowance)) {
      const shape = measured.get(page);

      if (shape === undefined) {
        slack.push(`${page}: no such page`);
        continue;
      }

      for (const [rule, allowed] of Object.entries(rules)) {
        if (!(rule in LIMITS)) {
          slack.push(`${page}: ${rule} is not a rule`);
          continue;
        }

        const count = shape[rule as Rule];
        if (count <= LIMITS[rule as Rule]) {
          slack.push(`${page}: ${rule} ${count} is within the limit`);
        } else if (count < (allowed as number)) {
          slack.push(`${page}: ${rule} ${count}, allowance ${allowed}`);
        }
      }
    }

    expect(
      slack.sort(),
      'Lower these in tools/repo-checks/src/doc-shape-allowance.json to the ' +
        'count the page now has, and remove a rule once the page meets it. An ' +
        'allowance above the real number is room the next edit can spend.',
    ).toEqual([]);
  });
});

describe('the block classifier', () => {
  const kinds = (source: string) => classify(source).map((block) => block.kind);

  it('reads a table cell as a table and not as prose', () => {
    const source = [
      '| Option | Meaning |',
      '| ------ | ------- |',
      '| `span` | Two columns wide. It stays on the wrapper. |',
    ].join('\n');

    expect(kinds(source)).toEqual(['table']);
    expect(measure(classify(source)).run).toBe(0);
  });

  it('reads a heading as a heading and not as prose', () => {
    const source = ['# The page', '', '## How it works'].join('\n');

    expect(kinds(source)).toEqual(['heading', 'heading']);
    expect(measure(classify(source)).lede).toBe(0);
  });

  it('ends a prose run at a list', () => {
    const source = [
      'One. Two. Three.',
      '',
      '- An item.',
      '  Its second line.',
      '',
      'Four. Five.',
    ].join('\n');

    expect(kinds(source)).toEqual(['prose', 'list', 'prose']);
    expect(measure(classify(source)).run).toBe(3);
  });

  it('reads a JSX component as JSX and not as prose', () => {
    const source = [
      '<PageSheet',
      '  difficulty={2}',
      "  unlocks={[['Getting started', '/widget/getting-started']]}",
      '/>',
      '',
      '<DataDemo />',
    ].join('\n');

    expect(kinds(source)).toEqual(['jsx']);
    expect(measure(classify(source)).lede).toBe(0);
  });

  it('reads the text a JSX wrapper holds as prose', () => {
    const source = [
      '<Panel heading="A decision in a browser enforces nothing">',
      '  <Text as="div" size="sm">',
      '    Every hook here toggles what a shopper sees. The server decides again.',
      '  </Text>',
      '</Panel>',
    ].join('\n');

    expect(kinds(source)).toEqual(['jsx', 'prose', 'jsx']);
    expect(measure(classify(source)).run).toBe(2);
  });

  it('ends a prose run at a JSX component', () => {
    const source = ['One. Two.', '', '<DataDemo />', '', 'Three.'].join('\n');

    expect(kinds(source)).toEqual(['prose', 'jsx', 'prose']);
    expect(measure(classify(source)).run).toBe(2);
  });

  it('counts the text a JSX wrapper holds toward the lede and the first fence', () => {
    const source = [
      '# Title',
      '',
      '<WorkshopNotice>',
      '  This page is a workshop. Read it in order.',
      '</WorkshopNotice>',
      '',
      '```ts',
      'go();',
      '```',
    ].join('\n');

    expect(measure(classify(source)).lede).toBe(9);
    expect(measure(classify(source)).firstFence).toBe(2);
  });

  it('does not take a shell fence for the first fence', () => {
    const source = [
      'Install it.',
      '',
      '```bash',
      'npm install @evanion/urn',
      '```',
      '',
      'Then parse. It returns a value.',
      '',
      '```ts',
      'parse();',
      '```',
    ].join('\n');

    expect(kinds(source)).toEqual(['prose', 'fence', 'prose', 'fence']);
    expect(measure(classify(source)).firstFence).toBe(3);
    expect(measure(classify(source)).run).toBe(2);
  });

  it('counts no list sentence toward the first fence', () => {
    const source = [
      'Install it.',
      '',
      '1. Add the package. Save the file.',
      '2. Run the build. Open the page.',
      '',
      '```ts',
      'go();',
      '```',
    ].join('\n');

    expect(measure(classify(source)).firstFence).toBe(1);
  });

  it('does not take a mermaid fence for the first fence', () => {
    const source = [
      'One.',
      '',
      '```mermaid',
      'graph LR',
      '```',
      '',
      'Two.',
      '',
      '```ts file=libs/urn/README.md region=parse',
      '```',
    ].join('\n');

    expect(kinds(source)).toEqual(['prose', 'fence', 'prose', 'fence']);
    expect(measure(classify(source)).firstFence).toBe(2);
    expect(measure(classify(source)).run).toBe(1);
  });

  it('takes a reference directive for a fence', () => {
    const source = [
      'One.',
      '',
      '<!-- reference @evanion/urn#URN example=basic-usage -->',
      '',
      'Two.',
    ].join('\n');

    expect(kinds(source)).toEqual(['prose', 'fence', 'prose']);
    expect(measure(classify(source)).firstFence).toBe(1);
  });

  it('counts a code span in the lede as a word', () => {
    const source = ['# Title', '', '`@evanion/widget` checks items.'].join(
      '\n',
    );

    expect(measure(classify(source)).lede).toBe(3);
  });

  it('counts the prose words before the first backticked span anywhere', () => {
    const source = [
      'Four words come first.',
      '',
      '## The `can` method',
      '',
      'More words.',
    ].join('\n');

    expect(measure(classify(source)).firstSymbol).toBe(4);
  });

  it('reads the symbol a panel heading names', () => {
    const source = [
      '<Panel heading="`unevaluable` is not `denied`">',
      '  <Text as="div" size="sm">',
      '    Nothing leaks.',
      '  </Text>',
      '</Panel>',
    ].join('\n');

    expect(measure(classify(source)).firstSymbol).toBe(0);
  });

  it('splits sentences at a capital and not inside a code span', () => {
    expect(
      sentences('Call `a.b()` first. Then `c. D` runs. `e` follows.'),
    ).toBe(3);
    expect(sentences('Version 2.3 is out. see below.')).toBe(1);
  });
});
