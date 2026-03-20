import { Test, type TestingModule } from '@nestjs/testing';
import { GetRemindersHandler } from './get-reminders.handler';
import { GetRemindersQuery } from './get-reminders.query';
import { Reminder } from '../../../domain/aggregates/reminder';
import { REMINDER_REPOSITORY } from '../../../domain/repositories';

describe('GetRemindersHandler', () => {
  let handler: GetRemindersHandler;
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
      providers: [GetRemindersHandler, { provide: REMINDER_REPOSITORY, useValue: mockRepository }],
    }).compile();

    handler = module.get<GetRemindersHandler>(GetRemindersHandler);
    jest.clearAllMocks();
  });

  it('should return a list of reminders for the user', async () => {
    const reminders = [
      Reminder.create(
        'r-1',
        'user-1',
        'Rent',
        1500,
        'monthly',
        new Date('2026-04-01'),
        'home',
        '#F00',
      ),
      Reminder.create(
        'r-2',
        'user-1',
        'Groceries',
        200,
        'weekly',
        new Date('2026-04-05'),
        'cart',
        '#0F0',
      ),
    ];
    mockRepository.findByUserId.mockResolvedValue(reminders);

    const query = new GetRemindersQuery('user-1');

    const result = await handler.execute(query);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(
      expect.objectContaining({ name: 'Rent', amount: 1500, frequency: 'monthly' }),
    );
    expect(result[1]).toEqual(
      expect.objectContaining({ name: 'Groceries', amount: 200, frequency: 'weekly' }),
    );
    expect(mockRepository.findByUserId).toHaveBeenCalledWith('user-1');
  });

  it('should return empty array when user has no reminders', async () => {
    mockRepository.findByUserId.mockResolvedValue([]);

    const query = new GetRemindersQuery('user-1');

    const result = await handler.execute(query);

    expect(result).toEqual([]);
  });
});
