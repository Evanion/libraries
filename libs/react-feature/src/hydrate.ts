/**
 * Whether this bundle is a production one.
 *
 * `process` is a Node global. This package ships as plain ESM with no bundling
 * step and no shim, so a browser loading `@evanion/react-feature` through an
 * import map holds no `process` and reading one raises a `ReferenceError`, and
 * a shim that supplies `process` without `env` raises a `TypeError`. Either
 * one raises out of the provider's `useMemo`, so the whole tree fails to
 * mount over a question about a bundle flag.
 *
 * The member chain is written out whole because a bundler's `define` matches
 * the text `process.env.NODE_ENV` and substitutes the string. A guard that
 * read `process.env` into a local first would defeat that substitution and
 * leave a production bundle running the development diff. `try` keeps the text
 * a bundler replaces and still answers for a runtime that defines neither
 * half.
 *
 * A runtime that answers neither half answers `true`, because this read gates
 * work and not a message. § 4 requires the development diff to stay out of
 * production, and the runtime that cannot be read is a plain ESM deployment,
 * which is as often a served production page as a developer's machine. The
 * diff costs a second `features.resolve` per mount, a second `'resolve'` event
 * on a store built with `observe`, and a `'decision-differs'` report for every
 * key an observer then has to triage. A developer who wants the diff in a
 * runtime with no `process` supplies one: `globalThis.process = { env: { NODE_ENV: 'development' } }`
 * ahead of the provider's first render answers the read.
 *
 * `createEmitter` takes the other side for the same read
 * (`observe.ts:290-294`), and it gates a `console.warn` that costs a line of
 * output.
 */
export function production(): boolean {
  try {
    return process.env.NODE_ENV === 'production';
  } catch {
    return true;
  }
}
