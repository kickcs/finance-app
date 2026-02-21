import type { HtmlTagDescriptor, Plugin } from 'vite';

/**
 * Vite plugin that injects <link rel="preload"> for critical Inter font files.
 * Only activates during build (not dev server).
 * Matches hashed font filenames in the bundle and generates preload tags.
 */
export function fontPreloadPlugin(): Plugin {
  const CRITICAL_FONTS = [
    'inter-latin-wght-normal',
    'inter-cyrillic-wght-normal',
  ];

  return {
    name: 'font-preload',
    enforce: 'post',
    apply: 'build',
    transformIndexHtml(html, ctx) {
      const bundle = ctx.bundle;
      if (!bundle) return html;

      const tags: HtmlTagDescriptor[] = [];
      const seen = new Set<string>();

      for (const [fileName] of Object.entries(bundle)) {
        const matchedFont = CRITICAL_FONTS.find(
          (font) => fileName.endsWith('.woff2') && fileName.includes(font),
        );
        if (matchedFont && !seen.has(matchedFont)) {
          seen.add(matchedFont);
          tags.push({
            tag: 'link',
            attrs: {
              rel: 'preload',
              as: 'font',
              type: 'font/woff2',
              crossorigin: 'anonymous',
              href: `/${fileName}`,
            },
            injectTo: 'head',
          });
        }
      }

      return tags;
    },
  };
}
