import { Inject, Injectable, Scope } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { CORRELATION_CONFIG_TOKEN } from './constants.js';
// Must be `import type`: with isolatedModules and emitDecoratorMetadata,
// a type referenced in a decorated signature cannot be a value import.
import type { CorrelationConfig } from './interfaces/correlation-config.interface.js';

@Injectable({ scope: Scope.REQUEST })
export class CorrelationService {
  private correlationId: string;

  constructor(
    @Inject(CORRELATION_CONFIG_TOKEN) correlationConfig: CorrelationConfig,
  ) {
    this.correlationId = correlationConfig.generator
      ? correlationConfig.generator()
      : randomUUID();
  }

  getCorrelationId(): string {
    return this.correlationId;
  }
  setCorrelationId(correlationId: string): void {
    this.correlationId = correlationId;
  }
}
