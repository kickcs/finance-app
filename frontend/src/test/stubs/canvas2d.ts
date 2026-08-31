/**
 * Заглушка контекста canvas 2d для jsdom.
 *
 * jsdom без пакета `canvas` отдаёт из `getContext('2d')` null, и любой рендер
 * карточки шаринга падает ещё до первого assert. Тянуть в devDependencies
 * нативный `canvas` ради этого не нужно: тесты проверяют арифметику вёрстки —
 * какая вышла высота, что во что уместилось, — а не пиксели.
 *
 * Ширину текста считаем пропорционально длине строки. Точность здесь не важна,
 * важна монотонность: длиннее строка — больше ширина, иначе `fit()` не проверить.
 */
const CHAR_WIDTH = 7;

export interface Canvas2dStubCall {
  text: string;
  x: number;
  y: number;
}

export interface Canvas2dStub {
  /** Всё, что было отрисовано через fillText, в порядке вызова. */
  calls: Canvas2dStubCall[];
  restore: () => void;
}

/**
 * Ставит заглушку на время теста. Возвращает журнал отрисовки и функцию
 * возврата — вызывать её в afterEach, иначе стенд протечёт в соседний файл.
 */
export function stubCanvas2d(): Canvas2dStub {
  const calls: Canvas2dStubCall[] = [];
  const original = HTMLCanvasElement.prototype.getContext;

  function createContext(): CanvasRenderingContext2D {
    const noop = (): void => {};
    const context = {
      font: '',
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      lineCap: 'butt',
      textAlign: 'left',
      textBaseline: 'alphabetic',
      letterSpacing: '0px',
      shadowColor: '',
      shadowBlur: 0,
      shadowOffsetY: 0,
      globalCompositeOperation: 'source-over',
      measureText: (value: string) => ({ width: value.length * CHAR_WIDTH }),
      fillText: (text: string, x: number, y: number) => calls.push({ text, x, y }),
      createLinearGradient: () => ({ addColorStop: noop }),
      scale: noop,
      save: noop,
      restore: noop,
      beginPath: noop,
      closePath: noop,
      moveTo: noop,
      lineTo: noop,
      quadraticCurveTo: noop,
      arc: noop,
      roundRect: noop,
      rect: noop,
      fill: noop,
      stroke: noop,
      fillRect: noop,
      setLineDash: noop,
    };
    return context as unknown as CanvasRenderingContext2D;
  }

  HTMLCanvasElement.prototype.getContext = function getContext(
    this: HTMLCanvasElement,
    id: string,
  ) {
    return id === '2d' ? createContext() : null;
  } as typeof HTMLCanvasElement.prototype.getContext;

  return {
    calls,
    restore: () => {
      HTMLCanvasElement.prototype.getContext = original;
    },
  };
}

/** Контекст-одиночка для тестов, которым нужен только `measureText`. */
export function fakeContext(): CanvasRenderingContext2D {
  return {
    font: '',
    letterSpacing: '0px',
    measureText: (value: string) => ({ width: value.length * CHAR_WIDTH }),
  } as unknown as CanvasRenderingContext2D;
}
