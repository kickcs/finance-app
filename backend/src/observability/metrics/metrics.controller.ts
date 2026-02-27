import { Controller, Get, Res } from '@nestjs/common';
import { PrometheusController } from '@willsoto/nestjs-prometheus';
import { Response } from 'express';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';

@Controller()
@Public()
@SkipThrottle()
export class PublicMetricsController extends PrometheusController {
  @Get()
  async index(@Res({ passthrough: true }) response: Response) {
    return super.index(response);
  }
}
