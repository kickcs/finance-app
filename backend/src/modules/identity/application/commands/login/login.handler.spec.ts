import { Test, type TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { LoginHandler } from './login.handler';
import { LoginCommand } from './login.command';
import { PROFILE_REPOSITORY } from '../../../domain/repositories/profile.repository.interface';
import { TokenService } from '../../services/token.service';
import { Profile, Email, Password } from '../../../domain';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
}));

import * as bcrypt from 'bcrypt';

describe('LoginHandler', () => {
  let handler: LoginHandler;
  const mockRepository = {
    findById: jest.fn(),
    findByEmail: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn(),
    existsByEmail: jest.fn(),
  };
  const mockTokenService = {
    generateTokens: jest.fn(),
    hashToken: jest.fn(),
    verifyToken: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoginHandler,
        { provide: PROFILE_REPOSITORY, useValue: mockRepository },
        { provide: TokenService, useValue: mockTokenService },
      ],
    }).compile();

    handler = module.get<LoginHandler>(LoginHandler);
    jest.clearAllMocks();
  });

  function createProfileWithPassword(): Profile {
    return Profile.reconstitute({
      id: 'user-1',
      email: Email.create('user@test.com'),
      name: 'John',
      password: Password.fromHash('hashed-password'),
      currency: 'USD',
      hasCompletedOnboarding: true,
      defaultAccountId: null,
      isDemo: false,
      demoExpiresAt: null,
      refreshToken: null,
      dashboardSettings: null,
      quickActionsHidden: false,
      quickActionsHintDismissed: false,
      financialMonthStartDay: 1,
      timezone: 'Asia/Tashkent',
      createdAt: new Date(),
    });
  }

  it('should login with valid credentials and return auth response', async () => {
    const profile = createProfileWithPassword();
    mockRepository.findByEmail.mockResolvedValue(profile);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    mockTokenService.generateTokens.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
    mockTokenService.hashToken.mockReturnValue('hashed-refresh');
    mockRepository.save.mockImplementation((p) => Promise.resolve(p));

    const command = new LoginCommand('user@test.com', 'password123');

    const result = await handler.execute(command);

    expect(result.user.id).toBe('user-1');
    expect(result.user.email).toBe('user@test.com');
    expect(result.user.name).toBe('John');
    expect(result.user.isAnonymous).toBe(false);
    expect(result.tokens.accessToken).toBe('access-token');
    expect(mockRepository.findByEmail).toHaveBeenCalledWith('user@test.com');
    expect(mockRepository.save).toHaveBeenCalled();
  });

  it('should throw UnauthorizedException when email not found', async () => {
    mockRepository.findByEmail.mockResolvedValue(null);

    const command = new LoginCommand('noone@test.com', 'password123');

    await expect(handler.execute(command)).rejects.toThrow(
      expect.objectContaining({ message: 'Invalid credentials' }),
    );
  });

  it('should throw UnauthorizedException when profile has no password (anonymous)', async () => {
    const profile = Profile.reconstitute({
      id: 'user-2',
      email: null,
      name: 'Demo',
      password: null,
      currency: 'UZS',
      hasCompletedOnboarding: false,
      defaultAccountId: null,
      isDemo: true,
      demoExpiresAt: null,
      refreshToken: null,
      dashboardSettings: null,
      quickActionsHidden: false,
      quickActionsHintDismissed: false,
      financialMonthStartDay: 1,
      timezone: 'Asia/Tashkent',
      createdAt: new Date(),
    });
    mockRepository.findByEmail.mockResolvedValue(profile);

    const command = new LoginCommand('user@test.com', 'password123');

    await expect(handler.execute(command)).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when password is wrong', async () => {
    const profile = createProfileWithPassword();
    mockRepository.findByEmail.mockResolvedValue(profile);
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    const command = new LoginCommand('user@test.com', 'wrong-password');

    await expect(handler.execute(command)).rejects.toThrow(
      expect.objectContaining({ message: 'Invalid credentials' }),
    );
    expect(mockRepository.save).not.toHaveBeenCalled();
  });

  it('should lowercase the email before lookup', async () => {
    mockRepository.findByEmail.mockResolvedValue(null);

    const command = new LoginCommand('USER@Test.COM', 'password123');

    await expect(handler.execute(command)).rejects.toThrow(UnauthorizedException);
    expect(mockRepository.findByEmail).toHaveBeenCalledWith('user@test.com');
  });
});
