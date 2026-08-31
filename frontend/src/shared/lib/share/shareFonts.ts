/**
 * Шрифты карточек шаринга. Грузятся лениво, в момент первого рендера: первой
 * отрисовке приложения они не нужны, а в стартовом бюджете весят заметно.
 *
 * Файлы лежат в `public/share-fonts/`, а не в выходном `fonts/`: список
 * ALWAYS_PRECACHED в appShellPrecachePlugin форсит в precache любой
 * `fonts/*.woff2` мимо графа импортов. Имена нехешированные, поэтому смена
 * шрифта требует переименования файла.
 */
const FACES: Array<[family: string, weight: string, file: string]> = [
  ['Golos Text', '500', 'golos-500.woff2'],
  ['Golos Text', '600', 'golos-600.woff2'],
  ['Golos Text', '800', 'golos-800.woff2'],
  ['IBM Plex Mono', '500', 'plex-mono-500.woff2'],
  ['IBM Plex Mono', '600', 'plex-mono-600.woff2'],
];

let pending: Promise<void> | null = null;

/**
 * До готовности шрифтов рисовать нельзя: canvas молча подставит системный, и
 * все замеры ширины уедут. Промис кэшируется — карточку рисуют по многу раз.
 */
export function ensureShareFonts(): Promise<void> {
  if (pending) return pending;

  // jsdom и старые webview без FontFace: рендер просто пойдёт системным шрифтом
  if (typeof FontFace === 'undefined' || !document.fonts) {
    pending = Promise.resolve();
    return pending;
  }

  pending = Promise.all(
    FACES.map(async ([family, weight, file]) => {
      const face = new FontFace(family, `url(/share-fonts/${file})`, { weight });
      document.fonts.add(await face.load());
    }),
  )
    .then(() => undefined)
    .catch(() => undefined);

  return pending;
}
