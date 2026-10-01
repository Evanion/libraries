/**
 * Writes `public/code-classes.css`, the rules for the classes every highlighted
 * token on the site carries (`tools/code-classes.mjs`). `app/layout.tsx` links
 * it from every page's head, so the site serves the one stylesheet.
 */
import { writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { stylesheet } from './code-classes.mjs';

const target = join(import.meta.dirname, '..', 'public', 'code-classes.css');

writeFileSync(
  target,
  `/* Written by \`nx run docs:code-classes\` from tools/code-classes.mjs. */\n${stylesheet}`,
);

console.log(
  `${relative(process.cwd(), target)}: ${stylesheet.split('}').length - 1} rules`,
);
