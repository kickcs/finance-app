import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { Request } from 'express';
import { CurrentUser, Public } from '../../../../common';
import { CreateCheckoutDto } from '../dto/create-checkout.dto';
import { CreateCheckoutCommand } from '../../application/commands';
import { HandleWebhookCommand } from '../../application/commands';
import { GetSubscriptionStatusQuery } from '../../application/queries';

@Controller('subscription')
export class SubscriptionController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get('status')
  async getStatus(@CurrentUser('sub') userId: string) {
    return this.queryBus.execute(new GetSubscriptionStatusQuery(userId));
  }

  @Post('checkout')
  async createCheckout(
    @CurrentUser() user: { sub: string; email?: string },
    @Body() dto: CreateCheckoutDto,
  ) {
    return this.commandBus.execute(
      new CreateCheckoutCommand(user.sub, user.email ?? '', '', dto.plan),
    );
  }

  @Public()
  @Post('webhooks/lemonsqueezy')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Req() req: Request) {
    const signature = req.headers['x-signature'] as string;
    if (!signature) return { received: false };

    await this.commandBus.execute(
      new HandleWebhookCommand((req as any).rawBody, signature),
    );

    return { received: true };
  }
}
