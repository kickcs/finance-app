import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { GetReminderByIdHandler } from './get-reminder-by-id.handler';
import { GetReminderByIdQuery } from './get-reminder-by-id.query';
import { Reminder } from '../../../domain/aggregates/reminder';
import { REMINDER_REPOSITORY } from '../../../domain/repositories';

describe('GetReminderByIdHandler', () => {
  let handler: GetReminderByIdHandler;
  const mockRepository = {
    findById: jest.fn(),
    findByUserId: jest.fn(),
    findActiveByUserId: jest.fn(),
    findDueReminders: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetReminderByIdHandler,
        { provide: REMINDER_REPOSITORY, useValue: mockRepository },
      ],
    }).compile();

    handler = module.get<GetReminderByIdHandler>(GetReminderByIdHandler);
    jest.clearAllMocks();
  });

  it('should return a reminder by id', async () => {
    const reminder = Reminder.create(
      'r-1',
      'user-1',
      'Rent',
      1500,
      'monthly',
      new Date('2026-04-01'),
      'home',
      '#F00',
    );
    mockRepository.findById.mockResolvedValue(reminder);

    const query = new GetReminderByIdQuery('r-1', 'user-1');

    const result = await handler.execute(query);

    expect(result).toEqual(
      expect.objectContaining({
        id: 'r-1',
        name: 'Rent',
        amount: 1500,
        frequency: 'monthly',
      }),
    );
    expect(mockRepository.findById).toHaveBeenCalledWith('r-1');
  });

  it('should throw NotFoundException when reminder does not exist', async () => {
    mockRepository.findById.mockResolvedValue(null);

    const query = new GetReminderByIdQuery('nonexistent', 'user-1');

    await expect(handler.execute(query)).rejects.toThrow(NotFoundException);
  });

  it('should throw ForbiddenException when user does not own the reminder', async () => {
    const reminder = Reminder.create(
      'r-1',
      'user-1',
      'Private',
      100,
      'monthly',
      new Date(),
      'lock',
      '#F00',
    );
    mockRepository.findById.mockResolvedValue(reminder);

    const query = new GetReminderByIdQuery('r-1', 'other-user');

    await expect(handler.execute(query)).rejects.toThrow(ForbiddenException);
  });
});
