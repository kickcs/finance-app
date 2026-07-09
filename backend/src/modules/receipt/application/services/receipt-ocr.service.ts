import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import type { ChatCompletionContentPart } from 'openai/resources/chat/completions';
import type { ScanReceiptResponseDto } from '../../presentation/dto/scan-receipt-response.dto';

export type ScanResult = ScanReceiptResponseDto;

export interface ReceiptImageInput {
  buffer: Buffer;
  mimetype: string;
}

@Injectable()
export class ReceiptOcrService {
  private readonly logger = new Logger(ReceiptOcrService.name);
  private readonly openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async scanReceipt(files: ReceiptImageInput[]): Promise<ScanResult> {
    const imageParts: ChatCompletionContentPart[] = files.map((file) => {
      const base64Image = file.buffer.toString('base64');
      const dataUrl = `data:${file.mimetype};base64,${base64Image}`;
      return {
        type: 'image_url',
        image_url: {
          url: dataUrl,
          detail: 'high',
        },
      };
    });

    const multiImageNote =
      files.length > 1
        ? `

MULTIPLE IMAGES:
The images provided are overlapping segments of ONE long receipt, photographed in parts from top to bottom. Merge them into a single unified list of items — do not duplicate lines that appear in more than one segment (the segments overlap at the seams). Read the store name, date, totals, and charges from whichever segment shows them (usually the first segment for the header, the last for the final total).`
        : '';

    const systemPrompt = `You are a receipt OCR assistant. Extract structured data from receipt images.${multiImageNote}

CRITICAL — NUMBER READING:
- Receipts use spaces as thousand separators: "134 000" = 134000, "50 000" = 50000, "18 000" = 18000
- Columns are: Name | Quantity | Sum. The quantity is a SMALL number (1, 2, 3). The sum is a LARGE number (thousands or more)
- NEVER merge the quantity digit into the sum. Example: "Нон  2  18 000" → qty=2, totalPrice=18000 (NOT qty=2, totalPrice=218000)
- UZS prices are typically 1,000–500,000. If a unitPrice is under 100 UZS, you likely dropped "000"

STEP-BY-STEP PROCESS:
1. Find the FINAL total at the bottom ("ИТОГО К ОПЛАТЕ", "ИТОГО", "Total", "Grand Total") → "totalAmount"
2. Check for additional charges (service, НДС, VAT, tax, tips) between subtotal and final total. Extract EXACTLY as written: a percentage → "serviceChargePercent"; a flat amount → "serviceChargeAmount". Never convert between them.
3. Calculate subtotal: subtotal = totalAmount − serviceChargeAmount (if any) − round(subtotal × serviceChargePercent / 100) (if any). Otherwise subtotal = totalAmount.
4. Extract each item: name, quantity (from "Кол-во" column), and LINE TOTAL (from "Сумма" column) → totalPrice. Then unitPrice = totalPrice / quantity
5. VERIFY: sum of all totalPrice must equal subtotal (step 3). If not, re-read the receipt carefully — you likely misread a number

Return JSON:
{
  "items": [
    {
      "name": "item name",
      "quantity": number,
      "unitPrice": number (= totalPrice / quantity),
      "totalPrice": number (line total from "Сумма" column)
    }
  ],
  "totalAmount": number (FINAL total at the bottom),
  "serviceChargePercent": number or null,
  "serviceChargeAmount": number or null,
  "currency": "3-letter ISO code (e.g. UZS, USD, RUB)",
  "date": "YYYY-MM-DD or null",
  "storeName": "store name or null",
  "hashtags": ["#tag1", "#tag2"]
}

Rules:
- All prices: whole numbers, no decimals (e.g. 35000 for "35 000")
- Handle Uzbek, Russian, English receipts
- If quantity not specified, use 1
- Do NOT include charges/taxes/VAT as items. Extract them into "serviceChargePercent" or "serviceChargeAmount":
  - "Обслуживание 10%" → serviceChargePercent: 10
  - "НДС +12%" → serviceChargePercent: 12
  - "VAT 15%" → serviceChargePercent: 15
  - "Сервисный сбор 7 990 СУМ" / "Service fee 7990 UZS" → serviceChargeAmount: 7990
  - "Чаевые 5 000" → serviceChargeAmount: 5000
- Use whichever form the receipt actually shows. If the receipt only shows a flat amount, return serviceChargeAmount and leave serviceChargePercent null. If only a percent is shown, return serviceChargePercent and leave serviceChargeAmount null. Never compute one from the other.
- If a single line is ambiguous (e.g. "10% (5000)") prefer the percent.
- No charges found → both serviceChargePercent and serviceChargeAmount: null
- "hashtags": 1-3 short Russian hashtags for the PLACE TYPE and WHAT was bought (e.g. restaurant → ["#кафе", "#обед"], grocery → ["#продукты"]). Lowercase, no spaces
- Return only valid JSON, no markdown`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: [
            ...imageParts,
            {
              type: 'text',
              text:
                files.length > 1
                  ? 'Extract all receipt data from these images (segments of one receipt) and return it as JSON.'
                  : 'Extract all receipt data from this image and return it as JSON.',
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

    this.logger.debug(`OCR response: ${content}`);

    // Strip markdown code fences if present
    const jsonText = content
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    const result = JSON.parse(jsonText) as ScanResult;

    if (!Array.isArray(result.items)) {
      throw new Error('Invalid OCR response: missing items array');
    }

    // Sanity-check: ensure unitPrice and totalPrice are consistent
    for (const item of result.items) {
      // Fix totalPrice if missing or zero
      if (!item.totalPrice && item.unitPrice > 0) {
        item.totalPrice = item.unitPrice * item.quantity;
      }
      // Recalculate unitPrice from totalPrice (totalPrice is read directly from receipt)
      if (item.totalPrice > 0 && item.quantity > 0) {
        const recalculated = Math.round(item.totalPrice / item.quantity);
        if (recalculated !== item.unitPrice) {
          this.logger.debug(
            `Corrected unitPrice for "${item.name}": ${item.unitPrice} → ${recalculated} (totalPrice=${item.totalPrice}, qty=${item.quantity})`,
          );
        }
        item.unitPrice = recalculated;
      }
    }

    // Default missing fields
    if (typeof result.serviceChargePercent !== 'number') {
      result.serviceChargePercent = null;
    }
    if (typeof result.serviceChargeAmount !== 'number') {
      result.serviceChargeAmount = null;
    }

    // Fallback: if GPT missed both charge fields but totalAmount > sum of items,
    // record the gap as a flat serviceChargeAmount (no lossy percentage conversion).
    if (!result.serviceChargePercent && !result.serviceChargeAmount && result.totalAmount > 0) {
      const itemsSubtotal = result.items.reduce(
        (sum, item) => sum + (item.totalPrice || item.unitPrice * item.quantity),
        0,
      );
      const diff = result.totalAmount - itemsSubtotal;
      // Only apply if it looks like a real charge (positive, < 50% of total)
      if (itemsSubtotal > 0 && diff > 0 && diff <= result.totalAmount * 0.5) {
        result.serviceChargeAmount = diff;
        this.logger.debug(
          `Auto-detected service charge: ${diff} (subtotal=${itemsSubtotal}, total=${result.totalAmount})`,
        );
      }
    }

    return result;
  }
}
