import { Inject, Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response } from 'express';
import { CORRELATION_CONFIG_TOKEN, DEFAULT_CORRELATION_ID_VALIDATOR } from './constants.js';
import { CorrelationService } from './correlation.service.js';
// Must be `import type`: with isolatedModules and emitDecoratorMetadata,
// a type referenced in a decorated signature cannot be a value import.
import type { CorrelationConfig } from './interfaces/correlation-config.interface.js';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  constructor(
    private correlationService: CorrelationService,
    @Inject(CORRELATION_CONFIG_TOKEN)
    private correlationConfig: CorrelationConfig,
  ) {}
  use(req: Request, res: Response, next: () => void) {
    const {
      header,
      validate = DEFAULT_CORRELATION_ID_VALIDATOR,
    } = this.correlationConfig;
    const key = header.toLowerCase();
    const incoming = req.get(header);
    const generated = this.correlationService.getCorrelationId();
    const correlationId = incoming && validate(incoming) ? incoming : generated;

    if (!req.headers[key]) req.headers[key] = correlationId;
    if (!res.get(header)) res.set(header, correlationId);

    this.correlationService.setCorrelationId(correlationId);
    next();
  }
}
