import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { HealthService, HealthCheckResult } from './health.service';

@ApiTags('Health')
@Controller('health')
@Public()
@SkipThrottle()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({
    status: 200,
    description: 'Application is healthy',
  })
  @ApiResponse({
    status: 503,
    description: 'Application is unhealthy',
  })
  async check(): Promise<HealthCheckResult> {
    const result = await this.healthService.check();
    if (result.status !== 'ok') {
      throw new HttpException(result, HttpStatus.SERVICE_UNAVAILABLE);
    }
    return result;
  }
}
