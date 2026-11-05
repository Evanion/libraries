# @evanion/nx-cache-reporter

An Nx plugin that reports each run's task timings to a self-hosted remote cache, so the cache can show how much time it saved.

After every `nx` run the plugin sends one request to the cache server's `POST /v1/runs` with each task's hash, project, target, status and start and end times. The server records how long each task took when it ran, and credits every later cache hit for the same hash with that duration. It authenticates with the token Nx already uses for the cache.

The plugin never fails or slows a run noticeably. It sends one request with a 5 second timeout, swallows every error, and prints nothing unless `NX_VERBOSE_LOGGING=true`.

## Installation

```bash
npm install --save-dev @evanion/nx-cache-reporter
```

The package is ESM only, has no runtime dependencies and needs Nx 21 or newer on Node 20.19 or 22.12 and newer.

Add it to `plugins` in `nx.json`:

```json
{
  "plugins": ["@evanion/nx-cache-reporter"]
}
```

## Configuration

The plugin reads the variables Nx reads for a self-hosted remote cache:

| Variable                                   | Use                                                           |
| ------------------------------------------ | ------------------------------------------------------------- |
| `NX_SELF_HOSTED_REMOTE_CACHE_SERVER`       | The cache server's base URL. The report goes to `/v1/runs`.   |
| `NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN` | Sent as `Authorization: Bearer <token>`. Read-only is enough. |
| `NX_CACHE_REPORTER`                        | `off` turns the plugin off for that run.                      |
| `NX_VERBOSE_LOGGING`                       | `true` prints one line saying whether the report was sent.    |
| `CI`                                       | `true` marks the run as a CI run.                             |

With either of the first two missing, the plugin does nothing.

Options in `nx.json` override the environment:

```json
{
  "plugins": [
    {
      "plugin": "@evanion/nx-cache-reporter",
      "options": { "server": "https://cache.example.com", "enabled": true }
    }
  ]
}
```

`server` replaces `NX_SELF_HOSTED_REMOTE_CACHE_SERVER`. `enabled: false` turns the plugin off for the workspace. The token is only read from the environment, so it never lands in a committed file.

## What is sent

```json
{
  "runId": "a8c7f0e2-…",
  "startTime": 1762300800000,
  "endTime": 1762300812000,
  "ci": true,
  "tasks": [
    {
      "hash": "12816047395739181520",
      "project": "shop",
      "target": "build",
      "status": "remote-cache",
      "startTime": 1762300800120,
      "endTime": 1762300800180,
      "cacheable": true
    }
  ]
}
```

`runId` is Nx's id for the run. Times are milliseconds since the epoch. `status` is one of `success`, `failure`, `local-cache`, `local-cache-kept-existing` or `remote-cache`.

The plugin sends nothing else. It leaves out terminal output, the command line, the target configuration name, the inputs behind each hash, and every file path, including the workspace root.

Tasks Nx skipped or stopped are left out, and so are tasks without a hash or start and end times. Tasks with a project or target name over 128 characters are left out. The server takes at most 5000 tasks and 1 MiB per report, and drops a second report with the same run id, so a run cannot be split. When a run goes over either limit, the plugin sends the first tasks in the order Nx lists them, up to the limit.

## Turning it off

- For one run: `NX_CACHE_REPORTER=off nx run-many -t build`.
- For the workspace: `"options": { "enabled": false }`, or remove the plugin from `nx.json`.

## License

MIT
