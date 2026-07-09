import { Test, type TestingModule } from '@nestjs/testing';
import { ReceiptOcrService } from './receipt-ocr.service';

interface MockMessage {
  role: string;
  content: string | { type: string; image_url?: { url: string } }[];
}

interface MockCreateArgs {
  messages: MockMessage[];
}

const mockScanResult = {
  items: [{ name: 'Нон', quantity: 2, unitPrice: 9000, totalPrice: 18000 }],
  totalAmount: 18000,
  serviceChargePercent: null,
  serviceChargeAmount: null,
  currency: 'UZS',
  date: '2026-07-09',
  storeName: 'Test Store',
  hashtags: ['#кафе'],
};

const mockCreate = jest.fn<Promise<unknown>, [MockCreateArgs]>();

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  }));
});

function getCallArgs(callIndex = 0): MockCreateArgs {
  return mockCreate.mock.calls[callIndex][0];
}

describe('ReceiptOcrService', () => {
  let service: ReceiptOcrService;

  beforeEach(async () => {
    mockCreate.mockReset();
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(mockScanResult) } }],
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [ReceiptOcrService],
    }).compile();

    service = module.get<ReceiptOcrService>(ReceiptOcrService);
  });

  it('sends a single image_url part for one file and parses the result as before', async () => {
    const result = await service.scanReceipt([
      { buffer: Buffer.from('img'), mimetype: 'image/jpeg' },
    ]);

    const callArgs = getCallArgs();
    const userMessage = callArgs.messages.find((m) => m.role === 'user');
    const content = userMessage?.content;
    const imageParts = Array.isArray(content) ? content.filter((p) => p.type === 'image_url') : [];

    expect(imageParts).toHaveLength(1);
    expect(result.items).toEqual(mockScanResult.items);
    expect(result.totalAmount).toBe(18000);
  });

  it('sends N image_url parts for N files in one user message', async () => {
    await service.scanReceipt([
      { buffer: Buffer.from('img1'), mimetype: 'image/jpeg' },
      { buffer: Buffer.from('img2'), mimetype: 'image/png' },
    ]);

    const callArgs = getCallArgs();
    const userMessages = callArgs.messages.filter((m) => m.role === 'user');
    expect(userMessages).toHaveLength(1);

    const content = userMessages[0].content;
    const imageParts = Array.isArray(content) ? content.filter((p) => p.type === 'image_url') : [];
    expect(imageParts).toHaveLength(2);
    expect(imageParts[0].image_url?.url).toContain('data:image/jpeg;base64,');
    expect(imageParts[1].image_url?.url).toContain('data:image/png;base64,');
  });

  it('includes the multi-segment instruction in the system prompt only for 2+ files', async () => {
    await service.scanReceipt([
      { buffer: Buffer.from('img1'), mimetype: 'image/jpeg' },
      { buffer: Buffer.from('img2'), mimetype: 'image/jpeg' },
    ]);

    const callArgs = getCallArgs();
    const systemMessage = callArgs.messages.find((m) => m.role === 'system');
    expect(systemMessage?.content).toContain('overlapping segments of ONE long receipt');
    expect(systemMessage?.content).toContain('do not duplicate lines');

    mockCreate.mockClear();
    await service.scanReceipt([{ buffer: Buffer.from('img1'), mimetype: 'image/jpeg' }]);
    const singleCallArgs = getCallArgs();
    const singleSystemMessage = singleCallArgs.messages.find((m) => m.role === 'system');
    expect(singleSystemMessage?.content).not.toContain('overlapping segments');
  });

  it('parses the response the same way regardless of file count (contract unchanged)', async () => {
    const result = await service.scanReceipt([
      { buffer: Buffer.from('img1'), mimetype: 'image/jpeg' },
      { buffer: Buffer.from('img2'), mimetype: 'image/jpeg' },
    ]);

    expect(result).toMatchObject({
      totalAmount: 18000,
      currency: 'UZS',
      storeName: 'Test Store',
    });
    expect(Array.isArray(result.items)).toBe(true);
  });
});
