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

STEP-BY-STEP PROCESS (follow this order):
1. FIRST, find the FINAL total on the receipt — the largest total at the bottom ("ИТОГО К ОПЛАТЕ", "ИТОГО", "Total", "Grand Total"). This is your anchor — set it as "totalAmount"
2. THEN, check if there are any additional charges (service, НДС, VAT, tax, tips) between the subtotal and the final total. Extract the percentage into "serviceChargePercent"
3. Calculate the subtotal: if serviceChargePercent exists, subtotal = totalAmount / (1 + serviceChargePercent/100). Otherwise subtotal = totalAmount
4. Extract each item with name, quantity, and the LINE TOTAL from the "Сумма"/"Sum" column (this is totalPrice, NOT unitPrice)
5. Calculate unitPrice = totalPrice / quantity for each item
6. VERIFY: sum of all item totalPrice values must equal the subtotal (step 3). If not, re-check your item extraction

Return JSON:
{
  "items": [
    {
      "name": "item name",
      "quantity": number,
      "unitPrice": number (price PER SINGLE UNIT = totalPrice / quantity),
      "totalPrice": number (line total from receipt "Сумма" column)
    }
  ],
  "totalAmount": number (FINAL total — the largest number at the bottom of receipt),
  "serviceChargePercent": number or null,
  "currency": "3-letter ISO code (e.g. UZS, USD, RUB)",
  "date": "YYYY-MM-DD or null",
  "storeName": "store name or null",
  "hashtags": ["#tag1", "#tag2"]
}

Rules:
- All prices: whole numbers in receipt currency (e.g. 35000 for 35,000 UZS)
- Handle Uzbek, Russian, English receipts
- If quantity not specified, use 1
- Do NOT include charges/taxes/VAT as items. Extract into "serviceChargePercent": "Обслуживание 10%" → 10, "НДС +12%" → 12, "НДС 12%" → 12, "VAT 15%" → 15, "Tax 8%" → 8
- If charge is a flat amount, calculate percentage from subtotal
- No charges found → serviceChargePercent: null
- "hashtags": 1-3 short hashtags in Russian describing the PLACE TYPE and WHAT was bought. Examples: restaurant → ["#кафе", "#обед"], grocery store → ["#продукты"], gas station → ["#бензин"], pharmacy → ["#аптека"], clothing store → ["#одежда"]. Use lowercase, no spaces inside tags. Focus on the category of spending, not the store name
- Return only valid JSON, no markdown`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4.1-nano',
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
    const jsonText = content
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    const result = JSON.parse(jsonText) as ScanResult;

    if (!Array.isArray(result.items)) {
      throw new Error('Invalid OCR response: missing items array');
    }

    // Fallback: if GPT missed serviceChargePercent but totalAmount > sum of items,
    // auto-calculate the percentage (handles НДС/VAT/tax the model failed to extract)
    if (!result.serviceChargePercent && result.totalAmount > 0) {
      const itemsSubtotal = result.items.reduce(
        (sum, item) => sum + (item.totalPrice || item.unitPrice * item.quantity),
        0,
      );
      if (itemsSubtotal > 0 && result.totalAmount > itemsSubtotal) {
        const diff = result.totalAmount - itemsSubtotal;
        const percent = (diff / itemsSubtotal) * 100;
        // Only apply if it looks like a real charge (0.5% – 30%)
        if (percent >= 0.5 && percent <= 30) {
          result.serviceChargePercent = Math.round(percent * 10) / 10;
          this.logger.debug(
            `Auto-detected service charge: ${result.serviceChargePercent}% (subtotal=${itemsSubtotal}, total=${result.totalAmount})`,
          );
        }
      }
    }

    return result;
  }
}
