import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { renderTokensCss } from './tokens/custom-properties.js';

const GENERATED = join(import.meta.dirname, 'tokens.generated.css');

/**
 * Holds the committed custom-property block and the token modules in step.
 *
 * Byte for byte, and in both directions: a hex edited in the stylesheet fails
 * here, and a hex edited in a token module without regenerating fails here too.
 * This is the pattern `commitlint.config.js` and
 * `tools/repo-checks/src/commitlint-scope-enum.test.ts` already use -- a static
 * artefact something cheap can read, with a dynamic test keeping it honest.
 */
describe('src/tokens.generated.css', () => {
  it('is what the generator produces', () => {
    expect(
      readFileSync(GENERATED, 'utf8'),
      `src/tokens.generated.css is not what tools/generate-tokens.ts produces. ` +
        `Run \`npx nx run baize-ui:generate-tokens\`. If you edited the CSS by ` +
        `hand, edit the token module instead -- the TypeScript side is the ` +
        `source, because a stylesheet cannot be type-checked.`,
    ).toBe(renderTokensCss());
  });
});
