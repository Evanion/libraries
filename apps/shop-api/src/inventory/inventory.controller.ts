import { CorrelationService } from '@evanion/nestjs-correlation-id';
import { Controller, Get, Param } from '@nestjs/common';
import { Requires } from '../acl/requires.decorator.js';
import { SubjectService } from '../acl/subject.service.js';
import { TelemetryService } from '../telemetry/telemetry.service.js';
import { InventoryService } from './inventory.service.js';
import type { Stock } from './stock.model.js';

/**
 * The endpoint OrdersService's orders -> inventory hop calls, over real HTTP
 * via InventoryClient -- and the one a client can call directly.
 *
 * Returns the in-flight request's correlationId and subject id alongside the
 * stock record. That is what makes both observable on the two sides of the
 * network hop: a caller compares what it sent against what this endpoint saw.
 *
 * `@Requires('inventory', 'read')` makes this route decide for itself. The
 * orders hop already passed AclGuard on `POST /orders` before it dialled this
 * endpoint, and that decision counts for nothing here: a browser reaches this
 * route directly too, so the route re-evaluates and trusts no caller.
 */
@Controller('inventory')
export class InventoryController {
  constructor(
    private readonly inventory: InventoryService,
    private readonly telemetry: TelemetryService,
    private readonly correlationService: CorrelationService,
    private readonly subjects: SubjectService,
  ) {}

  @Get(':urn')
  @Requires('inventory', 'read')
  getStock(
    @Param('urn') urn: string,
  ): Stock & { correlationId?: string; subjectId?: string } {
    const stock = this.inventory.getStock(urn);
    this.telemetry.record('inventory', 'inventory.checked', { ...stock });
    return {
      ...stock,
      correlationId: this.correlationService.getCorrelationId(),
      subjectId: this.subjects.current()?.id,
    };
  }
}
