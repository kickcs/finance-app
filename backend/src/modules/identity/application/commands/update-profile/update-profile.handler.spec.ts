import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UpdateProfileHandler } from './update-profile.handler';
import { UpdateProfileCommand } from './update-profile.command';
import { PROFILE_REPOSITORY } from '../../../domain/repositories/profile.repository.interface';
import { DomainEventPublisher } from '../../../../../shared';
import { Profile, Email } from '../../../domain';

describe('UpdateProfileHandler', () => {
  let handler: UpdateProfileHandler;
  const mockRepository = {
    findById: jest.fn(),
    findByEmail: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn(),
    existsByEmail: jest.fn(),
  };
  const mockEventPublisher = {
    publishEvents: jest.fn(),
    publishEventsFromMultiple: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdateProfileHandler,
        { provide: PROFILE_REPOSITORY, useValue: mockRepository },
        { provide: DomainEventPublisher, useValue: mockEventPublisher },
      ],
    }).compile();

    handler = module.get<UpdateProfileHandler>(UpdateProfileHandler);
    jest.clearAllMocks();
  });

  function createProfile(): Profile {
    return Profile.reconstitute({
      id: 'user-1',
      email: Email.create('user@test.com'),
      name: 'John',
      password: null,
      currency: 'USD',
      hasCompletedOnboarding: false,
      defaultAccountId: null,
      isDemo: false,
      demoExpiresAt: null,
      refreshToken: null,
      dashboardSettings: null,
      quickActionsHidden: false,
      quickActionsHintDismissed: false,
      financialMonthStartDay: 1,
      createdAt: new Date('2024-01-01'),
    });
  }

  it('should update profile name and return the response', async () => {
    const profile = createProfile();
    mockRepository.findById.mockResolvedValue(profile);
    mockRepository.save.mockImplementation((p) => Promise.resolve(p));
    mockEventPublisher.publishEvents.mockResolvedValue(undefined);

    const command = new UpdateProfileCommand('user-1', { name: 'Jane' });
    const result = await handler.execute(command);

    expect(result.name).toBe('Jane');
    expect(result.id).toBe('user-1');
    expect(result.email).toBe('user@test.com');
    expect(mockRepository.findById).toHaveBeenCalledWith('user-1');
    expect(mockRepository.save).toHaveBeenCalled();
    expect(mockEventPublisher.publishEvents).toHaveBeenCalled();
  });

  it('should update currency', async () => {
    const profile = createProfile();
    mockRepository.findById.mockResolvedValue(profile);
    mockRepository.save.mockImplementation((p) => Promise.resolve(p));
    mockEventPublisher.publishEvents.mockResolvedValue(undefined);

    const command = new UpdateProfileCommand('user-1', { currency: 'EUR' });
    const result = await handler.execute(command);

    expect(result.currency).toBe('EUR');
  });

  it('should update hasCompletedOnboarding', async () => {
    const profile = createProfile();
    mockRepository.findById.mockResolvedValue(profile);
    mockRepository.save.mockImplementation((p) => Promise.resolve(p));
    mockEventPublisher.publishEvents.mockResolvedValue(undefined);

    const command = new UpdateProfileCommand('user-1', { hasCompletedOnboarding: true });
    const result = await handler.execute(command);

    expect(result.hasCompletedOnboarding).toBe(true);
  });

  it('should update defaultAccountId', async () => {
    const profile = createProfile();
    mockRepository.findById.mockResolvedValue(profile);
    mockRepository.save.mockImplementation((p) => Promise.resolve(p));
    mockEventPublisher.publishEvents.mockResolvedValue(undefined);

    const command = new UpdateProfileCommand('user-1', { defaultAccountId: 'acc-1' });
    const result = await handler.execute(command);

    expect(result.defaultAccountId).toBe('acc-1');
  });

  it('should update multiple fields at once', async () => {
    const profile = createProfile();
    mockRepository.findById.mockResolvedValue(profile);
    mockRepository.save.mockImplementation((p) => Promise.resolve(p));
    mockEventPublisher.publishEvents.mockResolvedValue(undefined);

    const command = new UpdateProfileCommand('user-1', {
      name: 'Updated',
      currency: 'GBP',
      quickActionsHidden: true,
    });
    const result = await handler.execute(command);

    expect(result.name).toBe('Updated');
    expect(result.currency).toBe('GBP');
    expect(result.quickActionsHidden).toBe(true);
  });

  it('should throw NotFoundException when profile not found', async () => {
    mockRepository.findById.mockResolvedValue(null);

    const command = new UpdateProfileCommand('nonexistent', { name: 'Test' });

    await expect(handler.execute(command)).rejects.toThrow(NotFoundException);
    await expect(handler.execute(command)).rejects.toThrow('Profile not found');
    expect(mockRepository.save).not.toHaveBeenCalled();
  });

  it('should return full profile response shape', async () => {
    const profile = createProfile();
    mockRepository.findById.mockResolvedValue(profile);
    mockRepository.save.mockImplementation((p) => Promise.resolve(p));
    mockEventPublisher.publishEvents.mockResolvedValue(undefined);

    const command = new UpdateProfileCommand('user-1', {});
    const result = await handler.execute(command);

    expect(result).toEqual({
      id: 'user-1',
      email: 'user@test.com',
      name: 'John',
      currency: 'USD',
      hasCompletedOnboarding: false,
      defaultAccountId: null,
      isDemo: false,
      demoExpiresAt: null,
      dashboardSettings: null,
      quickActionsHidden: false,
      quickActionsHintDismissed: false,
      financialMonthStartDay: 1,
      createdAt: new Date('2024-01-01'),
    });
  });
});
