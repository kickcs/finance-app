import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../../../../common';
import { PremiumGuard } from '../../../subscription/guards/premium.guard';
import { ReceiptOcrService } from '../../application/services/receipt-ocr.service';
import type { ScanReceiptResponseDto } from '../dto/scan-receipt-response.dto';

interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Controller('receipts')
export class ReceiptController {
  private readonly logger = new Logger(ReceiptController.name);

  constructor(private readonly ocrService: ReceiptOcrService) {}

  @Post('scan')
  @UseGuards(PremiumGuard)
  @UseInterceptors(
    FileInterceptor('image', {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
      fileFilter: (_req, file, callback) => {
        if (!file.mimetype.startsWith('image/')) {
          callback(new BadRequestException('Only image files are allowed'), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  async scanReceipt(
    @UploadedFile() file: MulterFile | undefined,
    @CurrentUser('sub') userId: string,
  ): Promise<ScanReceiptResponseDto> {
    if (!file) {
      throw new BadRequestException('Image file is required');
    }

    this.logger.log(`User ${userId} scanning receipt (${file.originalname}, ${file.size} bytes)`);

    try {
      return await this.ocrService.scanReceipt(file.buffer, file.mimetype);
    } catch (error) {
      this.logger.error(`OCR failed for user ${userId}: ${String(error)}`);
      throw new InternalServerErrorException('Failed to process receipt image');
    }
  }
}
