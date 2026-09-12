import { CorrelationService } from '@evanion/nestjs-correlation-id';
import { Controller, Get, Param } from '@nestjs/common';
import { TelemetryService } from '../telemetry/telemetry.service.js';
import { InventoryService } from './inventory.service.js';
import type { Stock } from './stock.model.js';

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
