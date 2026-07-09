import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SharedReceiptService, type SharedReceiptPayload } from './shared-receipt.service';
import { SharedReceiptOrmEntity } from '../../infrastructure/persistence/typeorm/shared-receipt.orm-entity';

const mockPayload: SharedReceiptPayload = {
  storeName: 'Test Cafe',
  date: Date.now(),
  currency: 'UZS',
  totalAmount: 100000,
  subtotal: 90000,
  charges: [{ label: 'Обслуживание', display: '10%' }],
  participants: [
    {
      name: 'Аня',
      color: '#ff0000',
      isMe: true,
      total: 50000,
      paidByName: null,
      items: [{ name: 'Плов', share: 1, sharedWith: 1, lineTotal: 50000 }],
    },
  ],
  paymentMethods: [],
  ownerName: 'Владелец',
};

describe('SharedReceiptService', () => {
  let service: SharedReceiptService;
  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SharedReceiptService,
        { provide: getRepositoryToken(SharedReceiptOrmEntity), useValue: mockRepository },
      ],
    }).compile();

    service = module.get<SharedReceiptService>(SharedReceiptService);
  });

  describe('create', () => {
    it('returns a token of length 21 and a url containing /r/<token>', async () => {
      mockRepository.create.mockImplementation(
        (data: Partial<SharedReceiptOrmEntity>) => data as SharedReceiptOrmEntity,
      );
      mockRepository.save.mockImplementation((data: SharedReceiptOrmEntity) =>
        Promise.resolve(data),
      );

      const result = await service.create('user-1', mockPayload);

      expect(result.token).toHaveLength(21);
      expect(result.url).toContain(`/r/${result.token}`);
      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1', payload: mockPayload }),
      );
    });
  });

  describe('getByToken', () => {
    it('returns the payload for an existing token', async () => {
      mockRepository.findOne.mockResolvedValue({
        id: 'id-1',
        token: 'abc',
        userId: 'user-1',
        payload: mockPayload,
        createdAt: new Date(),
      });

      const result = await service.getByToken('abc');
      expect(result).toEqual(mockPayload);
    });

    it('throws NotFoundException for a missing token', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.getByToken('missing')).rejects.toThrow(NotFoundException);
    });
  });
});
