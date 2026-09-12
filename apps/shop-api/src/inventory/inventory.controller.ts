import { CorrelationService } from '@evanion/nestjs-correlation-id';
import { Controller, Get, Param } from '@nestjs/common';
import { TelemetryService } from '../telemetry/telemetry.service.js';
import { InventoryService } from './inventory.service.js';
import type { Stock } from './stock.model.js';

/**
 * The endpoint OrdersService's orders -> inventory hop calls, over real HTTP
 * via InventoryClient -- and the one a client can call directly.
 *
 * Returns the in-flight request's correlationId alongside the stock record.
 * That is what makes the id observable on both sides of the network hop: a
 * caller can compare the id it sent against the one this endpoint saw.
 */
@Controller('inventory')
export class InventoryController {
  constructor(
    private readonly inventory: InventoryService,
    private readonly telemetry: TelemetryService,
    private readonly correlationService: CorrelationService,
  ) {}

  @Get(':urn')
  getStock(@Param('urn') urn: string): Stock & { correlationId?: string } {
    const stock = this.inventory.getStock(urn);
    this.telemetry.record('inventory', 'inventory.checked', { ...stock });
    return { ...stock, correlationId: this.correlationService.getCorrelationId() };
  }
}
