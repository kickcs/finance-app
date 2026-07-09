import { Test, type TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PaymentMethodService } from './payment-method.service';
import { PaymentMethodOrmEntity } from '../../infrastructure/persistence/typeorm/payment-method.orm-entity';

describe('PaymentMethodService', () => {
  let service: PaymentMethodService;
  const mockRepository = {
    find: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentMethodService,
        { provide: getRepositoryToken(PaymentMethodOrmEntity), useValue: mockRepository },
      ],
    }).compile();

    service = module.get<PaymentMethodService>(PaymentMethodService);
  });

  describe('create', () => {
    it('creates a payment method when under the limit', async () => {
      mockRepository.count.mockResolvedValue(3);
      mockRepository.create.mockImplementation(
        (data: Partial<PaymentMethodOrmEntity>) => data as PaymentMethodOrmEntity,
      );
      mockRepository.save.mockImplementation((data: PaymentMethodOrmEntity) =>
        Promise.resolve({ ...data, id: 'pm-1' }),
      );

      const result = await service.create('user-1', 'Карта', '1234 5678');

      expect(result).toMatchObject({ id: 'pm-1', label: 'Карта', value: '1234 5678' });
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('throws BadRequestException when the user already has 10 payment methods', async () => {
      mockRepository.count.mockResolvedValue(10);

      await expect(service.create('user-1', 'Карта', '1234')).rejects.toThrow(BadRequestException);
      expect(mockRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('removes a payment method belonging to the user', async () => {
      const entity = { id: 'pm-1', userId: 'user-1', label: 'Карта', value: '1234' };
      mockRepository.findOne.mockResolvedValue(entity);

      await service.delete('user-1', 'pm-1');

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'pm-1', userId: 'user-1' },
      });
      expect(mockRepository.remove).toHaveBeenCalledWith(entity);
    });

    it("throws NotFoundException when deleting another user's payment method", async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.delete('user-1', 'pm-of-someone-else')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockRepository.remove).not.toHaveBeenCalled();
    });
  });
});
