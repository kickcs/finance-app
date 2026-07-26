import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import type { Plugin } from 'vite';

/**
 * Инлайнит иконку сплэш-лоадера в index.html как data-URI.
 *
 * Лоадер — это первый отрисованный контент (FCP), поэтому отдельный запрос за
 * картинкой стоит целого round-trip уже после парсинга HTML. Иконка весит ~5 КБ,
 * так что base64 в разметке дешевле сетевого похода.
 *
 * В исходнике остаётся обычный `src="/logo-192.webp"` — он рабочий сам по себе,
 * плагин лишь подменяет его на data-URI.
 */
const ICON_PUBLIC_PATH = '/logo-192.webp';

export function inlineLoaderIconPlugin(): Plugin {
  let dataUri: string | null = null;

  return {
    name: 'inline-loader-icon',
    enforce: 'post',
    // Только сборка: в dev иконка отдаётся как обычный файл, иначе закэшированный
    // в `dataUri` base64 переживёт правку картинки до перезапуска дев-сервера
    apply: 'build',
    transformIndexHtml(html) {
      if (!html.includes(`src="${ICON_PUBLIC_PATH}"`)) return html;

      dataUri ??= `data:image/webp;base64,${readFileSync(
        fileURLToPath(new URL(`../../../public${ICON_PUBLIC_PATH}`, import.meta.url)),
      ).toString('base64')}`;

      return html.replace(`src="${ICON_PUBLIC_PATH}"`, `src="${dataUri}"`);
    },
  };
}
