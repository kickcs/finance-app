import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import { SharePageController } from './share-page.controller';
import {
  SharedReceiptService,
  type SharedReceiptPayload,
} from '../../application/services/shared-receipt.service';

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

describe('SharePageController', () => {
  let controller: SharePageController;
  const mockSharedReceiptService = {
    getByToken: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.PUBLIC_APP_URL = 'https://example.com';

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SharePageController],
      providers: [{ provide: SharedReceiptService, useValue: mockSharedReceiptService }],
    }).compile();

    controller = module.get<SharePageController>(SharePageController);
  });

  it('escapes a malicious storeName in the rendered HTML', async () => {
    const payload: SharedReceiptPayload = {
      storeName: '<b>Evil</b>',
      date: Date.now(),
      currency: 'UZS',
      totalAmount: 100000,
      subtotal: 100000,
      charges: [],
      participants: [
        { name: 'A', color: '#fff', isMe: true, total: 100000, paidByName: null, items: [] },
      ],
      paymentMethods: [],
      ownerName: null,
    };
    mockSharedReceiptService.getByToken.mockResolvedValue(payload);

    const res = createMockResponse();
    await controller.getSharePage('tok123', res as unknown as Response);

    expect(res.send).toHaveBeenCalled();
    const html = getSentHtml(res);
    expect(html).not.toContain('<b>Evil</b>');
    expect(html).toContain('&lt;b&gt;Evil&lt;/b&gt;');
  });

  it('includes the SPA redirect URL', async () => {
    const payload: SharedReceiptPayload = {
      storeName: 'Кафе',
      date: Date.now(),
      currency: 'UZS',
      totalAmount: 50000,
      subtotal: 50000,
      charges: [],
      participants: [],
      paymentMethods: [],
      ownerName: null,
    };
    mockSharedReceiptService.getByToken.mockResolvedValue(payload);

    const res = createMockResponse();
    await controller.getSharePage('tok456', res as unknown as Response);

    const html = getSentHtml(res);
    expect(html).toContain('https://example.com/shared/tok456');
  });

  it('returns a 404 page when the token is not found', async () => {
    mockSharedReceiptService.getByToken.mockRejectedValue(new NotFoundException());

    const res = createMockResponse();
    await controller.getSharePage('missing', res as unknown as Response);

    expect(res.status).toHaveBeenCalledWith(404);
    const html = getSentHtml(res);
    expect(html).toContain('Чек не найден');
  });
});
