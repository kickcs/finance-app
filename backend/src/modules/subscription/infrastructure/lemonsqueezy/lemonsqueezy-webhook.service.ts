import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

export interface LemonSqueezyWebhookEvent {
  meta: {
    event_name: string;
    custom_data?: { user_id?: string };
  };
  data: {
    id: string;
    type: string;
    attributes: {
      store_id: number;
      customer_id: number;
      variant_id: number;
      status: string;
      trial_ends_at: string | null;
      renews_at: string | null;
      ends_at: string | null;
      created_at: string;
      updated_at: string;
    };
  };
}

@Injectable()
export class LemonSqueezyWebhookService {
  private readonly webhookSecret: string;

  constructor(private readonly configService: ConfigService) {
    this.webhookSecret = this.configService.getOrThrow<string>('LEMONSQUEEZY_WEBHOOK_SECRET');
  }

  verifySignature(rawBody: Buffer, signature: string): boolean {
    const hmac = crypto.createHmac('sha256', this.webhookSecret);
    const digest = hmac.update(rawBody).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
  }

  parseEvent(rawBody: Buffer): LemonSqueezyWebhookEvent {
    return JSON.parse(rawBody.toString()) as LemonSqueezyWebhookEvent;
  }
}
