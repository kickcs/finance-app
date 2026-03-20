import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { DeleteReminderHandler } from './delete-reminder.handler';
import { DeleteReminderCommand } from './delete-reminder.command';
import { Reminder } from '../../../domain/aggregates/reminder';
import { REMINDER_REPOSITORY } from '../../../domain/repositories';

describe('DeleteReminderHandler', () => {
  let handler: DeleteReminderHandler;
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
        DeleteReminderHandler,
        { provide: REMINDER_REPOSITORY, useValue: mockRepository },
      ],
    }).compile();

    handler = module.get<DeleteReminderHandler>(DeleteReminderHandler);
    jest.clearAllMocks();
  });

  it('should delete a reminder successfully', async () => {
    const reminder = Reminder.create(
      'r-1',
      'user-1',
      'To Delete',
      100,
      'monthly',
      new Date(),
      'trash',
      '#F00',
    );
    mockRepository.findById.mockResolvedValue(reminder);
    mockRepository.delete.mockResolvedValue(undefined);

    const command = new DeleteReminderCommand('r-1', 'user-1');

    await handler.execute(command);

    expect(mockRepository.findById).toHaveBeenCalledWith('r-1');
    expect(mockRepository.delete).toHaveBeenCalledWith('r-1');
  });

  it('should throw NotFoundException when reminder does not exist', async () => {
    mockRepository.findById.mockResolvedValue(null);

    const command = new DeleteReminderCommand('nonexistent', 'user-1');

    await expect(handler.execute(command)).rejects.toThrow(NotFoundException);
  });

  it('should throw ForbiddenException when user does not own the reminder', async () => {
    const reminder = Reminder.create(
      'r-1',
      'user-1',
      'Not Yours',
      100,
      'monthly',
      new Date(),
      'lock',
      '#F00',
    );
    mockRepository.findById.mockResolvedValue(reminder);

    const command = new DeleteReminderCommand('r-1', 'other-user');

    await expect(handler.execute(command)).rejects.toThrow(ForbiddenException);
    expect(mockRepository.delete).not.toHaveBeenCalled();
  });
});
