import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { workspaceRoot } from '@nx/devkit';
import { describe, expect, it } from 'vitest';

/**
 * G12 of `docs/specs/2026-09-25-documentation-standard.md` § 2 and § 3: the
 * install command belongs to stage 2 and to nothing else.
 *
 * § 2 gives the Overview the hook, the mental model, the vocabulary, the
 * capability map and the boundary, and states that it carries no install command
 * and no configuration. § 3 gives `getting-started.mdx` the prerequisites, the
 * install command, the minimum configuration that runs and one result the reader
 * sees. So the command is the one part of the stage boundary a grep can decide,
 * and the two directions are one rule read twice: an Overview carrying an
 * install is turning into a Setup page, and a Setup page carrying none is not
 * stage 2.
 *
 * Only a shell fence is read. An `index.mdx` naming a package in prose --
 * "install `@evanion/acl` and the policy is the same object on both sides" -- is
 * telling a reader what the package is, which § 2 asks it to do. The instruction
 * is the fenced command a reader copies, so that is what this counts.
 *
 * **`WorkshopNotice` is not a violation.** It renders `npm install <package>`
 * itself, out of `apps/docs/app/navigation.ts`, on every page of an unpublished
 * package. This guard reads the `.mdx` source and never sees it, which is
 * correct twice over: the notice is page furniture about the repository rather
 * than an instruction the page gives, and a guard that failed every Overview of
 * every unpublished package would be measuring the component instead of the
 * page.
 *
 * `doc-stage-allowance.json` is the ratchet, on `doc-floor-allowance.json`'s
 * list-valued shape: a section records the roles that break the boundary today,
 * the guard fails on anything not recorded, and an entry is removed rather than
 * edited once the page is moved to its stage. It starts at five sections and
 * seven roles, which § 14 tables. `astro-widget` and `nestjs-correlation-id`
 * break it in both directions at once, carrying the command on the Overview and
 * omitting it from the Setup article, and § 15 step 5 is where the ratchet
 * empties.
 */

const CONTENT = join(workspaceRoot, 'apps/docs/content');
const ALLOWANCE = join(
  dirname(fileURLToPath(import.meta.url)),
  'doc-stage-allowance.json',
);

const allowance = JSON.parse(readFileSync(ALLOWANCE, 'utf8')) as Record<
  string,
  string[]
>;

/** A command line is a command line, the same list `doc-fence.test.ts` holds. */
const SHELL = ['bash', 'sh', 'shell', 'console'];

/**
 * The install spellings § 14 names.
 *
 * `npm i` carries the trailing space that separates it from `npm init`.
 */
const INSTALL = ['npm install', 'npm i ', 'yarn add', 'pnpm add', 'bun add'];

function mdxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return mdxFiles(path);
    return entry.name.endsWith('.mdx') ? [path] : [];
  });
}

/** The pages whose filename gives them a role, as paths. */
function pagesNamed(role: string): string[] {
  return mdxFiles(CONTENT).filter((page) => page.endsWith(`${sep}${role}.mdx`));
}

/** The section a page belongs to: the first segment under `content/`. */
function sectionOf(page: string): string {
  return relative(CONTENT, page).split(sep)[0] as string;
}

/**
 * The body of every shell fence in one document.
 *
 * The same scan `doc-fence.test.ts` walks: a fence closes on a marker at least
 * as wide as the one that opened it, so a fence quoting a fence is one block.
 */
function shellBlocks(source: string): string[] {
  const blocks: string[] = [];
  let open: string | null = null;
  let shell = false;
  let held: string[] = [];

  for (const line of source.split('\n')) {
    const marker = line.match(/^\s*(`{3,})(.*)$/);

    if (marker === null) {
      if (shell) held.push(line);
      continue;
    }

    if (open === null) {
      open = marker[1] as string;
      const info = (marker[2] as string).trim();
      shell = SHELL.includes(info.split(/\s+/)[0] ?? '');
      held = [];
      continue;
    }

    if ((marker[1] as string).startsWith(open)) {
      if (shell) blocks.push(held.join('\n'));
      open = null;
      shell = false;
      held = [];
    }
  }

  return blocks;
}

/** Whether the page tells a reader to install something, in a shell fence. */
function installs(page: string): boolean {
  return shellBlocks(readFileSync(page, 'utf8')).some((block) =>
    INSTALL.some((command) => block.includes(command)),
  );
}

/**
 * The sections breaking the boundary, as `<slug>: <role>`.
 *
 * One scan for both directions, so the ratchet's two tests and the stale-entry
 * test read the same set rather than each deciding the rule again.
 */
function offStage(): string[] {
  return [
    ...pagesNamed('index')
      .filter((page) => installs(page))
      .map((page) => `${sectionOf(page)}: index`),
    ...pagesNamed('getting-started')
      .filter((page) => !installs(page))
      .map((page) => `${sectionOf(page)}: getting-started`),
  ];
}

describe('the stage boundary', () => {
  it('finds the pages that carry a role in their filename', () => {
    expect(pagesNamed('index').length).toBeGreaterThan(0);
    expect(pagesNamed('getting-started').length).toBeGreaterThan(0);
  });

  it('puts the install command on the stage that owns it', () => {
    const unrecorded = offStage().filter((entry) => {
      const [section, role] = entry.split(': ') as [string, string];
      return !(allowance[section] ?? []).includes(role);
    });

    expect(
      unrecorded.sort(),
      'An `index.mdx` is stage 1 under documentation standard § 2: it builds ' +
        'the mental model and carries no install command and no ' +
        'configuration. A `getting-started.mdx` is stage 2 under § 3 and ' +
        'carries the command. Move the fence to the getting-started page, or ' +
        'record the page in doc-stage-allowance.json.',
    ).toEqual([]);
  });

  it('records no page that now sits on its stage', () => {
    const wrong = new Set(offStage());
    const stale: string[] = [];

    for (const [section, roles] of Object.entries(allowance)) {
      for (const role of roles) {
        if (!wrong.has(`${section}: ${role}`))
          stale.push(`${section}: ${role}`);
      }
    }

    expect(
      stale.sort(),
      'These are recorded in doc-stage-allowance.json and the page now sits ' +
        'on its stage. Remove the entry, so a page that crosses the boundary ' +
        'again has to be argued for rather than staying quietly allowed.',
    ).toEqual([]);
  });

  it('reads the command out of a shell fence and not out of prose', () => {
    const prose = ['Run `npm install @evanion/acl` to get it.', ''].join('\n');
    const fenced = ['```bash', 'npm install @evanion/acl', '```'].join('\n');

    expect(shellBlocks(prose)).toEqual([]);
    expect(shellBlocks(fenced)).toEqual(['npm install @evanion/acl']);
  });
});
