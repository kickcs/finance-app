import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import { DebtsSharePageController } from './debts-share-page.controller';
import {
  SharedDebtsService,
  type SharedDebtsPayload,
} from '../../application/services/shared-debts.service';

class MockResponse {
  statusCode?: number;
  body?: string;

  status = jest.fn((code: number): this => {
    this.statusCode = code;
    return this;
  });

  type = jest.fn((): this => this);

  send = jest.fn((body: string): this => {
    this.body = body;
    return this;
  });
}

function createMockResponse(): MockResponse {
  return new MockResponse();
}

function getSentHtml(res: MockResponse): string {
  return res.send.mock.calls[0][0];
}

function buildPayload(overrides: Partial<SharedDebtsPayload> = {}): SharedDebtsPayload {
  return {
    personName: 'Умид',
    currency: 'UZS',
    net: 229648,
    totalGiven: 229648,
    totalTaken: 0,
    ownerName: 'Владелец',
    snapshotAt: Date.UTC(2026, 7, 31),
    debts: [
      {
        title: 'Долг от Умид',
        direction: 'given',
        currency: 'UZS',
        totalAmount: 300000,
        remainingAmount: 229648,
        paidAmount: 70352,
        forgivenAmount: 0,
        dueDate: null,
        createdAt: '2026-08-01',
      },
    ],
    ...overrides,
  };
}

describe('DebtsSharePageController', () => {
  let controller: DebtsSharePageController;
  const mockSharedDebtsService = { getByToken: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.PUBLIC_APP_URL = 'https://example.com';

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DebtsSharePageController],
      providers: [{ provide: SharedDebtsService, useValue: mockSharedDebtsService }],
    }).compile();

    controller = module.get<DebtsSharePageController>(DebtsSharePageController);
  });

  it('отдаёт OG-разметку и редирект на страницу приложения', async () => {
    mockSharedDebtsService.getByToken.mockResolvedValue(buildPayload());
    const res = createMockResponse();

    await controller.getSharePage('tok', res as unknown as Response);

    const html = getSentHtml(res);
    expect(res.statusCode).toBe(200);
    expect(html).toContain('<meta property="og:title" content="Умид должен 229 648 UZS" />');
    expect(html).toContain(
      '<meta property="og:image" content="https://example.com/api/debt-shares/tok/og.png" />',
    );
    expect(html).toContain('https://example.com/shared-debts/tok');
    expect(html).toContain('1 долг · список и суммы внутри');
  });

  it('разворачивает формулировку, когда должен владелец ссылки', async () => {
    mockSharedDebtsService.getByToken.mockResolvedValue(buildPayload({ net: -50000 }));
    const res = createMockResponse();

    await controller.getSharePage('tok', res as unknown as Response);

    expect(getSentHtml(res)).toContain('Вы должны Умид 50 000 UZS');
  });

  it('экранирует разметку в имени человека', async () => {
    mockSharedDebtsService.getByToken.mockResolvedValue(
      buildPayload({ personName: '<script>alert(1)</script>' }),
    );
    const res = createMockResponse();

    await controller.getSharePage('tok', res as unknown as Response);

    const html = getSentHtml(res);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('склоняет «долга» для двух долгов', async () => {
    const payload = buildPayload();
    mockSharedDebtsService.getByToken.mockResolvedValue({
      ...payload,
      debts: [payload.debts[0], payload.debts[0]],
    });
    const res = createMockResponse();

    await controller.getSharePage('tok', res as unknown as Response);

    expect(getSentHtml(res)).toContain('2 долга · список и суммы внутри');
  });

  it('отдаёт 404-страницу на неизвестный токен', async () => {
    mockSharedDebtsService.getByToken.mockRejectedValue(new NotFoundException());
    const res = createMockResponse();

    await controller.getSharePage('nope', res as unknown as Response);

    expect(res.statusCode).toBe(404);
    expect(getSentHtml(res)).toContain('Сверка не найдена');
  });
});
