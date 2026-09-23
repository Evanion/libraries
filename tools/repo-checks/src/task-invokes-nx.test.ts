import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { createProjectGraphAsync, workspaceRoot } from '@nx/devkit';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/**
 * No task a project configures starts a second Nx.
 *
 * Nx schedules a run against one project graph and refuses a nested process
 * that reaches a task the outer one has already started: `Recursive task
 * invocation detected`, and the run fails. `docs:testing-data` hit exactly
 * that. Its command was `node tools/test-statistics.mjs`, and the script called
 * `npx nx run-many --target=test --projects=libs/*` to produce the coverage the
 * `/testing` page counts. `nx run-many -t test --all` scheduled
 * `docs:testing-data` beside the eleven library suites, the script started them
 * a second time, and Nx refused the second start.
 *
 * It stayed hidden for as long as the library caches were warm, because a cache
 * hit on `testing-data` never ran the script, and for as long as the outer run
 * happened to reach the nested suites last. Raising `--parallel` from 3 to 8
 * was enough to fail it.
 *
 * What a task owes the graph instead: `dependsOn`. The ordering Nx is given in
 * `dependsOn` is ordering Nx can cache, replay and schedule once. The ordering
 * a script performs by spawning a command is ordering Nx learns about when the
 * process is already running.
 *
 * Three places are read. A configured target's own command, which is where an
 * `nx` call is plain to see. The file that command runs, which is where the
 * `testing-data` one hid. And every test source, because a test is a task too:
 * `doc-behaviour-run.test.ts` ran the eleven library suites from a `beforeAll`
 * through `nx run-many`, and the first two rules walked past it, because
 * `@evanion/repo-checks:test` configures no command of its own and Vitest is
 * what the inferred target runs.
 *
 * Nothing follows a file's imports, so a helper module three levels down could
 * still spawn Nx and pass here. One level is where the repository's task
 * scripts do their work, and a check that parsed the module graph would cost a
 * resolver for a rule three files need.
 *
 * Only configured targets are read. Nx infers `watch-deps` on every buildable
 * project and its command is `npx nx watch ... -- npx nx build-deps ...`, which
 * is the target's whole purpose and is never scheduled inside another run.
 */

/** A configured target, and the directory its command runs in. */
type Configured = { command: string; cwd: string; task: string };

/** Where `nx` stands as the program being run, with or without a runner in front. */
const INVOKES_NX =
  /(^|[\s;&|(])(?:npx\s+|pnpm\s+(?:exec\s+|dlx\s+)?|yarn\s+|bunx\s+|(?:\.\/)?node_modules\/\.bin\/)?nx(\s|$)/;

/** The functions that start another program. */
const SPAWNS = new Set([
  'exec',
  'execFile',
  'execFileSync',
  'execSync',
  'fork',
  'spawn',
  'spawnSync',
]);

/** A script path a command hands to an interpreter. */
const SCRIPT = /\.[cm]?[jt]s$/;

/** What `nx` is called through, when it is not called directly. */
const RUNNERS = new Set(['npx', 'pnpm', 'yarn', 'bunx']);

/** Every command the repository writes down for itself, task by task. */
async function configured(): Promise<Configured[]> {
  const graph = await createProjectGraphAsync({ exitOnError: false });
  const found: Configured[] = [];

  for (const [name, node] of Object.entries(graph.nodes)) {
    const root = node.data.root;
    const read = (file: string): Record<string, unknown> => {
      try {
        return JSON.parse(
          readFileSync(join(workspaceRoot, root, file), 'utf8'),
        );
      } catch {
        return {};
      }
    };

    const project = read('project.json');
    const manifest = read('package.json') as { nx?: { targets?: unknown } };
    const targets = {
      ...((project.targets as Record<string, unknown>) ?? {}),
      ...((manifest.nx?.targets as Record<string, unknown>) ?? {}),
    };

    for (const [target, value] of Object.entries(targets)) {
      const config = (value ?? {}) as {
        command?: string;
        commands?: (string | { command?: string })[];
        options?: {
          command?: string;
          commands?: (string | { command?: string })[];
          cwd?: string;
        };
      };
      const commands = [
        config.command,
        config.options?.command,
        ...(config.commands ?? []),
        ...(config.options?.commands ?? []),
      ].map((one) => (typeof one === 'string' ? one : one?.command));

      const cwd = (config.options?.cwd ?? '{workspaceRoot}')
        .replace('{projectRoot}', root)
        .replace('{workspaceRoot}', '.');

      for (const command of commands) {
        if (!command) continue;
        found.push({ command, cwd, task: `${name}:${target}` });
      }
    }
  }

  return found;
}

/** The script a command runs, as a path from the workspace root. */
function scriptOf(entry: Configured): string | null {
  const token = entry.command
    .split(/\s+/)
    .find((one) => SCRIPT.test(one) && !one.startsWith('-'));

  return token ? join(workspaceRoot, entry.cwd, token) : null;
}

/** The program a `child_process` call starts, read off its arguments. */
function programOf(node: ts.CallExpression): string | null {
  const [first, second] = node.arguments;
  if (!first || !ts.isStringLiteralLike(first)) return null;
  if (!RUNNERS.has(first.text)) return first.text;

  // `npx nx run-many`: the program is the first element of the argument array.
  if (second && ts.isArrayLiteralExpression(second)) {
    const [head] = second.elements;
    return head && ts.isStringLiteralLike(head) ? head.text : null;
  }
  return first.text;
}

/** Every program a file starts, with the line the call sits on. */
function spawnsIn(path: string): { line: number; program: string }[] {
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return [];
  }

  const source = ts.createSourceFile(
    path,
    text,
    ts.ScriptTarget.ESNext,
    true,
    ts.ScriptKind.TS,
  );
  const found: { line: number; program: string }[] = [];

  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node)) {
      let callee = node.expression;
      if (ts.isPropertyAccessExpression(callee)) callee = callee.name;
      if (ts.isIdentifier(callee) && SPAWNS.has(callee.text)) {
        const program = programOf(node);
        if (program !== null) {
          found.push({
            line: source.getLineAndCharacterOfPosition(node.getStart(source))
              .line,
            program,
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(source);
  return found;
}

/** A file the runner executes as a task. */
const TEST_FILE = /\.(test|spec)\.[cm]?[jt]sx?$/;

/** Directories holding nothing a person wrote. */
const SKIPPED = new Set([
  'node_modules',
  'dist',
  '.next',
  '.nx',
  '.git',
  'out',
  'coverage',
  'test-output',
  '.claude',
]);

/** Every test source in the repository, as paths from the workspace root. */
function testSources(dir = workspaceRoot): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) {
      return SKIPPED.has(entry.name) ? [] : testSources(join(dir, entry.name));
    }
    return TEST_FILE.test(entry.name) ? [join(dir, entry.name)] : [];
  });
}

describe('a configured nx task', () => {
  it('runs a command that does not start nx again', async () => {
    const found = (await configured())
      .filter((entry) => INVOKES_NX.test(entry.command))
      .map((entry) => `${entry.task}: ${entry.command}`);

    expect(
      found.sort(),
      'A task that shells into nx runs a second scheduler inside the first. ' +
        'Declare the ordering in dependsOn and let the outer run schedule it.',
    ).toEqual([]);
  });

  it('runs a script that does not start nx again', async () => {
    const found: string[] = [];

    for (const entry of await configured()) {
      const script = scriptOf(entry);
      if (script === null) continue;

      for (const { line, program } of spawnsIn(script)) {
        if (!INVOKES_NX.test(program)) continue;
        const relative = script.slice(workspaceRoot.length + 1);
        found.push(
          `${entry.task}: ${relative}:${line + 1} starts "${program}"`,
        );
      }
    }

    expect(
      found.sort(),
      'A task script that spawns nx runs a second scheduler inside the first. ' +
        'Declare the ordering in the task dependsOn and read what it produced.',
    ).toEqual([]);
  });

  it('runs a test that does not start nx again', () => {
    const found: string[] = [];

    for (const path of testSources()) {
      for (const { line, program } of spawnsIn(path)) {
        if (!INVOKES_NX.test(program)) continue;
        const relative = path.slice(workspaceRoot.length + 1);
        found.push(`${relative}:${line + 1} starts "${program}"`);
      }
    }

    expect(
      found.sort(),
      'A test that spawns nx runs a second scheduler inside the one running ' +
        'the test. Declare the ordering on the project test target and read ' +
        'what the suites it depends on wrote.',
    ).toEqual([]);
  });
});
