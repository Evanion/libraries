import { Body, Controller, Post } from '@nestjs/common';
import type { CreateOrderRequest, OrderResult } from './cart.model.js';
import { OrdersService } from './orders.service.js';

@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  create(@Body() request: CreateOrderRequest): Promise<OrderResult> {
    return this.orders.createOrder(request);
  }
}
