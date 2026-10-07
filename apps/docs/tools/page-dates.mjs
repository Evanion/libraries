import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { promisify } from 'node:util';

/**
 * The date a page shows as "Last updated": the committer time of the last
 * commit that changed the file the page was written from.
 *
 * A page a person writes is its own source, read at `HEAD`. A page
 * `nx run docs:archives` generates is ignored by git, and its source is the file
 * `content/versions.json` names: a cut page is `<dir>/<page>` at the line's
 * commit, and a bare section copied from `content/next/` is the copy's original
 * at `HEAD`. A generated path that a commit once held, such as
 * `content/urn/getting-started.mdx` before `content/next/` existed, has a
 * history of its own, and that history dates the move and not the page.
 */

const run = promisify(execFile);

/**
 * The commit and the workspace-relative path a page under `content/` was
 * written from.
 *
 * `file` is the page's path inside `content/`, with `/` separators. `sections`
 * is `content/versions.json`'s `sections`.
 *
 * @param {Record<string, {
 *   current: { from: 'cut' | 'next', sha?: string, dir?: string },
 *   lines: readonly { segment: string, sha: string, dir: string }[],
 * }>} sections
 * @param {string} contentDir the content directory, relative to the workspace root
 * @param {string} file
 * @returns {{ commit: string, path: string }}
 */
export function sourceOf(sections, contentDir, file) {
  const [slug, ...rest] = file.split('/');
  const section = sections[slug];

  if (!section) return { commit: 'HEAD', path: `${contentDir}/${file}` };

  const line = section.lines.find((each) => each.segment === rest[0]);
  if (line)
    return { commit: line.sha, path: `${line.dir}/${rest.slice(1).join('/')}` };

  const { current } = section;
  return current.from === 'cut'
    ? { commit: current.sha, path: `${current.dir}/${rest.join('/')}` }
    : { commit: 'HEAD', path: `${contentDir}/next/${file}` };
}

/**
 * The committer time, in milliseconds, of the last commit at or before `commit`
 * that changed `path`, or `null` when `commit` holds no file at `path`.
 *
 * The tree check comes first because `git log -- <path>` also answers for a
 * path the commit no longer holds, with the commit that deleted it.
 */
export async function lastCommitTime(workspaceRoot, { commit, path }) {
  const git = (...args) => run('git', args, { cwd: workspaceRoot });

  try {
    await git('cat-file', '-e', `${commit}:${path}`);
  } catch {
    return null;
  }

  const { stdout } = await git('log', '-1', '--format=%ct', commit, '--', path);
  const seconds = Number.parseInt(stdout.trim(), 10);

  return Number.isNaN(seconds) ? null : seconds * 1000;
}

/**
 * The "Last updated" time of the page at the absolute path `page`, or `null`
 * for a page no commit holds the source of.
 *
 * @param {{ workspaceRoot: string, docsRoot: string }} roots
 * @param {string} page
 */
export async function pageTime({ workspaceRoot, docsRoot }, page) {
  const content = join(docsRoot, 'content');
  const posix = (path) => path.split(sep).join('/');
  const inContent = posix(relative(content, page));

  if (inContent.startsWith('../'))
    return lastCommitTime(workspaceRoot, {
      commit: 'HEAD',
      path: posix(relative(workspaceRoot, page)),
    });

  const { sections } = JSON.parse(
    readFileSync(join(content, 'versions.json'), 'utf8'),
  );

  return lastCommitTime(
    workspaceRoot,
    sourceOf(sections, posix(relative(workspaceRoot, content)), inContent),
  );
}
