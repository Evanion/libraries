import { Global, Module } from '@nestjs/common';
import { TelemetryController } from './telemetry.controller.js';
import { TelemetryService } from './telemetry.service.js';

/**
 * Global so every feature module can inject TelemetryService without
 * importing this module itself -- imported once, here, in AppModule.
 */
@Global()
@Module({
  controllers: [TelemetryController],
  providers: [TelemetryService],
  exports: [TelemetryService],
})
export class TelemetryModule {}
