import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SharedDebtsPayload } from '@/entities/debt';

const { toastMock, downloadBlobMock } = vi.hoisted(() => ({
  toastMock: vi.fn(),
  downloadBlobMock: vi.fn(),
}));

vi.mock('@/shared/ui', async (importOriginal) => {
  const orig = await importOriginal<Record<string, unknown>>();
  return { ...orig, useToast: () => ({ toast: toastMock }) };
});

vi.mock('@/shared/lib/haptics', () => ({ useHaptics: () => ({ trigger: vi.fn() }) }));

vi.mock('@/shared/lib/share/shareFonts', () => ({ ensureShareFonts: () => Promise.resolve() }));

vi.mock('./renderDebtsCard', () => ({
  renderDebtsCardToCanvas: () => ({ width: 100, height: 100 }) as unknown as HTMLCanvasElement,
}));

vi.mock('@/shared/lib/share/shareCard', async (importOriginal) => {
  const orig = await importOriginal<Record<string, unknown>>();
  return {
    ...orig,
    canvasToBlob: () => Promise.resolve(new Blob(['png'], { type: 'image/png' })),
    downloadBlob: downloadBlobMock,
  };
});

import { useDebtsShare } from './useDebtsShare';

const CARD = '8600123456789012';

function payload(over: Partial<SharedDebtsPayload> = {}): SharedDebtsPayload {
  return {
    personName: 'Азамат',
    currency: 'UZS',
    net: 1250000,
    totalGiven: 1250000,
    totalTaken: 0,
    ownerName: null,
    snapshotAt: Date.parse('2026-08-31'),
    cardNumber: CARD,
    debts: [],
    ...over,
  };
}

interface NavigatorStub {
  share?: ReturnType<typeof vi.fn>;
  canShare?: ReturnType<typeof vi.fn>;
  writeText?: ReturnType<typeof vi.fn>;
}

const originals = {
  share: Object.getOwnPropertyDescriptor(navigator, 'share'),
  canShare: Object.getOwnPropertyDescriptor(navigator, 'canShare'),
  clipboard: Object.getOwnPropertyDescriptor(navigator, 'clipboard'),
};

function stubNavigator({ share, canShare, writeText }: NavigatorStub) {
  Object.defineProperty(navigator, 'share', { value: share, configurable: true });
  Object.defineProperty(navigator, 'canShare', { value: canShare, configurable: true });
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: writeText ?? vi.fn().mockResolvedValue(undefined) },
    configurable: true,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  for (const [key, descriptor] of Object.entries(originals)) {
    if (descriptor) Object.defineProperty(navigator, key, descriptor);
    else delete (navigator as unknown as Record<string, unknown>)[key];
  }
});

describe('shareAsImage', () => {
  it('отправляет картинку вместе с подписью, когда платформа берёт и то и другое', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    stubNavigator({ share, canShare: vi.fn().mockReturnValue(true) });

    await useDebtsShare().shareAsImage(payload());

    const data = share.mock.calls[0][0] as { files: File[]; text: string };
    expect(data.files).toHaveLength(1);
    expect(data.text).toContain('Азамат — должен');
    expect(data.text).toContain(`Карта: ${CARD}`);
  });

  it('там, где подпись при файле не берут, шлёт файл и кладёт текст в буфер', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn().mockResolvedValue(undefined);
    // Платформа согласна на файл, но не на файл с текстом
    const canShare = vi.fn((data: { text?: string }) => !data.text);
    stubNavigator({ share, canShare, writeText });

    await useDebtsShare().shareAsImage(payload());

    expect(share.mock.calls[0][0]).not.toHaveProperty('text');
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining(`Карта: ${CARD}`));
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Текст скопирован — вставьте в сообщение' }),
    );
  });

  it('буфер копируется до открытия системного листа', async () => {
    const order: string[] = [];
    const share = vi.fn(() => {
      order.push('share');
      return Promise.resolve();
    });
    const writeText = vi.fn(() => {
      order.push('copy');
      return Promise.resolve();
    });
    stubNavigator({ share, canShare: vi.fn((data: { text?: string }) => !data.text), writeText });

    await useDebtsShare().shareAsImage(payload());

    expect(order).toEqual(['copy', 'share']);
  });

  it('без системного шеринга скачивает картинку и копирует текст', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubNavigator({ share: undefined, canShare: undefined, writeText });

    await useDebtsShare().shareAsImage(payload());

    expect(downloadBlobMock).toHaveBeenCalled();
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining(`Карта: ${CARD}`));
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Изображение сохранено, текст скопирован' }),
    );
  });

  it('закрытый буфер не мешает отправке', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    stubNavigator({ share, canShare: vi.fn((data: { text?: string }) => !data.text), writeText });

    await useDebtsShare().shareAsImage(payload());

    expect(share).toHaveBeenCalled();
    expect(toastMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Текст скопирован — вставьте в сообщение' }),
    );
  });

  it('отмена системного шеринга не показывает ошибку', async () => {
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' });
    stubNavigator({
      share: vi.fn().mockRejectedValue(abort),
      canShare: vi.fn().mockReturnValue(true),
    });

    await useDebtsShare().shareAsImage(payload());

    expect(toastMock).not.toHaveBeenCalled();
  });
});

describe('buildShareText', () => {
  it('печатает карту сплошными цифрами — иначе мессенджер её не узнаёт', () => {
    const text = useDebtsShare().buildShareText(payload());
    expect(text).toContain(`Карта для перевода: ${CARD}`);
  });

  it('без карты о переводе не говорит', () => {
    const text = useDebtsShare().buildShareText(payload({ cardNumber: null }));
    expect(text).not.toContain('Карта для перевода');
  });
});

describe('saveAsImage', () => {
  it('копирует подпись рядом со скачанной картинкой', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubNavigator({ share: undefined, canShare: undefined, writeText });

    await useDebtsShare().saveAsImage(payload());

    expect(downloadBlobMock).toHaveBeenCalled();
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining(`Карта: ${CARD}`));
  });

  it('без приложенной карты подпись остаётся одним итогом', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubNavigator({ share: undefined, canShare: undefined, writeText });

    await useDebtsShare().saveAsImage(payload({ cardNumber: null }));

    expect(writeText).toHaveBeenCalledWith(expect.not.stringContaining('Карта:'));
  });
});
