import { CorrelationService } from '@evanion/nestjs-correlation-id';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { OrderURN } from '../domain/order.urn.js';
import { TelemetryService } from '../telemetry/telemetry.service.js';
import type { CartItem, CreateOrderRequest, OrderResult } from './cart.model.js';
import { InventoryClient } from './inventory-client.service.js';

/**
 * A stubbed checkout: validates cart items against live stock over a real
 * HTTP hop to InventoryClient, then returns a confirmed OrderResult with a
 * freshly minted OrderURN.
 *
 * It does not decrement stock, charge anything, or persist the order
 * anywhere -- STOCK and GAMES_CATALOGUE are unchanged by a successful call,
 * and the returned order does not exist once the response is sent. There is
 * nothing here that would stop the same cart from being ordered twice.
 */
@Injectable()
export class OrdersService {
  constructor(
    private readonly inventoryClient: InventoryClient,
    private readonly telemetry: TelemetryService,
    private readonly correlationService: CorrelationService,
  ) {}

  async createOrder(request: CreateOrderRequest): Promise<OrderResult> {
    if (!request.items || request.items.length === 0) {
      throw new BadRequestException('Cart must contain at least one item');
    }

    this.telemetry.record('orders', 'order.requested', {
      items: request.items,
    });

    const checks = await Promise.all(
      request.items.map(async (item) => ({
        item,
        stock: await this.checkStock(item),
      })),
    );

    const shortages = checks.filter(
      ({ item, stock }) => stock.quantity < item.quantity,
    );

    if (shortages.length > 0) {
      const urns = shortages.map(({ item }) => item.urn);
      this.telemetry.record('orders', 'order.rejected', {
        reason: 'insufficient_stock',
        urns,
      });
      throw new BadRequestException(`Insufficient stock for: ${urns.join(', ')}`);
    }

    const orderUrn = OrderURN.stringify(randomBytes(3).toString('hex'));
    this.telemetry.record('orders', 'order.confirmed', { urn: orderUrn });

    return {
      urn: orderUrn,
      items: request.items,
      correlationId: this.correlationService.getCorrelationId(),
      inventoryCorrelationIds: checks.map(({ stock }) => stock.correlationId),
    };
  }

  /** A urn with no inventory record is a bad request, not a 404: the client
   * asked to order something that does not exist in the catalogue. */
  private async checkStock(
    item: CartItem,
  ): Promise<{ quantity: number; correlationId?: string }> {
    try {
      return await this.inventoryClient.getStock(item.urn);
    } catch (error) {
      if (error instanceof NotFoundException) {
        this.telemetry.record('orders', 'order.rejected', {
          reason: 'unknown_game',
          urn: item.urn,
        });
        throw new BadRequestException(`Unknown game: ${item.urn}`);
      }
      throw error;
    }
  }
}
