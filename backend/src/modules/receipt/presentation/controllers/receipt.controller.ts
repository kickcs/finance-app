import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../../../../common';
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

const MAX_RECEIPT_IMAGES = 3;

@Controller('receipts')
export class ReceiptController {
  private readonly logger = new Logger(ReceiptController.name);

  constructor(private readonly ocrService: ReceiptOcrService) {}

  @Post('scan')
  @UseInterceptors(
    FilesInterceptor('image', MAX_RECEIPT_IMAGES, {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per file
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
    @UploadedFiles() files: MulterFile[] | undefined,
    @CurrentUser('sub') userId: string,
  ): Promise<ScanReceiptResponseDto> {
    if (!files || files.length === 0) {
      throw new BadRequestException('At least one image file is required');
    }
    if (files.length > MAX_RECEIPT_IMAGES) {
      throw new BadRequestException(`At most ${MAX_RECEIPT_IMAGES} image files are allowed`);
    }

    this.logger.log(
      `User ${userId} scanning receipt (${files.length} file(s), ${files
        .map((f) => f.size)
        .join('+')} bytes)`,
    );

    try {
      return await this.ocrService.scanReceipt(
        files.map((f) => ({ buffer: f.buffer, mimetype: f.mimetype })),
      );
    } catch (error) {
      this.logger.error(`OCR failed for user ${userId}: ${String(error)}`);
      throw new InternalServerErrorException('Failed to process receipt image');
    }
  }
}
