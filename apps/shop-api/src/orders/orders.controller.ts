import { Body, Controller, Post } from '@nestjs/common';
import { Requires } from '../acl/requires.decorator.js';
import type { CreateOrderRequest, OrderResult } from './cart.model.js';
import { OrdersService } from './orders.service.js';

/**
 * Single write endpoint: place an order against the in-memory catalogue and
 * stock. Delegates everything to OrdersService.
 *
 * `order.create` reads the subject's roles alone, so AclGuard decides it whole
 * and a subject without the `customer` role never reaches the handler.
 */
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  @Requires('order', 'create')
  create(@Body() request: CreateOrderRequest): Promise<OrderResult> {
    return this.orders.createOrder(request);
  }
}
