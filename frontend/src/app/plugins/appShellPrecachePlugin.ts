import type { OutputChunk } from 'rolldown';
import type { Plugin } from 'vite';

/**
 * Ограничивает precache service worker'а оболочкой приложения.
 *
 * Глобы в конфиге workbox оперируют путями, а не графом импортов, поэтому любой
 * достаточно широкий шаблон (`chunks/*.js`) заметает и ленивые чанки страниц.
 * Плагин снимает точный список: входной чанк, всё, что он импортирует статически,
 * и их CSS — ровно то, без чего не покажется первый экран.
 *
 * Остальное кэшируется по факту первого обращения (runtimeCaching), так что
 * офлайн после первого захода на страницу продолжает работать.
 */
const ALWAYS_PRECACHED = [
  /^index\.html$/,
  /^manifest\.webmanifest$/,
  /^favicon\.svg$/,
  /^logo-192\.webp$/,
  /^fonts\/.+\.woff2$/,
];

const shellFiles = new Set<string>();

export function appShellPrecachePlugin(): Plugin {
  return {
    name: 'app-shell-precache',
    apply: 'build',
    generateBundle(_options, bundle) {
      shellFiles.clear();

      const entry = Object.values(bundle).find(
        (chunk): chunk is OutputChunk => chunk.type === 'chunk' && chunk.isEntry,
      );
      if (!entry) return;

      const visit = (fileName: string): void => {
        if (shellFiles.has(fileName)) return;
        const chunk = bundle[fileName];
        if (chunk?.type !== 'chunk') return;

        shellFiles.add(fileName);
        for (const css of chunk.viteMetadata?.importedCss ?? []) shellFiles.add(css);
        chunk.imports.forEach(visit);
      };

      visit(entry.fileName);
    },
  };
}

interface WorkboxManifestEntry {
  url: string;
  revision: string | null;
  size: number;
}

/**
 * `manifestTransforms` для workbox: выполняется на сборке (не сериализуется в sw.js),
 * поэтому может опираться на список, собранный плагином выше.
 *
 * Заодно снимает дубликаты по url: две записи на один адрес с разными revision
 * роняют установку воркера (`add-to-cache-list-conflicting-entries`).
 */
export function appShellManifestTransform(entries: WorkboxManifestEntry[]) {
  const seen = new Set<string>();

  const manifest = entries.filter((entry) => {
    if (seen.has(entry.url)) return false;

    const file = entry.url.replace(/^\//, '');
    const isShell = shellFiles.has(file) || ALWAYS_PRECACHED.some((p) => p.test(file));
    if (isShell) seen.add(entry.url);

    return isShell;
  });

  return { manifest, warnings: [] };
}
