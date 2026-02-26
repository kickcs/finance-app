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

CRITICAL — NUMBER READING:
- Receipts use spaces as thousand separators: "134 000" = 134000, "50 000" = 50000, "18 000" = 18000
- Columns are: Name | Quantity | Sum. The quantity is a SMALL number (1, 2, 3). The sum is a LARGE number (thousands or more)
- NEVER merge the quantity digit into the sum. Example: "Нон  2  18 000" → qty=2, totalPrice=18000 (NOT qty=2, totalPrice=218000)
- UZS prices are typically 1,000–500,000. If a unitPrice is under 100 UZS, you likely dropped "000"

STEP-BY-STEP PROCESS:
1. Find the FINAL total at the bottom ("ИТОГО К ОПЛАТЕ", "ИТОГО", "Total", "Grand Total") → "totalAmount"
2. Check for additional charges (service, НДС, VAT, tax, tips) between subtotal and final total → "serviceChargePercent"
3. Calculate subtotal: if serviceChargePercent exists, subtotal = totalAmount / (1 + serviceChargePercent/100), otherwise subtotal = totalAmount
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
  "currency": "3-letter ISO code (e.g. UZS, USD, RUB)",
  "date": "YYYY-MM-DD or null",
  "storeName": "store name or null",
  "hashtags": ["#tag1", "#tag2"]
}

Rules:
- All prices: whole numbers, no decimals (e.g. 35000 for "35 000")
- Handle Uzbek, Russian, English receipts
- If quantity not specified, use 1
- Do NOT include charges/taxes/VAT as items. Extract into "serviceChargePercent": "Обслуживание 10%" → 10, "НДС +12%" → 12, "VAT 15%" → 15
- If charge is a flat amount, calculate percentage from subtotal
- No charges found → serviceChargePercent: null
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
