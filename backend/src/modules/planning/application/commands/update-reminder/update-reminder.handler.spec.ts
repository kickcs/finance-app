import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { UpdateReminderHandler } from './update-reminder.handler';
import { UpdateReminderCommand } from './update-reminder.command';
import { Reminder } from '../../../domain/aggregates/reminder';
import { REMINDER_REPOSITORY } from '../../../domain/repositories';

describe('UpdateReminderHandler', () => {
  let handler: UpdateReminderHandler;
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
        UpdateReminderHandler,
        { provide: REMINDER_REPOSITORY, useValue: mockRepository },
      ],
    }).compile();

    handler = module.get<UpdateReminderHandler>(UpdateReminderHandler);
    jest.clearAllMocks();
  });

  it('should update a reminder and return the response', async () => {
    const existing = Reminder.create(
      'r-1',
      'user-1',
      'Old',
      100,
      'monthly',
      new Date('2026-04-01'),
      'star',
      '#FFF',
    );
    mockRepository.findById.mockResolvedValue(existing);
    mockRepository.save.mockImplementation((r) => Promise.resolve(r));

    const command = new UpdateReminderCommand('r-1', 'user-1', {
      name: 'Updated',
      amount: 200,
    });

    const result = await handler.execute(command);

    expect(result).toEqual(
      expect.objectContaining({
        id: 'r-1',
        name: 'Updated',
        amount: 200,
      }),
    );
    expect(mockRepository.save).toHaveBeenCalledTimes(1);
  });

  it('should throw NotFoundException when reminder does not exist', async () => {
    mockRepository.findById.mockResolvedValue(null);

    const command = new UpdateReminderCommand('nonexistent', 'user-1', { name: 'X' });

    await expect(handler.execute(command)).rejects.toThrow(NotFoundException);
  });

  it('should throw ForbiddenException when user does not own the reminder', async () => {
    const reminder = Reminder.create(
      'r-1',
      'user-1',
      'Mine',
      100,
      'monthly',
      new Date(),
      'star',
      '#FFF',
    );
    mockRepository.findById.mockResolvedValue(reminder);

    const command = new UpdateReminderCommand('r-1', 'other-user', { name: 'Steal' });

    await expect(handler.execute(command)).rejects.toThrow(ForbiddenException);
  });

  it('should deactivate a reminder via update', async () => {
    const reminder = Reminder.create(
      'r-1',
      'user-1',
      'Active',
      100,
      'monthly',
      new Date(),
      'star',
      '#FFF',
    );
    mockRepository.findById.mockResolvedValue(reminder);
    mockRepository.save.mockImplementation((r) => Promise.resolve(r));

    const command = new UpdateReminderCommand('r-1', 'user-1', { isActive: false });

    const result = await handler.execute(command);

    expect(result.isActive).toBe(false);
  });
});
