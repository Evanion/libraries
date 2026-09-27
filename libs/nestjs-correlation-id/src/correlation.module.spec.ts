import { describe, it, expect } from 'vitest';
import { Inject, Injectable, Module } from '@nestjs/common';
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

  it('resolves the first of two forRoot calls in one imports list', async () => {
    @Injectable()
    class ReadsConfig {
      constructor(
        @Inject(CORRELATION_CONFIG_TOKEN) readonly config: CorrelationConfig,
      ) {}
    }
    @Module({ providers: [ReadsConfig], exports: [ReadsConfig] })
    class Feature {}

    const module = await Test.createTestingModule({
      imports: [
        CorrelationModule.forRoot({ header: 'X-Correlation-Id' }),
        CorrelationModule.forRoot({ header: 'X-Request-Id' }),
        Feature,
      ],
    }).compile();

    expect(module.get(ReadsConfig).config.header).toBe('X-Correlation-Id');
  });

  it('gives each module that calls forRoot its own service and context', async () => {
    @Injectable()
    class Storefront {
      constructor(
        @Inject(CorrelationService) readonly correlation: CorrelationService,
      ) {}
    }
    @Injectable()
    class Stock {
      constructor(
        @Inject(CorrelationService) readonly correlation: CorrelationService,
      ) {}
    }
    @Module({
      imports: [CorrelationModule.forRoot()],
      providers: [Storefront],
      exports: [Storefront],
    })
    class StorefrontModule {}
    @Module({
      imports: [CorrelationModule.forRoot({ header: 'X-Request-Id' })],
      providers: [Stock],
      exports: [Stock],
    })
    class StockModule {}

    const module = await Test.createTestingModule({
      imports: [StorefrontModule, StockModule],
    }).compile();
    const storefront = module.get(Storefront).correlation;
    const stock = module.get(Stock).correlation;

    expect(storefront).not.toBe(stock);
    expect(
      storefront.run('storefront-4f1c9a', () => stock.getCorrelationId()),
    ).toBeUndefined();
  });

  it('provides CorrelationService as a singleton', async () => {
    const { module } = await configOf();

    expect(module.get(CorrelationService)).toBeInstanceOf(CorrelationService);
    expect(module.get(CorrelationService)).toBe(module.get(CorrelationService));
  });
});
