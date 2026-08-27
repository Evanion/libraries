import { describe, it, expect, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { CORRELATION_CONFIG_TOKEN, CORRELATION_ID_HEADER } from './constants.js';
import { CorrelationService } from './correlation.service.js';

describe('CorrelationService', () => {
  const build = async (
    generator?: () => string,
  ): Promise<CorrelationService> => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CorrelationService,
        {
          provide: CORRELATION_CONFIG_TOKEN,
          useValue: { header: CORRELATION_ID_HEADER, generator },
        },
      ],
    }).compile();
    return module.resolve<CorrelationService>(CorrelationService);
  };

  let service: CorrelationService;

  beforeEach(async () => {
    service = await build(() => 'test-id');
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('uses the configured generator for the initial id', () => {
    expect(service.getCorrelationId()).toBe('test-id');
  });

  it('can have its correlation id replaced', () => {
    service.setCorrelationId('replaced');
    expect(service.getCorrelationId()).toBe('replaced');
  });

  it('falls back to a random uuid when no generator is configured', async () => {
    const fallback = await build(undefined);
    // Now node:crypto.randomUUID rather than the uuid package.
    expect(fallback.getCorrelationId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('gives each request scope its own id', async () => {
    const a = await build(undefined);
    const b = await build(undefined);
    expect(a.getCorrelationId()).not.toBe(b.getCorrelationId());
  });
});
