import { Controller, Post, Get, Body, Param, Res, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser, Public } from '../../../../common';
import {
  SharedDebtsService,
  type CreateSharedDebtsResult,
  type SharedDebtsPayload,
} from '../../application/services/shared-debts.service';
import { DebtsOgImageService } from '../../application/services/debts-og-image.service';
import { ShareDebtsDto } from '../dto/share-debts.dto';

/**
 * Живёт на отдельном префиксе, а не на `debts/...`: у `DebtsController` есть
 * `GET debts/:id`, и путь вида `debts/shared/<token>` он бы перехватил первым.
 */
@Controller('debt-shares')
export class SharedDebtsController {
  private readonly logger = new Logger(SharedDebtsController.name);

  constructor(
    private readonly sharedDebtsService: SharedDebtsService,
    private readonly ogImageService: DebtsOgImageService,
  ) {}

  @Post()
  async share(
    @CurrentUser('sub') userId: string,
    @Body() dto: ShareDebtsDto,
  ): Promise<CreateSharedDebtsResult> {
    return this.sharedDebtsService.create(userId, dto);
  }

  @Public()
  @Get(':token')
  async getShared(@Param('token') token: string): Promise<SharedDebtsPayload> {
    return this.sharedDebtsService.getByToken(token);
  }

  @Public()
  @Get(':token/og.png')
  async getOgImage(@Param('token') token: string, @Res() res: Response): Promise<void> {
    try {
      const buf = await this.ogImageService.getOgPng(token);
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.status(200).send(buf);
    } catch (error) {
      this.logger.debug(`OG image unavailable for debts token ${token}: ${String(error)}`);
      res.status(404).end();
    }
  }
}
