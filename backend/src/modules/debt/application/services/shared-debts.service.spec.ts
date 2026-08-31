import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SharedDebtsService, type SharedDebtsPayload } from './shared-debts.service';
import { SharedDebtsOrmEntity } from '../../infrastructure/persistence/typeorm/shared-debts.orm-entity';

const mockPayload: SharedDebtsPayload = {
  personName: 'Умид',
  currency: 'UZS',
  net: 229648,
  totalGiven: 229648,
  totalTaken: 0,
  ownerName: 'Владелец',
  snapshotAt: Date.now(),
  debts: [
    {
      title: 'Долг от Умид',
      direction: 'given',
      currency: 'UZS',
      totalAmount: 300000,
      remainingAmount: 229648,
      paidAmount: 70352,
      dueDate: null,
      createdAt: '2026-08-01',
    },
  ],
};

describe('SharedDebtsService', () => {
  let service: SharedDebtsService;
  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.PUBLIC_APP_URL = 'https://example.com';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SharedDebtsService,
        { provide: getRepositoryToken(SharedDebtsOrmEntity), useValue: mockRepository },
      ],
    }).compile();

    service = module.get<SharedDebtsService>(SharedDebtsService);
  });

  describe('create', () => {
    it('сохраняет снимок и возвращает публичный URL с токеном', async () => {
      mockRepository.create.mockImplementation((entity: unknown) => entity);
      mockRepository.save.mockResolvedValue(undefined);

      const result = await service.create('user-1', mockPayload);

      expect(result.token).toHaveLength(21);
      expect(result.url).toBe(`https://example.com/d/${result.token}`);
      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1', payload: mockPayload }),
      );
    });

    it('выдаёт разные токены на повторных вызовах', async () => {
      mockRepository.create.mockImplementation((entity: unknown) => entity);
      mockRepository.save.mockResolvedValue(undefined);

      const first = await service.create('user-1', mockPayload);
      const second = await service.create('user-1', mockPayload);

      expect(first.token).not.toBe(second.token);
    });
  });

  describe('getByToken', () => {
    it('возвращает сохранённый снимок', async () => {
      mockRepository.findOne.mockResolvedValue({ payload: mockPayload });

      await expect(service.getByToken('token-1')).resolves.toEqual(mockPayload);
    });

    it('бросает NotFound на неизвестный токен', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.getByToken('nope')).rejects.toThrow(NotFoundException);
    });
  });
});
