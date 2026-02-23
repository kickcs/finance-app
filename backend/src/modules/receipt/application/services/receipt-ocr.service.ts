import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import type { ScanReceiptResponseDto } from '../../presentation/dto/scan-receipt-response.dto';

export type ScanResult = ScanReceiptResponseDto;

@Injectable()
export class ReceiptOcrService {
  private readonly logger = new Logger(ReceiptOcrService.name);
  private readonly openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async scanReceipt(imageBuffer: Buffer, mimeType: string): Promise<ScanResult> {
    const base64Image = imageBuffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64Image}`;

    const systemPrompt = `You are a receipt OCR assistant. Extract structured data from receipt images.
Return a JSON object with the following structure:
{
  "items": [
    {
      "name": "item name (string)",
      "quantity": number,
      "unitPrice": number (in smallest currency unit, e.g. 35000 for 35,000 UZS),
      "totalPrice": number (in smallest currency unit)
    }
  ],
  "totalAmount": number (in smallest currency unit),
  "currency": "3-letter ISO currency code (e.g. UZS, USD, RUB)",
  "date": "YYYY-MM-DD or null if not found",
  "storeName": "store/business name or null if not found"
}

Important rules:
- All prices must be in the smallest currency unit (e.g. tiyin for UZS, kopek for RUB, cent for USD)
- Handle Uzbek, Russian, and English receipts
- If quantity is not specified, use 1
- currency must always be a 3-letter ISO code
- Return only valid JSON, no markdown or extra text`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: dataUrl,
                detail: 'high',
              },
            },
            {
              type: 'text',
              text: 'Extract all receipt data from this image and return it as JSON.',
            },
          ],
        },
      ],
      max_tokens: 2048,
      temperature: 0,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OCR service');
    }

    this.logger.debug(`GPT-4o response: ${content}`);

    // Strip markdown code fences if present
    const jsonText = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

    const result = JSON.parse(jsonText) as ScanResult;

    if (!Array.isArray(result.items)) {
      throw new Error('Invalid OCR response: missing items array');
    }

    return result;
  }
}
