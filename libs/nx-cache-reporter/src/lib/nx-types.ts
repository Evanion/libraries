// `nx/src/devkit-exports` is the module `@nx/devkit` re-exports, and it has
// carried these names since before Nx 21, the oldest version the peer range
// allows. Type-only, so the emitted JavaScript never loads nx.
export type {
  PostTasksExecution,
  PostTasksExecutionContext,
  TaskResult,
} from 'nx/src/devkit-exports';
