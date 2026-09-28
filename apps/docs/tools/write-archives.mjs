import { join } from 'node:path';

import { packages } from '../app/navigation.ts';
import { writeArchives } from './archives.mjs';

/**
 * Writes every package's bare section and retained release lines under
 * `content/`, for `nx run docs:archives`.
 *
 * `archives.mjs` carries what is written and why. This is the one caller that
 * touches the real content tree; the tests drive `writeArchives` against
 * fixture repositories.
 */

const docsRoot = join(import.meta.dirname, '..');
const manifest = writeArchives({
  docsRoot,
  workspaceRoot: join(docsRoot, '..', '..'),
  packages,
});

for (const [slug, section] of Object.entries(manifest.sections)) {
  const { current, lines } = section;
  const bare =
    current.from === 'cut'
      ? `${current.version} cut from ${current.sha.slice(0, 7)} (${current.source})`
      : current.version
        ? `${current.version}, served from /next/ (${current.reason})`
        : 'unreleased, served from /next/';
  const older = lines.map(
    (line) => `${line.segment} ${line.version} from ${line.sha.slice(0, 7)}`,
  );

  console.log(`${slug}: ${[bare, ...older].join('; ')}`);
}
