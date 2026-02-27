import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { Request } from 'express';
import { SkipThrottle } from '@nestjs/throttler';
import { CurrentUser, Public } from '../../../../common';
import { CreateCheckoutDto } from '../dto/create-checkout.dto';
import { CreateCheckoutCommand } from '../../application/commands';
import { HandleWebhookCommand } from '../../application/commands';
import { GetSubscriptionStatusQuery } from '../../application/queries';
import { type SubscriptionStatusResponse } from '../../application/queries/get-subscription-status/get-subscription-status.handler';

interface RequestWithRawBody extends Request {
  rawBody?: Buffer;
}

@Controller('subscription')
export class SubscriptionController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get('status')
  async getStatus(@CurrentUser('sub') userId: string): Promise<SubscriptionStatusResponse> {
    return this.queryBus.execute<GetSubscriptionStatusQuery, SubscriptionStatusResponse>(
      new GetSubscriptionStatusQuery(userId),
    );
  }

  @Post('checkout')
  async createCheckout(
    @CurrentUser() user: { sub: string; email?: string },
    @Body() dto: CreateCheckoutDto,
  ): Promise<{ checkoutUrl: string }> {
    return this.commandBus.execute<CreateCheckoutCommand, { checkoutUrl: string }>(
      new CreateCheckoutCommand(user.sub, user.email, dto.plan),
    );
  }

  @Public()
  @SkipThrottle()
  @Post('webhooks/lemonsqueezy')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Req() req: RequestWithRawBody): Promise<{ received: boolean }> {
    const signature = req.headers['x-signature'] as string | undefined;
    if (!signature) throw new UnauthorizedException('Missing X-Signature header');

    await this.commandBus.execute<HandleWebhookCommand, void>(
      new HandleWebhookCommand(req.rawBody ?? Buffer.alloc(0), signature),
    );

    return { received: true };
  }
}
