import { Test, type TestingModule } from '@nestjs/testing';
import { LogoutHandler } from './logout.handler';
import { LogoutCommand } from './logout.command';
import { PROFILE_REPOSITORY } from '../../../domain/repositories/profile.repository.interface';
import { Profile, Email } from '../../../domain';

describe('LogoutHandler', () => {
  let handler: LogoutHandler;
  const mockRepository = {
    findById: jest.fn(),
    findByEmail: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn(),
    existsByEmail: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LogoutHandler, { provide: PROFILE_REPOSITORY, useValue: mockRepository }],
    }).compile();

    handler = module.get<LogoutHandler>(LogoutHandler);
    jest.clearAllMocks();
  });

  it('should clear the refresh token and save the profile', async () => {
    const profile = Profile.reconstitute({
      id: 'user-1',
      email: Email.create('user@test.com'),
      name: 'John',
      password: null,
      currency: 'USD',
      language: 'ru',
      hasCompletedOnboarding: true,
      defaultAccountId: null,
      isDemo: false,
      demoExpiresAt: null,
      refreshToken: 'existing-token',
      dashboardSettings: null,
      quickActionsHidden: false,
      quickActionsHintDismissed: false,
      financialMonthStartDay: 1,
      timezone: 'Asia/Tashkent',
      notificationHour: 12,
      createdAt: new Date(),
    });
    mockRepository.findById.mockResolvedValue(profile);
    mockRepository.save.mockImplementation((p) => Promise.resolve(p));

    await handler.execute(new LogoutCommand('user-1'));

    expect(profile.refreshToken).toBeNull();
    expect(mockRepository.save).toHaveBeenCalledWith(profile);
  });

  it('should do nothing if profile not found', async () => {
    mockRepository.findById.mockResolvedValue(null);

    await handler.execute(new LogoutCommand('nonexistent'));

    expect(mockRepository.save).not.toHaveBeenCalled();
  });
});
