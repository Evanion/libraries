import { Test } from '@nestjs/testing';
import { describe, expect, it, vi } from 'vitest';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';
import type { OrderResult } from './cart.model.js';

describe('OrdersController', () => {
  it('delegates cart validation to OrdersService and returns its result', async () => {
    const result: OrderResult = {
      urn: 'urn:order:abc123',
      items: [{ urn: 'urn:game:wingspan', quantity: 1 }],
      correlationId: 'req-1',
      inventoryCorrelationIds: ['req-1'],
    };
    const createOrder = vi.fn().mockResolvedValue(result);
    const module = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [{ provide: OrdersService, useValue: { createOrder } }],
    }).compile();
    const controller = module.get(OrdersController);

    const request = { items: [{ urn: 'urn:game:wingspan', quantity: 1 }] };
    const response = await controller.create(request);

    expect(createOrder).toHaveBeenCalledWith(request);
    expect(response).toBe(result);
  });
});
