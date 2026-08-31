import { Controller, Get, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../../../../common';
import {
  SharedDebtsService,
  getPublicAppUrl,
} from '../../application/services/shared-debts.service';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatAmount(amount: number): string {
  return Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function pluralizeDebts(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'долг';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'долга';
  return 'долгов';
}

const NOT_FOUND_HTML = `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <title>Сверка не найдена</title>
</head>
<body>
  <p>Сверка не найдена</p>
</body>
</html>`;

/**
 * Мессенджеры не исполняют SPA-роутинг, поэтому ссылка ведёт сюда: контроллер
 * отдаёт OG-разметку для превью и тут же перебрасывает живого читателя на
 * страницу приложения.
 */
@Controller('d')
export class DebtsSharePageController {
  constructor(private readonly sharedDebtsService: SharedDebtsService) {}

  @Public()
  @Get(':token')
  async getSharePage(@Param('token') token: string, @Res() res: Response): Promise<void> {
    let payload;
    try {
      payload = await this.sharedDebtsService.getByToken(token);
    } catch {
      res.status(404).type('html').send(NOT_FOUND_HTML);
      return;
    }

    const publicAppUrl = getPublicAppUrl();
    const ogImageUrl = escapeHtml(`${publicAppUrl}/api/debt-shares/${token}/og.png`);
    const pageUrl = escapeHtml(`${publicAppUrl}/d/${token}`);
    const redirectUrl = `${publicAppUrl}/shared-debts/${token}`;
    const escapedRedirectUrl = escapeHtml(redirectUrl);

    const isPositive = payload.net >= 0;
    const amountText = `${formatAmount(Math.abs(payload.net))} ${payload.currency}`;
    const rawTitle = isPositive
      ? `${payload.personName} должен ${amountText}`
      : `Вы должны ${payload.personName} ${amountText}`;
    const title = escapeHtml(rawTitle);
    const debtsCount = payload.debts.length;
    const description = escapeHtml(
      `${debtsCount} ${pluralizeDebts(debtsCount)} · список и суммы внутри`,
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
  <p>${title}</p>
</body>
</html>`;

    res.status(200).type('html').send(html);
  }
}
