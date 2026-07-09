import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubscriptionModule } from '../subscription/subscription.module';
import { ReceiptController } from './presentation/controllers/receipt.controller';
import { SharedReceiptController } from './presentation/controllers/shared-receipt.controller';
import { SharePageController } from './presentation/controllers/share-page.controller';
import { ReceiptOcrService } from './application/services/receipt-ocr.service';
import { SharedReceiptService } from './application/services/shared-receipt.service';
import { OgImageService } from './application/services/og-image.service';
import { SharedReceiptOrmEntity } from './infrastructure/persistence/typeorm';

@Module({
  imports: [SubscriptionModule, TypeOrmModule.forFeature([SharedReceiptOrmEntity])],
  controllers: [ReceiptController, SharedReceiptController, SharePageController],
  providers: [ReceiptOcrService, SharedReceiptService, OgImageService],
})
export class ReceiptModule {}
