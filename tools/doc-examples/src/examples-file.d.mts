/**
 * Types for `examples-file.mjs`.
 *
 * That module is plain JavaScript for the reason `regions.d.mts` gives: the
 * docs app's MDX loaders import it, and Nx loads that config under Node's
 * native type stripping while building the project graph.
 */

export declare const EXAMPLES_FILE: string;

export declare const MARKDOWN_SOURCES: readonly string[];

export declare function packageDirOf(file: string): string;

export declare function examplesFileIn(packageDir: string): string;
