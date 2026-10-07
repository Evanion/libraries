import * as matchers from '@testing-library/jest-dom/matchers';
import { expect } from 'vitest';

expect.extend(matchers);

// Vitest 5 reads a custom matcher's type from `Matchers<R, T>`.
// @testing-library/jest-dom 7.0.1 types its matchers on the global
// `jest.Matchers`, which vitest 5 does not read, and in its `/vitest` entry on
// a one-parameter `Assertion<T>`, which does not match vitest's
// `Assertion<R, T>` and gives each matcher the received type as its return
// type. The interface is empty because declaration merging is how a module
// augmentation adds members, and its type parameters must match vitest's, `T`
// included.
declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-empty-interface, @typescript-eslint/no-unused-vars
  interface Matchers<R, T> extends matchers.TestingLibraryMatchers<
    unknown,
    R
  > {}
}
