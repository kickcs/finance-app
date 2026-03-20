import { Test, type TestingModule } from '@nestjs/testing';
import { CreateReminderHandler } from './create-reminder.handler';
import { CreateReminderCommand } from './create-reminder.command';
import { REMINDER_REPOSITORY } from '../../../domain/repositories';

describe('CreateReminderHandler', () => {
  let handler: CreateReminderHandler;
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
        CreateReminderHandler,
        { provide: REMINDER_REPOSITORY, useValue: mockRepository },
      ],
    }).compile();

    handler = module.get<CreateReminderHandler>(CreateReminderHandler);
    jest.clearAllMocks();
  });

  it('should create a monthly reminder and return the response', async () => {
    mockRepository.save.mockImplementation((reminder) => Promise.resolve(reminder));

    const nextDate = new Date('2026-04-01');
    const command = new CreateReminderCommand(
      'user-1',
      'Rent',
      1500,
      'monthly',
      nextDate,
      'home',
      '#FF0000',
    );

    const result = await handler.execute(command);

    expect(result).toEqual(
      expect.objectContaining({
        userId: 'user-1',
        name: 'Rent',
        amount: 1500,
        frequency: 'monthly',
        nextDate,
        icon: 'home',
        color: '#FF0000',
        isActive: true,
      }),
    );
    expect(result.id).toBeDefined();
    expect(mockRepository.save).toHaveBeenCalledTimes(1);
  });

  it('should create a one-time reminder', async () => {
    mockRepository.save.mockImplementation((reminder) => Promise.resolve(reminder));

    const nextDate = new Date('2026-06-15');
    const command = new CreateReminderCommand(
      'user-1',
      'Pay Ticket',
      300,
      'once',
      nextDate,
      'ticket',
      '#FFA500',
    );

    const result = await handler.execute(command);

    expect(result.frequency).toBe('once');
    expect(result.isActive).toBe(true);
  });

  it('should create a weekly reminder', async () => {
    mockRepository.save.mockImplementation((reminder) => Promise.resolve(reminder));

    const command = new CreateReminderCommand(
      'user-1',
      'Groceries',
      200,
      'weekly',
      new Date('2026-04-05'),
      'cart',
      '#00FF00',
    );

    const result = await handler.execute(command);

    expect(result.frequency).toBe('weekly');
  });
});
