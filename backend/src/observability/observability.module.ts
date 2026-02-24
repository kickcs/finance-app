import { Module } from '@nestjs/common';
import { MetricsModule } from './metrics/metrics.module';
import { LoggingModule } from './logging/logging.module';

@Module({
  imports: [MetricsModule, LoggingModule],
})
export class ObservabilityModule {}
