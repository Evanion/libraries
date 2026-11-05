import { describe, expect, it } from 'vitest';

import { MAX_BODY_BYTES, MAX_TASKS, buildReport } from './report.js';
import { runContext, taskResult } from './test-fixtures.js';

describe('buildReport', () => {
  it('copies the run id and the run start and end', () => {
    const report = buildReport(runContext(), {});

    expect(report).toMatchObject({
      runId: 'run-0f9c2a',
      startTime: 1_700_000_000_000,
      endTime: 1_700_000_002_000,
    });
  });

  it('maps a task to its hash, project, target, status, times and cacheable flag', () => {
    const report = buildReport(
      runContext([
        taskResult({
          project: 'shop',
          target: 'build',
          configuration: 'production',
          hash: '9876',
          startTime: 1_700_000_000_100,
          endTime: 1_700_000_000_900,
          cache: false,
        }),
      ]),
      {},
    );

    expect(report.tasks).toEqual([
      {
        hash: '9876',
        project: 'shop',
        target: 'build',
        status: 'success',
        startTime: 1_700_000_000_100,
        endTime: 1_700_000_000_900,
        cacheable: false,
      },
    ]);
  });

  it.each([
    'success',
    'failure',
    'local-cache',
    'local-cache-kept-existing',
    'remote-cache',
  ] as const)('passes the %s status through unchanged', (status) => {
    const report = buildReport(runContext([taskResult({ status })]), {});

    expect(report.tasks.map((t) => t.status)).toEqual([status]);
  });

  it.each(['skipped', 'stopped'] as const)(
    'leaves out a %s task, which the server would skip',
    (status) => {
      const report = buildReport(runContext([taskResult({ status })]), {});

      expect(report.tasks).toEqual([]);
    },
  );

  it('leaves out a task with no hash', () => {
    const report = buildReport(
      runContext([taskResult({ hash: undefined })]),
      {},
    );

    expect(report.tasks).toEqual([]);
  });

  it('leaves out a task with no start time', () => {
    const report = buildReport(
      runContext([taskResult({ startTime: undefined })]),
      {},
    );

    expect(report.tasks).toEqual([]);
  });

  it('leaves out a task with no end time', () => {
    const report = buildReport(
      runContext([taskResult({ endTime: undefined })]),
      {},
    );

    expect(report.tasks).toEqual([]);
  });

  it('leaves out a task that ends before it starts', () => {
    const report = buildReport(
      runContext([taskResult({ startTime: 2_000, endTime: 1_000 })]),
      {},
    );

    expect(report.tasks).toEqual([]);
  });

  it('leaves out a task whose hash the server would reject', () => {
    const report = buildReport(
      runContext([
        taskResult({ hash: 'a/b' }),
        taskResult({ hash: 'x'.repeat(129) }),
      ]),
      {},
    );

    expect(report.tasks).toEqual([]);
  });

  it('leaves out a task whose project name is longer than 256 characters', () => {
    const report = buildReport(
      runContext([taskResult({ project: 'p'.repeat(257) })]),
      {},
    );

    expect(report.tasks).toEqual([]);
  });

  it('rounds fractional timestamps to whole milliseconds', () => {
    const report = buildReport(
      runContext([taskResult({ startTime: 1_000.4, endTime: 2_000.6 })], {
        startTime: 999.6,
        endTime: 3_000.2,
      }),
      {},
    );

    expect(report).toMatchObject({ startTime: 1_000, endTime: 3_000 });
    expect(report.tasks[0]).toMatchObject({ startTime: 1_000, endTime: 2_001 });
  });

  it('sends no terminal output, argv, hash details or workspace paths', () => {
    const body = JSON.stringify(
      buildReport(
        runContext([taskResult({ terminalOutput: 'SECRET-OUTPUT' })]),
        {},
      ),
    );

    expect(body).not.toContain('SECRET-OUTPUT');
    expect(body).not.toContain('hunter2');
    expect(body).not.toContain('run-many');
    expect(body).not.toContain('echo $SECRET');
    expect(body).not.toContain('libs/shop');
    expect(body).not.toContain('/home/ci');
    expect(Object.keys(buildReport(runContext(), {})).sort()).toEqual([
      'ci',
      'endTime',
      'runId',
      'startTime',
      'tasks',
    ]);
  });

  it('sets ci when CI is "true"', () => {
    expect(buildReport(runContext(), { CI: 'true' }).ci).toBe(true);
  });

  it.each([undefined, 'false', '1', 'TRUE'])(
    'leaves ci false when CI is %s',
    (value) => {
      expect(buildReport(runContext(), { CI: value }).ci).toBe(false);
    },
  );

  it(`keeps at most ${MAX_TASKS} tasks, in the order Nx reported them`, () => {
    const results = Array.from({ length: MAX_TASKS + 10 }, (_, i) =>
      taskResult({ id: `p${i}:build`, project: `p${i}`, hash: `h${i}` }),
    );

    const report = buildReport(runContext(results), {});

    expect(report.tasks).toHaveLength(MAX_TASKS);
    expect(report.tasks[0]?.project).toBe('p0');
    expect(report.tasks.at(-1)?.project).toBe(`p${MAX_TASKS - 1}`);
  });

  it(`keeps the body within ${MAX_BODY_BYTES} bytes`, () => {
    const results = Array.from({ length: MAX_TASKS }, (_, i) =>
      taskResult({
        id: `${i}`,
        project: `${i}`.padEnd(256, 'p'),
        target: 't'.repeat(256),
        hash: `${i}`.padEnd(128, 'h'),
      }),
    );

    const report = buildReport(runContext(results), {});
    const bytes = Buffer.byteLength(JSON.stringify(report));

    expect(bytes).toBeLessThanOrEqual(MAX_BODY_BYTES);
    expect(report.tasks.length).toBeGreaterThan(0);
    expect(report.tasks.length).toBeLessThan(MAX_TASKS);
    expect(report.tasks[0]?.project.startsWith('0')).toBe(true);
  });

  it('counts the body in UTF-8 bytes, not characters', () => {
    const results = Array.from({ length: MAX_TASKS }, (_, i) =>
      taskResult({
        id: `${i}`,
        project: `${i}`.padEnd(200, 'å'),
        hash: `h${i}`,
      }),
    );

    const report = buildReport(runContext(results), {});

    expect(Buffer.byteLength(JSON.stringify(report))).toBeLessThanOrEqual(
      MAX_BODY_BYTES,
    );
  });
});
