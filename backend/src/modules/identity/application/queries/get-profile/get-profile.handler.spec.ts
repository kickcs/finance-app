import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { GetProfileHandler } from './get-profile.handler';
import { GetProfileQuery } from './get-profile.query';
import { PROFILE_REPOSITORY } from '../../../domain/repositories/profile.repository.interface';
import { Profile, Email } from '../../../domain';

describe('GetProfileHandler', () => {
  let handler: GetProfileHandler;
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
      providers: [GetProfileHandler, { provide: PROFILE_REPOSITORY, useValue: mockRepository }],
    }).compile();

    handler = module.get<GetProfileHandler>(GetProfileHandler);
    jest.clearAllMocks();
  });

  it('should return profile response when profile exists', async () => {
    const profile = Profile.reconstitute({
      id: 'user-1',
      email: Email.create('user@test.com'),
      name: 'John',
      password: null,
      currency: 'USD',
      hasCompletedOnboarding: true,
      defaultAccountId: 'acc-1',
      isDemo: false,
      demoExpiresAt: null,
      refreshToken: 'token',
      dashboardSettings: {
        widgetOrder: ['accounts', 'transactions'],
        hiddenWidgets: [],
        hiddenAccountIds: [],
      },
      quickActionsHidden: false,
      quickActionsHintDismissed: true,
      financialMonthStartDay: 1,
      createdAt: new Date('2024-01-15'),
    });
    mockRepository.findById.mockResolvedValue(profile);

    const query = new GetProfileQuery('user-1');
    const result = await handler.execute(query);

    expect(result).toEqual({
      id: 'user-1',
      email: 'user@test.com',
      name: 'John',
      currency: 'USD',
      hasCompletedOnboarding: true,
      defaultAccountId: 'acc-1',
      isDemo: false,
      demoExpiresAt: null,
      dashboardSettings: {
        widgetOrder: ['accounts', 'transactions'],
        hiddenWidgets: [],
        hiddenAccountIds: [],
      },
      quickActionsHidden: false,
      quickActionsHintDismissed: true,
      financialMonthStartDay: 1,
      createdAt: new Date('2024-01-15'),
    });
    expect(mockRepository.findById).toHaveBeenCalledWith('user-1');
  });

  it('should throw NotFoundException when profile does not exist', async () => {
    mockRepository.findById.mockResolvedValue(null);

    const query = new GetProfileQuery('nonexistent');

    await expect(handler.execute(query)).rejects.toThrow(NotFoundException);
    await expect(handler.execute(query)).rejects.toThrow('Profile not found');
  });

  it('should return null email for demo profiles', async () => {
    const profile = Profile.reconstitute({
      id: 'demo-1',
      email: null,
      name: 'Demo User',
      password: null,
      currency: 'UZS',
      hasCompletedOnboarding: false,
      defaultAccountId: null,
      isDemo: true,
      demoExpiresAt: new Date('2025-01-01'),
      refreshToken: null,
      dashboardSettings: null,
      quickActionsHidden: false,
      quickActionsHintDismissed: false,
      financialMonthStartDay: 1,
      createdAt: new Date('2024-12-31'),
    });
    mockRepository.findById.mockResolvedValue(profile);

    const result = await handler.execute(new GetProfileQuery('demo-1'));

    expect(result.email).toBeNull();
    expect(result.isDemo).toBe(true);
    expect(result.demoExpiresAt).toEqual(new Date('2025-01-01'));
  });
});
