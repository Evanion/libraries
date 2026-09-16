import { describe, it, expect } from 'vitest';
import { Test } from '@nestjs/testing';
import {
  CORRELATION_CONFIG_TOKEN,
  CORRELATION_ID_HEADER,
  DEFAULT_CORRELATION_ID_VALIDATOR,
} from './constants.js';
import { CorrelationModule } from './correlation.module.js';
import { CorrelationService } from './correlation.service.js';
import type { CorrelationConfig } from './interfaces/correlation-config.interface.js';

const configOf = async (config?: Partial<CorrelationConfig>) => {
  const module = await Test.createTestingModule({
    imports: [CorrelationModule.forRoot(config)],
  }).compile();
  return {
    module,
    config: module.get<CorrelationConfig>(CORRELATION_CONFIG_TOKEN),
  };
};

describe('CorrelationModule', () => {
  it('registers itself globally, so one forRoot covers the application', () => {
    expect(CorrelationModule.forRoot().global).toBe(true);
  });

  it('exports the service and the config token', () => {
    const { exports: exported = [] } = CorrelationModule.forRoot();
    expect(exported).toContain(CorrelationService);
  });

  it('defaults the header, generator and validator', async () => {
    const { config } = await configOf();
    expect(config.header).toBe(CORRELATION_ID_HEADER);
    expect(config.validate).toBe(DEFAULT_CORRELATION_ID_VALIDATOR);
    expect(config.generator()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('keeps the configured header, generator and validator', async () => {
    const generator = () => 'mine';
    const validate = () => true;
    const { config } = await configOf({
      header: 'X-Request-Id',
      generator,
      validate,
    });
    expect(config.header).toBe('X-Request-Id');
    expect(config.generator).toBe(generator);
    expect(config.validate).toBe(validate);
  });

  it('provides CorrelationService as a singleton', async () => {
    const { module } = await configOf();
    expect(module.get(CorrelationService)).toBeInstanceOf(CorrelationService);
    expect(module.get(CorrelationService)).toBe(module.get(CorrelationService));
  });
});
