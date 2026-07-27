/**
 * Ширина текста без участия вёрстки.
 *
 * Замер чипов через DOM требовал бы двух проходов: сначала натуральные ширины,
 * потом перегруппировка в ряды — а после `flex-grow` ширины уже растянуты, и
 * повторный замер уводит раскладку в петлю. Canvas отвечает на тот же вопрос
 * без layout, а погрешность в пару пикселей поглощает `flex-grow`: она может
 * лишь сдвинуть точку разрыва ряда, но не оставить пустоту.
 */
let context: CanvasRenderingContext2D | null = null;
let contextResolved = false;
let cachedFont = '';
const cache = new Map<string, number>();

function getContext(): CanvasRenderingContext2D | null {
  if (contextResolved) return context;
  contextResolved = true;
  if (typeof document === 'undefined') return null;
  context = document.createElement('canvas').getContext('2d');
  return context;
}

export function measureTextWidth(text: string, font: string): number {
  const ctx = getContext();
  if (!ctx) return 0;

  if (font && font !== cachedFont) {
    ctx.font = font;
    cachedFont = font;
    // Кэш привязан к шрифту: после смены гарнитуры прежние ширины неверны.
    cache.clear();
  }

  const hit = cache.get(text);
  if (hit !== undefined) return hit;

  const width = ctx.measureText(text).width;
  cache.set(text, width);
  return width;
}

/** Шрифт узла в форме, которую понимает `CanvasRenderingContext2D.font`. */
export function resolveFont(el: HTMLElement): string {
  const style = getComputedStyle(el);
  if (!style.fontSize || !style.fontFamily) return '';
  return `${style.fontWeight || 400} ${style.fontSize} ${style.fontFamily}`;
}
