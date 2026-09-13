/**
 * Which released packages a change to cannot reach the docs site.
 *
 * `.github/workflows/docs.yml` triggers on pushes to `main` under a hand-written
 * `paths` filter. A released package whose root is absent from that filter is
 * documented by a site that never rebuilds when it changes: no job runs, so
 * nothing is red, and the published page keeps describing the previous state.
 * `nest/**` was absent for exactly this reason, and the only signal was a
 * missing workflow run that nobody was looking for.
 *
 * The filter is a list of globs and the release set is a list of globs, and
 * neither derives from the other -- `nx.json` matches project directories, the
 * workflow matches changed files, and GitHub has no way to ask Nx anything. So
 * the two lists are held against each other here, the same way
 * `commitlint-scope-enum.test.ts` holds the commit scopes against the project
 * graph. A package landing under a new top-level directory fails this until the
 * workflow names it.
 *
 * What counts as covered is deliberately strict: the filter has to match
 * everything under the package root, which only a `<prefix>/**` pattern does. A
 * narrower pattern is a hole, because a change to a source file outside it would
 * not deploy. Anything the rule cannot read as a whole-subtree pattern
 * contributes no coverage and its root is reported, so an unfamiliar pattern
 * fails loudly rather than passing on a guess about GitHub's glob dialect.
 *
 * The IO is passed in so the rule can be asserted against fixtures: this
 * repository has one shape today and a different one as soon as a package lands
 * somewhere new.
 */

/** The metacharacters GitHub's filter patterns give meaning to. */
const META = /[*?[\]+\\!]/;

/**
 * The directory a whole-subtree pattern covers, or `null` if it is not one.
 *
 * `**` covers the repository and `libs/**` covers `libs`. `libs/*` covers
 * nothing whole, because it stops at one segment, and a pattern naming a file
 * covers nothing whole because a sibling file changing does not match it.
 */
function subtreePrefix(pattern: string): string | null {
  if (pattern === '**') return '';

  if (!pattern.endsWith('/**')) return null;

  const prefix = pattern.slice(0, -'/**'.length);

  return META.test(prefix) ? null : prefix;
}

/**
 * The pattern read literally up to its first metacharacter: the shallowest
 * directory it can touch. `libs/baize-ui/**` and `libs/*` give `libs/baize-ui`
 * and `libs`.
 */
function literalPrefix(pattern: string): string {
  const kept: string[] = [];

  for (const segment of pattern.split('/')) {
    if (META.test(segment)) break;
    kept.push(segment);
  }

  return kept.join('/');
}

/** Whether `path` is `directory` itself or sits underneath it. */
function isWithin(path: string, directory: string): boolean {
  return (
    directory === '' || path === directory || path.startsWith(`${directory}/`)
  );
}

export interface TriggerCoverageInputs {
  /**
   * The roots of the projects the repository releases, as the project graph
   * spells them: `libs/luhn`, `nest/correlation-id`.
   */
  roots: readonly string[];
  /** The `paths` filter on the docs workflow's push trigger. */
  patterns: readonly string[];
}

/**
 * The released roots a push under which would not run the docs workflow.
 *
 * A root is covered when some positive pattern spans its whole subtree and no
 * negative pattern intersects it. A negative pattern that touches the root at
 * all uncovers it: it carves a hole somewhere underneath, and a filter that
 * matches a package's source only sometimes is not a trigger anyone can reason
 * about. Reading the negation more precisely would mean deciding whether the
 * hole it cuts matters, and for a deploy trigger it always does.
 */
export function uncoveredRoots(inputs: TriggerCoverageInputs): string[] {
  const positive: string[] = [];
  const negative: string[] = [];

  for (const pattern of inputs.patterns) {
    if (pattern.startsWith('!')) negative.push(pattern.slice(1));
    else positive.push(pattern);
  }

  return [...inputs.roots]
    .filter((root) => {
      const covered = positive.some((pattern) => {
        const prefix = subtreePrefix(pattern);

        return prefix !== null && isWithin(root, prefix);
      });

      if (!covered) return true;

      return negative.some((pattern) => {
        const directory = literalPrefix(pattern);

        return isWithin(root, directory) || isWithin(directory, root);
      });
    })
    .sort();
}
