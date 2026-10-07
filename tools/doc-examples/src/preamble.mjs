import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The lines a package's markdown examples may use without writing them out.
 *
 * A markdown file keeps its one-line examples one line long by importing once at the
 * top and letting the later blocks stand on that import. Two systems then have
 * to agree on what those blocks may assume: `vite-plugin-doctest`, which runs
 * every block as a test, and the docs app's region loader, which lifts a block
 * onto a page where Twoslash compiles it. They read the same file, so a name
 * that resolves under one resolves under the other.
 *
 * The file sits at the package root, beside `vite.config.ts` and the README.
 * The doctest run has `import.meta.dirname` of that config, and the loader has
 * a `file=` path to the README or to `docs/examples.md`, which
 * `packageDirOf` turns back into the root.
 *
 *     // libs/urn/doc-examples.preamble.ts
 *     import { URN } from '@evanion/urn';
 *
 * A `.ts` file rather than a string in a config or a field in `package.json`:
 * the contents are TypeScript, and an editor resolves the specifier and the
 * names in it like any other source.
 */
export const PREAMBLE_FILE = 'doc-examples.preamble.ts';

/** A package's preamble, or the empty string where it declares none. */
export function readPreamble(packageDir) {
  const path = join(packageDir, PREAMBLE_FILE);
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

/** Where `readPreamble` looks, so a caller can watch the file for changes. */
export function preamblePath(packageDir) {
  return join(packageDir, PREAMBLE_FILE);
}

/**
 * A block with the preamble in front of it, hidden from the rendered output.
 *
 * `// ---cut---` is Twoslash's directive to compile everything above it and
 * emit none of it, so the compiler resolves the names while the reader sees
 * the block the markdown shows and nothing more.
 *
 * A block that writes its own imports takes them over the preamble's, which is
 * the rule the doctest run already follows. Prepending here as well would
 * declare the same binding twice and the fence would fail to compile.
 */
export function withPreamble(preamble, code) {
  if (!preamble || writesOwnImports(code)) return code;
  return `${preamble.replace(/\n*$/, '\n')}// ---cut---\n${code}`;
}

/**
 * Whether a block imports a value, and so stands without the preamble.
 *
 * An `import type` line does not count. vite-plugin-doctest prepends the
 * preamble without transforming it, so the preamble has to parse as plain
 * JavaScript and cannot import a type. A block that names a type imports it
 * itself, the per-block transform erases that line, and the doctest run
 * executes the block on the preamble. The compiler has to see the same.
 */
export function writesOwnImports(code) {
  return /^import(?!\s+type[\s{])[\s{]/m.test(code);
}
