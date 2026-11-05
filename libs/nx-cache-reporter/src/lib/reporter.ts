import type {
  PostTasksExecution,
  PostTasksExecutionContext,
} from './nx-types.js';
import { buildReport } from './report.js';

/** The plugin name Nx shows in its plugin listings and errors. */
export const name = '@evanion/nx-cache-reporter';

/** How long the report may take, request and response together. */
export const REPORT_TIMEOUT_MS = 5000;

/** The `options` object of the plugin's entry in `nx.json`. */
export interface ReporterOptions {
  /**
   * The cache server's base URL. Defaults to
   * `NX_SELF_HOSTED_REMOTE_CACHE_SERVER`, the variable Nx reads for the cache.
   */
  server?: string;
  /** `false` turns the reporter off for the workspace. */
  enabled?: boolean;
}

type Env = Record<string, string | undefined>;

/** A failure the reporter describes in its own words, never the token. */
class ReportError extends Error {}

/** Visible ASCII, which is every character a header value may hold. */
const HEADER_VALUE = /^[\x21-\x7e]+$/;

function endpoint(server: string): URL {
  let base: URL;
  try {
    base = new URL(server.endsWith('/') ? server : `${server}/`);
  } catch {
    throw new ReportError('the server URL is not a valid URL');
  }
  if (base.protocol !== 'https:' && base.protocol !== 'http:') {
    throw new ReportError('the server URL is not http or https');
  }
  return new URL('v1/runs', base);
}

/** Why the request failed, from what Node attaches, without its message. */
function describe(error: unknown, signal: AbortSignal): string {
  if (error instanceof ReportError) return error.message;
  if (signal.aborted) return `timed out after ${REPORT_TIMEOUT_MS} ms`;

  // fetch rejects with a TypeError whose `cause` carries the socket error
  // code. The messages themselves are left out: a header error quotes the
  // header value, and the header value is the token.
  const cause = (error as { cause?: { code?: unknown } } | null)?.cause;
  const code =
    typeof cause?.code === 'string'
      ? cause.code
      : error instanceof Error
        ? error.name
        : typeof error;
  return code;
}

async function acceptedCounts(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as {
      accepted?: unknown;
      skipped?: unknown;
    };
    if (typeof body.accepted === 'number' && typeof body.skipped === 'number') {
      return `${body.accepted} accepted, ${body.skipped} skipped`;
    }
  } catch {
    // A 2xx whose body is not the server's JSON still means it was taken.
  }
  return `HTTP ${response.status}`;
}

/** Sends the report and returns the line verbose logging prints on success. */
async function send(
  options: ReporterOptions | undefined,
  context: PostTasksExecutionContext,
  env: Env,
  signal: AbortSignal,
): Promise<string | undefined> {
  if (options?.enabled === false || env['NX_CACHE_REPORTER'] === 'off') {
    return undefined;
  }
  const server = options?.server || env['NX_SELF_HOSTED_REMOTE_CACHE_SERVER'];
  const token = env['NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN'];
  if (!server || !token) return undefined;

  const url = endpoint(server);
  if (!HEADER_VALUE.test(token)) {
    throw new ReportError('the access token is not a valid header value');
  }

  const report = buildReport(context, env);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(report),
    signal,
  });

  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    throw new ReportError(`the server answered ${response.status}`);
  }
  const count = report.tasks.length;
  return `reported ${count} ${count === 1 ? 'task' : 'tasks'}: ${await acceptedCounts(response)}`;
}

/**
 * Posts the run's task timings to the cache server's `/v1/runs`.
 *
 * It sends one request, gives it {@link REPORT_TIMEOUT_MS}, and resolves
 * whatever happens: a reporter that fails a build, or prints into its output,
 * costs more than the statistics are worth. With `NX_VERBOSE_LOGGING=true` it
 * prints one line saying what happened.
 */
export const postTasksExecution: PostTasksExecution<ReporterOptions> = async (
  options,
  context,
) => {
  const env: Env = process.env;
  const verbose = env['NX_VERBOSE_LOGGING'] === 'true';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REPORT_TIMEOUT_MS);

  try {
    const outcome = await send(options, context, env, controller.signal);
    if (verbose && outcome) console.error(`[${name}] ${outcome}`);
  } catch (error) {
    if (verbose) {
      console.error(
        `[${name}] report not sent: ${describe(error, controller.signal)}`,
      );
    }
  } finally {
    clearTimeout(timer);
  }
};
