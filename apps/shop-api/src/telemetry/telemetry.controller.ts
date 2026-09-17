import { Controller, Get, Query } from '@nestjs/common';
import { Requires } from '../acl/requires.decorator.js';
import type { TelemetryEvent } from './telemetry-event.model.js';
import { TelemetryService } from './telemetry.service.js';

/**
 * Read access to the events TelemetryService has recorded, across every
 * source (games, inventory, orders) in this process.
 *
 * Filtering by correlationId is how one request's cross-service trail --
 * e.g. an order and the inventory checks it triggered -- comes back as a
 * single list.
 *
 * `telemetry.read` names the `manager` role and reads nothing off a row, so
 * AclGuard decides it whole and a customer never reaches the handler.
 */
@Controller('telemetry')
export class TelemetryController {
  constructor(private readonly telemetry: TelemetryService) {}

  @Get()
  @Requires('telemetry', 'read')
  list(@Query('correlationId') correlationId?: string): TelemetryEvent[] {
    return correlationId
      ? this.telemetry.forCorrelationId(correlationId)
      : this.telemetry.list();
  }
}
