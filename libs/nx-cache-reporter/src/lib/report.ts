import type { PostTasksExecutionContext, TaskResult } from './nx-types.js';

/** The most tasks the server takes in one report. Over it, the server answers 413. */
export const MAX_TASKS = 5000;

/** The largest body the server takes, in bytes. Over it, the server answers 413. */
export const MAX_BODY_BYTES = 1_048_576;

const REPORTED_STATUSES = [
  'success',
  'failure',
  'local-cache',
  'local-cache-kept-existing',
  'remote-cache',
] as const;

/**
 * The task statuses the server records. Nx's `skipped` and `stopped` are left
 * out: the task neither ran to the end nor came from a cache.
 */
export type ReportedStatus = (typeof REPORTED_STATUSES)[number];

/** One task as the server receives it. */
export interface ReportedTask {
  /** The Nx task hash, which is the cache key. */
  hash: string;
  /** The Nx project name. */
  project: string;
  /** The target name, without its configuration. */
  target: string;
  status: ReportedStatus;
  /** Milliseconds since the epoch. */
  startTime: number;
  /** Milliseconds since the epoch. */
  endTime: number;
  /** Whether the target is cacheable. */
  cacheable: boolean;
}

/** The body of `POST /v1/runs`. */
export interface RunReport {
  /** Nx's id for the run. The server drops a second report with the same id. */
  runId: string;
  /** Milliseconds since the epoch. */
  startTime: number;
  /** Milliseconds since the epoch. */
  endTime: number;
  /** `true` when the `CI` environment variable is `"true"`. */
  ci: boolean;
  tasks: ReportedTask[];
}

const HASH = /^[A-Za-z0-9_-]{1,128}$/;
const MAX_NAME_LENGTH = 256;
const MAX_SPAN_MS = 7 * 24 * 60 * 60 * 1000;

const isStatus = (status: string): status is ReportedStatus =>
  (REPORTED_STATUSES as readonly string[]).includes(status);

const isName = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= MAX_NAME_LENGTH;

/** `value` as whole milliseconds, or `undefined` when it is not a time. */
function milliseconds(value: unknown): number | undefined {
  if (typeof value !== 'number') return undefined;
  const rounded = Math.round(value);
  return Number.isSafeInteger(rounded) && rounded >= 0 ? rounded : undefined;
}

/**
 * The task as the server accepts it, or `undefined` for a task the server
 * would skip. Leaving those out keeps the body budget for tasks it records.
 */
function reportedTask({ task, status }: TaskResult): ReportedTask | undefined {
  const hash = task.hash;
  const { project, target } = task.target;
  const startTime = milliseconds(task.startTime);
  const endTime = milliseconds(task.endTime);

  if (
    !isStatus(status) ||
    typeof hash !== 'string' ||
    !HASH.test(hash) ||
    !isName(project) ||
    !isName(target) ||
    startTime === undefined ||
    endTime === undefined ||
    endTime < startTime ||
    endTime - startTime > MAX_SPAN_MS
  ) {
    return undefined;
  }

  return {
    hash,
    project,
    target,
    status,
    startTime,
    endTime,
    cacheable: task.cache === true,
  };
}

const utf8Bytes = (value: unknown): number =>
  Buffer.byteLength(JSON.stringify(value), 'utf8');

/**
 * The report for one Nx run, in the shape `POST /v1/runs` accepts.
 *
 * Only the fields in {@link ReportedTask} leave the machine: no terminal
 * output, no argv, no hash inputs, no paths. Tasks the server would skip are
 * left out.
 *
 * The server refuses a report over {@link MAX_TASKS} tasks or
 * {@link MAX_BODY_BYTES} bytes, and drops a second report with the same run id,
 * so a large run cannot be split across requests. The report keeps tasks in
 * the order Nx lists them and stops at whichever limit comes first.
 */
export function buildReport(
  context: PostTasksExecutionContext,
  env: Record<string, string | undefined> = process.env,
): RunReport {
  const report: RunReport = {
    runId: context.id,
    startTime: Math.round(context.startTime),
    endTime: Math.round(context.endTime),
    ci: env['CI'] === 'true',
    tasks: [],
  };

  // The empty report, plus one byte per comma between tasks.
  let bytes = utf8Bytes(report);

  for (const result of Object.values(context.taskResults)) {
    if (report.tasks.length === MAX_TASKS) break;

    const task = reportedTask(result);
    if (!task) continue;

    const size = utf8Bytes(task) + (report.tasks.length > 0 ? 1 : 0);
    if (bytes + size > MAX_BODY_BYTES) break;

    bytes += size;
    report.tasks.push(task);
  }

  return report;
}
