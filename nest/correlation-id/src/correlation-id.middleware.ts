import { Inject, Injectable, NestMiddleware } from '@nestjs/common';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { CORRELATION_CONFIG_TOKEN, DEFAULT_CORRELATION_ID_VALIDATOR } from './constants.js';
import { CorrelationService } from './correlation.service.js';
// Must be `import type`: with isolatedModules and emitDecoratorMetadata,
// a type referenced in a decorated signature cannot be a value import.
import type { CorrelationConfig } from './interfaces/correlation-config.interface.js';

/**
 * Node normalises repeated request headers into a single comma-joined string
 * for everything except set-cookie, which stays an array. Joining an array the
 * same way keeps both shapes on one code path -- and the default validator
 * rejects the result, which is the wanted behaviour for a duplicated
 * correlation id.
 */
const singleValue = (
  value: string | string[] | undefined,
): string | undefined => (Array.isArray(value) ? value.join(', ') : value);

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  constructor(
    private correlationService: CorrelationService,
    @Inject(CORRELATION_CONFIG_TOKEN)
    private correlationConfig: CorrelationConfig,
  ) {}

  use(
    req: IncomingMessage,
    res: ServerResponse,
    next: (error?: unknown) => void,
  ) {
    const {
      header,
      validate = DEFAULT_CORRELATION_ID_VALIDATOR,
    } = this.correlationConfig;
    const key = header.toLowerCase();
    const incoming = singleValue(req.headers[key]);
    // The generator runs only when nothing usable arrived, so a counter- or
    // sequence-backed generator is not advanced for an id that gets discarded.
    const correlationId =
      incoming && validate(incoming)
        ? incoming
        : this.correlationService.generate();

    if (!req.headers[key]) req.headers[key] = correlationId;
    // setHeader preserves the casing it is given, so the configured casing is
    // what goes out on the wire.
    if (res.getHeader(header) === undefined) res.setHeader(header, correlationId);

    // Everything downstream of next() -- guards, interceptors, the controller,
    // and anything they await -- runs inside this context.
    this.correlationService.run(correlationId, next);
  }
}
