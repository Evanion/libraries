import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { setTimeout as delay } from 'node:timers/promises';
import { CORRELATION_CONFIG_TOKEN, CORRELATION_ID_HEADER } from './constants.js';
import { CorrelationService } from './correlation.service.js';

describe('CorrelationService', () => {
  const build = async (
    generator: () => string = () => 'test-id',
  ): Promise<{ module: TestingModule; service: CorrelationService }> => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CorrelationService,
        {
          provide: CORRELATION_CONFIG_TOKEN,
          useValue: { header: CORRELATION_ID_HEADER, generator },
        },
      ],
    }).compile();
    return { module, service: module.get(CorrelationService) };
  };

  let service: CorrelationService;

  beforeEach(async () => {
    ({ service } = await build());
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('is a singleton, so module.get resolves it without a context id', async () => {
    const { module } = await build();
    expect(module.get(CorrelationService)).toBe(module.get(CorrelationService));
  });

  it('has no correlation id outside a correlation context', () => {
    expect(service.getCorrelationId()).toBeUndefined();
  });

  it('exposes the id of the surrounding context', () => {
    service.run('abc', () => {
      expect(service.getCorrelationId()).toBe('abc');
    });
  });

  it('returns the callback result from run', () => {
    expect(service.run('abc', () => 42)).toBe(42);
  });

  it('does not leak the id past the end of the context', () => {
    service.run('abc', () => undefined);
    expect(service.getCorrelationId()).toBeUndefined();
  });

  it('keeps overlapping asynchronous contexts isolated', async () => {
    const seen: string[] = [];
    const work = async (id: string, ms: number) =>
      service.run(id, async () => {
        await delay(ms);
        seen.push(service.getCorrelationId() ?? 'missing');
      });

    await Promise.all([work('slow', 30), work('fast', 1)]);

    expect(seen.sort()).toEqual(['fast', 'slow']);
  });

  it('can have the id of the current context replaced', () => {
    service.run('abc', () => {
      service.setCorrelationId('replaced');
      expect(service.getCorrelationId()).toBe('replaced');
    });
  });

  it('refuses to set an id outside a correlation context', () => {
    expect(() => service.setCorrelationId('orphan')).toThrow(
      /outside a correlation context/,
    );
  });

  it('generates an id from the configured generator', () => {
    expect(service.generate()).toBe('test-id');
  });

  it('does not call the generator until generate is asked for one', async () => {
    const generator = vi.fn(() => 'lazy');
    const { service: lazy } = await build(generator);

    expect(generator).not.toHaveBeenCalled();
    lazy.run('supplied-by-caller', () => undefined);
    expect(generator).not.toHaveBeenCalled();

    expect(lazy.generate()).toBe('lazy');
    expect(generator).toHaveBeenCalledTimes(1);
  });
});
