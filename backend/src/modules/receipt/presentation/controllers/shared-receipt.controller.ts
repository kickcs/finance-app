import { Controller, Post, Get, Body, Param, Res, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser, Public } from '../../../../common';
import {
  SharedReceiptService,
  type CreateSharedReceiptResult,
  type SharedReceiptPayload,
} from '../../application/services/shared-receipt.service';
import { OgImageService } from '../../application/services/og-image.service';
import { ShareReceiptDto } from '../dto/share-receipt.dto';

@Controller('receipts')
export class SharedReceiptController {
  private readonly logger = new Logger(SharedReceiptController.name);

  constructor(
    private readonly sharedReceiptService: SharedReceiptService,
    private readonly ogImageService: OgImageService,
  ) {}

  @Post('share')
  async share(
    @CurrentUser('sub') userId: string,
    @Body() dto: ShareReceiptDto,
  ): Promise<CreateSharedReceiptResult> {
    return this.sharedReceiptService.create(userId, dto);
  }

  @Public()
  @Get('shared/:token')
  async getShared(@Param('token') token: string): Promise<SharedReceiptPayload> {
    return this.sharedReceiptService.getByToken(token);
  }

  @Public()
  @Get('shared/:token/og.png')
  async getOgImage(@Param('token') token: string, @Res() res: Response): Promise<void> {
    try {
      const buf = await this.ogImageService.getOgPng(token);
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.status(200).send(buf);
    } catch (error) {
      this.logger.debug(`OG image unavailable for token ${token}: ${String(error)}`);
      res.status(404).end();
    }
  }
}
