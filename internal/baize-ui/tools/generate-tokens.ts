/**
 * Writes `src/tokens.generated.css` from the token modules.
 *
 * Run it with `npx nx run baize-ui:generate-tokens`. The generated file is
 * committed, because a token value nothing in the repo can read without a build
 * having run is a value a reviewer cannot see in a diff either.
 *
 * `src/tokens-generated.test.ts` renders the same function and compares the
 * result byte for byte, so neither half can move without the other.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { renderTokensCss } from '../src/tokens/custom-properties.js';

const target = join(import.meta.dirname, '..', 'src', 'tokens.generated.css');

writeFileSync(target, renderTokensCss(), 'utf8');
console.log(`wrote ${target}`);
