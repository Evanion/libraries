import { Controller, Get, Query } from '@nestjs/common';
import type { TelemetryEvent } from './telemetry-event.model.js';
import { TelemetryService } from './telemetry.service.js';

@Controller('telemetry')
export class TelemetryController {
  constructor(private readonly telemetry: TelemetryService) {}

  @Get()
  list(@Query('correlationId') correlationId?: string): TelemetryEvent[] {
    return correlationId
      ? this.telemetry.forCorrelationId(correlationId)
      : this.telemetry.list();
  }
}
