import type { PostTasksExecutionContext, TaskResult } from './nx-types.js';

type Status = TaskResult['status'];

export interface TaskInput {
  id?: string;
  project?: string;
  target?: string;
  configuration?: string;
  status?: Status;
  hash?: string;
  startTime?: number;
  endTime?: number;
  cache?: boolean;
  terminalOutput?: string;
}

/** One task result shaped the way Nx hands it to `postTasksExecution`. */
export function taskResult(input: TaskInput = {}): TaskResult {
  const project = input.project ?? 'shop';
  const target = input.target ?? 'build';
  const id = input.id ?? `${project}:${target}`;

  return {
    task: {
      id,
      target: {
        project,
        target,
        ...(input.configuration ? { configuration: input.configuration } : {}),
      },
      overrides: { __overrides_unparsed__: [] },
      outputs: ['{workspaceRoot}/dist/libs/shop'],
      projectRoot: 'libs/shop',
      ...('hash' in input ? { hash: input.hash } : { hash: '1234567890' }),
      hashDetails: {
        command: 'nx run shop:build',
        nodes: { 'libs/shop/src/index.ts': 'abc' },
        runtime: { 'echo $SECRET': 'xyz' },
      },
      ...('startTime' in input
        ? { startTime: input.startTime }
        : { startTime: 1_700_000_000_000 }),
      ...('endTime' in input
        ? { endTime: input.endTime }
        : { endTime: 1_700_000_001_500 }),
      cache: input.cache ?? true,
    },
    status: input.status ?? 'success',
    code: input.status === 'failure' ? 1 : 0,
    terminalOutput: input.terminalOutput ?? 'built libs/shop in 1.5s',
  } as TaskResult;
}

/** A run context holding `results`, keyed by task id as Nx keys it. */
export function runContext(
  results: TaskResult[] = [taskResult()],
  overrides: Partial<PostTasksExecutionContext> = {},
): PostTasksExecutionContext {
  return {
    id: 'run-0f9c2a',
    workspaceRoot: '/home/ci/work/secret-project',
    nxJsonConfiguration: {},
    taskResults: Object.fromEntries(results.map((r) => [r.task.id, r])),
    argv: ['node', 'nx', 'run-many', '-t', 'build', '--token=hunter2'],
    startTime: 1_700_000_000_000,
    endTime: 1_700_000_002_000,
    ...overrides,
  } as PostTasksExecutionContext;
}
