import { Inject, Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import { CORRELATION_CONFIG_TOKEN } from './constants.js';
// Must be `import type`: with isolatedModules and emitDecoratorMetadata,
// a type referenced in a decorated signature cannot be a value import.
import type { CorrelationConfig } from './interfaces/correlation-config.interface.js';

interface CorrelationStore {
  correlationId: string;
}

/**
 * A plain singleton over AsyncLocalStorage. AsyncLocalStorage gives per-request
 * isolation without Nest's request scope: request-scoping this provider would
 * propagate upward through the injection graph, making every provider that
 * depends on it -- including `HttpService`, via `withCorrelation` -- also
 * request-scoped: re-instantiated per request, and never given `onModuleInit`.
 */
@Injectable()
export class CorrelationService {
  private readonly storage = new AsyncLocalStorage<CorrelationStore>();

  constructor(
    @Inject(CORRELATION_CONFIG_TOKEN)
    private readonly correlationConfig: CorrelationConfig,
  ) {}

  /**
   * Runs `callback` in a correlation context. Everything it awaits, schedules
   * or calls sees `correlationId`, and overlapping contexts stay isolated.
   *
   * The middleware does this per request. Call it directly for work that has no
   * request behind it -- queue consumers, cron jobs, scripts.
   */
  run<T>(correlationId: string, callback: () => T): T {
    return this.storage.run({ correlationId }, callback);
  }

  /**
   * The id of the surrounding correlation context, or `undefined` when there is
   * none. Outside a context there is genuinely no correlation id, so this does
   * not invent one.
   */
  getCorrelationId(): string | undefined {
    return this.storage.getStore()?.correlationId;
  }

  /** Replaces the id of the surrounding correlation context. */
  setCorrelationId(correlationId: string): void {
    const store = this.storage.getStore();
    if (!store) {
      throw new Error(
        'setCorrelationId() was called outside a correlation context. Apply CorrelationIdMiddleware, or wrap the work in CorrelationService.run().',
      );
    }
    store.correlationId = correlationId;
  }

  /**
   * A fresh id from the configured generator. Called only when no usable id
   * arrived with the request, so a counter- or sequence-backed generator is not
   * advanced for ids that get discarded.
   */
  generate(): string {
    return this.correlationConfig.generator();
  }
}
