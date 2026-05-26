import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { Request } from 'express';
import { SkipThrottle } from '@nestjs/throttler';
import { CurrentUser, Public } from '../../../../common';
import { CreateCheckoutDto } from '../dto/create-checkout.dto';
import { VerifyIapReceiptDto } from '../dto/verify-iap-receipt.dto';
import { CreateCheckoutCommand } from '../../application/commands';
import { HandleWebhookCommand } from '../../application/commands';
import { VerifyIapReceiptCommand } from '../../application/commands';
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

  @Post('iap/verify-receipt')
  @HttpCode(HttpStatus.OK)
  async verifyIapReceipt(
    @CurrentUser('sub') userId: string,
    @Body() dto: VerifyIapReceiptDto,
  ): Promise<{ verified: boolean }> {
    await this.commandBus.execute<VerifyIapReceiptCommand, void>(
      new VerifyIapReceiptCommand(
        userId,
        dto.platform,
        dto.productId,
        dto.transactionId,
        dto.receipt,
      ),
    );
    return { verified: true };
  }

  // Apple App Store Server Notifications V2 — JWS-signed payloads delivered
  // out-of-band. Without JWS verification (Apple root CA chain) we MUST NOT
  // mutate subscription state from this endpoint. Tracked as Phase 4 follow-up.
  @Public()
  @SkipThrottle()
  @Post('iap/webhooks/apple')
  @HttpCode(HttpStatus.OK)
  handleAppleWebhook(): { received: boolean } {
    throw new ServiceUnavailableException(
      'Apple App Store Server Notifications endpoint not yet implemented (Task 59 follow-up)',
    );
  }

  // Google Real-time Developer Notifications — delivered via Pub/Sub push.
  // Authentication is via OIDC token issued by Google for the Pub/Sub
  // subscriber service account. Without that verification the endpoint is
  // a wide-open premium-activator, so we refuse until it's wired.
  @Public()
  @SkipThrottle()
  @Post('iap/webhooks/google')
  @HttpCode(HttpStatus.OK)
  handleGoogleWebhook(): { received: boolean } {
    throw new ServiceUnavailableException(
      'Google RTDN endpoint not yet implemented (Task 59 follow-up)',
    );
  }
}
