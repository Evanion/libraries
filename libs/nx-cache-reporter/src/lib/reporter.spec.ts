import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { REPORT_TIMEOUT_MS, postTasksExecution } from './reporter.js';
import { runContext, taskResult } from './test-fixtures.js';

const TOKEN = 'ci-write-0123456789abcdef';

interface Received {
  method: string | undefined;
  url: string | undefined;
  headers: IncomingMessage['headers'];
  body: string;
}

type Handler = (req: IncomingMessage, res: ServerResponse) => void;

let server: Server | undefined;
let received: Received[] = [];
let arrived: () => void = () => undefined;
let firstRequest: Promise<void>;

/** Starts a local server that records each request and answers with `handler`. */
async function listen(handler: Handler): Promise<string> {
  received = [];
  firstRequest = new Promise((resolve) => {
    arrived = resolve;
  });
  server = createServer((req, res) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk: string) => (body += chunk));
    req.on('end', () => {
      received.push({
        method: req.method,
        url: req.url,
        headers: req.headers,
        body,
      });
      arrived();
      handler(req, res);
    });
  });
  await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', resolve));
  const { port } = server?.address() as AddressInfo;
  return `http://127.0.0.1:${port}`;
}

const accept: Handler = (_req, res) => {
  res.writeHead(202, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ accepted: 1, skipped: 0 }));
};

/** A port nothing listens on: bind one, note it, close it. */
async function closedPort(): Promise<string> {
  const probe = createServer();
  await new Promise<void>((resolve) => probe.listen(0, '127.0.0.1', resolve));
  const { port } = probe.address() as AddressInfo;
  await new Promise<void>((resolve) => probe.close(() => resolve()));
  return `http://127.0.0.1:${port}`;
}

/** Everything the hook writes to the console or the standard streams. */
function captureOutput(): { lines: () => string[]; restore: () => void } {
  const written: string[] = [];
  const record = (...args: unknown[]) =>
    void written.push(args.map(String).join(' '));
  const spies = [
    vi.spyOn(console, 'log').mockImplementation(record),
    vi.spyOn(console, 'info').mockImplementation(record),
    vi.spyOn(console, 'warn').mockImplementation(record),
    vi.spyOn(console, 'error').mockImplementation(record),
    vi.spyOn(console, 'debug').mockImplementation(record),
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      written.push(String(chunk));
      return true;
    }),
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      written.push(String(chunk));
      return true;
    }),
  ];
  return {
    lines: () => written,
    restore: () => spies.forEach((spy) => spy.mockRestore()),
  };
}

function reportingEnv(server: string): void {
  vi.stubEnv('NX_SELF_HOSTED_REMOTE_CACHE_SERVER', server);
  vi.stubEnv('NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN', TOKEN);
  vi.stubEnv('NX_CACHE_REPORTER', undefined);
  vi.stubEnv('NX_VERBOSE_LOGGING', undefined);
  vi.stubEnv('CI', 'true');
}

/** Runs `body` with output captured, and returns what was printed. */
async function capture(body: () => unknown): Promise<string[]> {
  const output = captureOutput();
  try {
    await body();
    return output.lines();
  } finally {
    output.restore();
  }
}

/** Runs the hook with output captured, and returns what it printed. */
async function run(
  options?: Parameters<typeof postTasksExecution>[0],
): Promise<string[]> {
  return capture(async () => {
    await expect(
      postTasksExecution(options, runContext([taskResult()])),
    ).resolves.toBeUndefined();
  });
}

beforeEach(() => {
  vi.stubEnv('NX_SELF_HOSTED_REMOTE_CACHE_SERVER', undefined);
  vi.stubEnv('NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN', undefined);
  vi.stubEnv('NX_CACHE_REPORTER', undefined);
  vi.stubEnv('NX_VERBOSE_LOGGING', undefined);
});

afterEach(async () => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  if (server) {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server?.close(() => resolve()));
    server = undefined;
  }
});

describe('postTasksExecution', () => {
  it('posts the report once to /v1/runs with the cache token as a bearer token', async () => {
    reportingEnv(await listen(accept));

    expect(await run()).toEqual([]);

    expect(received).toHaveLength(1);
    const request = received[0] as Received;
    expect(request.method).toBe('POST');
    expect(request.url).toBe('/v1/runs');
    expect(request.headers.authorization).toBe(`Bearer ${TOKEN}`);
    expect(request.headers['content-type']).toBe('application/json');
    expect(JSON.parse(request.body)).toEqual({
      runId: 'run-0f9c2a',
      startTime: 1_700_000_000_000,
      endTime: 1_700_000_002_000,
      ci: true,
      tasks: [
        {
          hash: '1234567890',
          project: 'shop',
          target: 'build',
          status: 'success',
          startTime: 1_700_000_000_000,
          endTime: 1_700_000_001_500,
          cacheable: true,
        },
      ],
    });
  });

  it('joins the path onto a server URL that ends in a slash', async () => {
    reportingEnv(`${await listen(accept)}/`);

    await run();

    expect(received.map((r) => r.url)).toEqual(['/v1/runs']);
  });

  it('posts to the server named in the plugin options over the environment', async () => {
    const url = await listen(accept);
    reportingEnv(await closedPort());

    expect(await run({ server: url })).toEqual([]);

    expect(received).toHaveLength(1);
  });

  it('posts nothing without the server variable', async () => {
    reportingEnv(await listen(accept));
    vi.stubEnv('NX_SELF_HOSTED_REMOTE_CACHE_SERVER', undefined);

    expect(await run()).toEqual([]);
    expect(received).toEqual([]);
  });

  it('posts nothing without the token variable', async () => {
    reportingEnv(await listen(accept));
    vi.stubEnv('NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN', undefined);

    expect(await run()).toEqual([]);
    expect(received).toEqual([]);
  });

  it('posts nothing when NX_CACHE_REPORTER is off', async () => {
    reportingEnv(await listen(accept));
    vi.stubEnv('NX_CACHE_REPORTER', 'off');

    expect(await run()).toEqual([]);
    expect(received).toEqual([]);
  });

  it('posts nothing when the plugin options disable it', async () => {
    reportingEnv(await listen(accept));

    expect(await run({ enabled: false })).toEqual([]);
    expect(received).toEqual([]);
  });

  it('resolves and prints nothing when the server answers 500', async () => {
    reportingEnv(
      await listen((_req, res) => {
        res.writeHead(500);
        res.end('boom');
      }),
    );

    expect(await run()).toEqual([]);
    expect(received).toHaveLength(1);
  });

  it('resolves and prints nothing when the connection is refused', async () => {
    reportingEnv(await closedPort());

    expect(await run()).toEqual([]);
  });

  it('resolves and prints nothing when the server URL is not a URL', async () => {
    reportingEnv('not a url');

    expect(await run()).toEqual([]);
  });

  it('resolves and prints nothing when the token cannot go in a header', async () => {
    reportingEnv(await listen(accept));
    vi.stubEnv('NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN', 'bad\ntoken');

    expect(await run()).toEqual([]);
    expect(received).toEqual([]);
  });

  it('resolves and prints nothing when the context is not what Nx sends', async () => {
    reportingEnv(await listen(accept));

    const lines = await capture(() =>
      expect(
        postTasksExecution(undefined, {} as never),
      ).resolves.toBeUndefined(),
    );

    expect(lines).toEqual([]);
    expect(received).toEqual([]);
  });

  it(`gives up after ${REPORT_TIMEOUT_MS} ms on a server that never answers`, async () => {
    reportingEnv(await listen(() => undefined));
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    let settled = false;
    let settledBeforeTimeout = true;

    const lines = await capture(async () => {
      const pending = Promise.resolve(
        postTasksExecution(undefined, runContext()),
      ).then(() => {
        settled = true;
      });
      await firstRequest;
      await vi.advanceTimersByTimeAsync(REPORT_TIMEOUT_MS - 1);
      settledBeforeTimeout = settled;
      await vi.advanceTimersByTimeAsync(1);
      await pending;
    });

    expect(settledBeforeTimeout).toBe(false);
    expect(settled).toBe(true);
    expect(lines).toEqual([]);
  });

  it('does not follow a redirect', async () => {
    reportingEnv(
      await listen((req, res) => {
        if (req.url === '/v1/runs') {
          res.writeHead(307, { location: '/elsewhere' });
          res.end();
        } else accept(req, res);
      }),
    );

    const lines = await run();

    expect(lines).toEqual([]);
    expect(received.map((r) => r.url)).toEqual(['/v1/runs']);
  });

  it('posts nothing when the run times cannot be recovered', async () => {
    reportingEnv(await listen(accept));

    const lines = await capture(() =>
      postTasksExecution(
        undefined,
        runContext([taskResult()], { startTime: 9_000, endTime: 8_000 }),
      ),
    );

    expect(lines).toEqual([]);
    expect(received).toEqual([]);
  });

  describe('with NX_VERBOSE_LOGGING=true', () => {
    beforeEach(() => vi.stubEnv('NX_VERBOSE_LOGGING', 'true'));

    it('prints one line naming the status when the server answers 500', async () => {
      reportingEnv(
        await listen((_req, res) => {
          res.writeHead(500);
          res.end();
        }),
      );
      vi.stubEnv('NX_VERBOSE_LOGGING', 'true');

      const lines = await run();

      expect(lines).toHaveLength(1);
      expect(lines[0]).toMatch(/nx-cache-reporter.*500/);
      expect(lines[0]).not.toContain(TOKEN);
    });

    it('prints one line when the connection is refused', async () => {
      reportingEnv(await closedPort());
      vi.stubEnv('NX_VERBOSE_LOGGING', 'true');

      const lines = await run();

      expect(lines).toHaveLength(1);
      expect(lines[0]).toMatch(/nx-cache-reporter.*ECONNREFUSED/);
      expect(lines[0]).not.toContain(TOKEN);
    });

    it('prints one line without the token when the token is malformed', async () => {
      reportingEnv(await listen(accept));
      vi.stubEnv('NX_VERBOSE_LOGGING', 'true');
      vi.stubEnv(
        'NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN',
        `${TOKEN}\nx-injected: 1`,
      );

      const lines = await run();

      expect(lines).toHaveLength(1);
      expect(lines[0]).not.toContain(TOKEN);
    });

    it('prints one line naming the timeout on a server that never answers', async () => {
      reportingEnv(await listen(() => undefined));
      vi.stubEnv('NX_VERBOSE_LOGGING', 'true');
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

      const lines = await capture(async () => {
        const pending = postTasksExecution(undefined, runContext());
        await firstRequest;
        await vi.advanceTimersByTimeAsync(REPORT_TIMEOUT_MS);
        await pending;
      });

      expect(lines).toHaveLength(1);
      expect(lines[0]).toMatch(/nx-cache-reporter.*timed out/);
    });

    it('prints one line with the counts the server accepted', async () => {
      reportingEnv(await listen(accept));
      vi.stubEnv('NX_VERBOSE_LOGGING', 'true');

      const lines = await run();

      expect(lines).toHaveLength(1);
      expect(lines[0]).toMatch(/nx-cache-reporter.*1 accepted, 0 skipped/);
      expect(lines[0]).not.toContain(TOKEN);
    });
  });
});
