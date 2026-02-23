import { Module } from '@nestjs/common';
import { SubscriptionModule } from '../subscription/subscription.module';
import { ReceiptController } from './presentation/controllers/receipt.controller';
import { ReceiptOcrService } from './application/services/receipt-ocr.service';

@Module({
  imports: [SubscriptionModule],
  controllers: [ReceiptController],
  providers: [ReceiptOcrService],
})
export class ReceiptModule {}
