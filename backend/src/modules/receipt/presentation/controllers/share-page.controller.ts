import { Controller, Get, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../../../../common';
import { SharedReceiptService } from '../../application/services/shared-receipt.service';
import { escapeXml, formatAmount, getPublicAppUrl } from '../../../../shared/utils/share';

function pluralizeParticipants(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'участник';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'участника';
  return 'участников';
}

const NOT_FOUND_HTML = `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <title>Чек не найден</title>
</head>
<body>
  <p>Чек не найден</p>
</body>
</html>`;

@Controller('r')
export class SharePageController {
  constructor(private readonly sharedReceiptService: SharedReceiptService) {}

  @Public()
  @Get(':token')
  async getSharePage(@Param('token') token: string, @Res() res: Response): Promise<void> {
    let payload;
    try {
      payload = await this.sharedReceiptService.getByToken(token);
    } catch {
      res.status(404).type('html').send(NOT_FOUND_HTML);
      return;
    }

    const publicAppUrl = getPublicAppUrl();
    const participantsCount = payload.participants.length;
    const ogImageUrl = escapeXml(`${publicAppUrl}/api/receipts/shared/${token}/og.png`);
    const pageUrl = escapeXml(`${publicAppUrl}/r/${token}`);
    const redirectUrl = `${publicAppUrl}/shared/${token}`;
    const escapedRedirectUrl = escapeXml(redirectUrl);

    const amountText = `${formatAmount(payload.totalAmount)} ${payload.currency}`;
    const rawTitle = payload.storeName
      ? `Чек из ${payload.storeName} — ${amountText}`
      : `Чек — ${amountText}`;
    const title = escapeXml(rawTitle);
    const bodyLine = escapeXml(rawTitle);
    const description = escapeXml(
      `${participantsCount} ${pluralizeParticipants(participantsCount)} · доли и реквизиты внутри`,
    );

    const html = `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${ogImageUrl}" />
  <meta property="og:url" content="${pageUrl}" />
  <meta property="og:type" content="website" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta http-equiv="refresh" content="0;url=${escapedRedirectUrl}" />
  <script>location.replace(${JSON.stringify(redirectUrl)});</script>
</head>
<body>
  <p>${bodyLine}</p>
</body>
</html>`;

    res.status(200).type('html').send(html);
  }
}
