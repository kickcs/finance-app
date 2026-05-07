import { Test, type TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { RefreshHandler } from './refresh.handler';
import { RefreshCommand } from './refresh.command';
import { PROFILE_REPOSITORY } from '../../../domain/repositories/profile.repository.interface';
import { TokenService } from '../../services/token.service';
import { Profile, Email } from '../../../domain';

describe('RefreshHandler', () => {
  let handler: RefreshHandler;
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
        RefreshHandler,
        { provide: PROFILE_REPOSITORY, useValue: mockRepository },
        { provide: TokenService, useValue: mockTokenService },
      ],
    }).compile();

    handler = module.get<RefreshHandler>(RefreshHandler);
    jest.clearAllMocks();
  });

  function createProfile(
    overrides: { refreshToken?: string | null; isDemo?: boolean; demoExpiresAt?: Date | null } = {},
  ): Profile {
    return Profile.reconstitute({
      id: 'user-1',
      email: Email.create('user@test.com'),
      name: 'John',
      password: null,
      currency: 'USD',
      hasCompletedOnboarding: true,
      defaultAccountId: null,
      isDemo: overrides.isDemo !== undefined ? overrides.isDemo : false,
      demoExpiresAt: overrides.demoExpiresAt !== undefined ? overrides.demoExpiresAt : null,
      refreshToken:
        'refreshToken' in overrides ? (overrides.refreshToken as string | null) : 'stored-hash',
      dashboardSettings: null,
      quickActionsHidden: false,
      quickActionsHintDismissed: false,
      financialMonthStartDay: 1,
      timezone: 'Asia/Tashkent',
      notificationHour: 12,
      createdAt: new Date(),
    });
  }

  it('should refresh tokens for a valid refresh token', async () => {
    mockTokenService.verifyToken.mockReturnValue({
      sub: 'user-1',
      email: 'user@test.com',
      isAnonymous: false,
      isDemo: false,
    });
    const profile = createProfile({ refreshToken: 'stored-hash' });
    mockRepository.findById.mockResolvedValue(profile);
    mockTokenService.generateTokens.mockResolvedValue({
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
    });

    const command = new RefreshCommand('valid-refresh-token');
    const result = await handler.execute(command);

    expect(result.accessToken).toBe('new-access');
    expect(result.refreshToken).toBe('new-refresh');
    expect(mockTokenService.verifyToken).toHaveBeenCalledWith('valid-refresh-token');
    expect(mockRepository.findById).toHaveBeenCalledWith('user-1');
  });

  it('should throw UnauthorizedException when JWT verification fails', async () => {
    mockTokenService.verifyToken.mockImplementation(() => {
      throw new Error('Invalid token');
    });

    const command = new RefreshCommand('invalid-jwt');

    await expect(handler.execute(command)).rejects.toThrow(UnauthorizedException);
    await expect(handler.execute(command)).rejects.toThrow('Invalid refresh token');
  });

  it('should throw UnauthorizedException when profile not found', async () => {
    mockTokenService.verifyToken.mockReturnValue({
      sub: 'missing-user',
      isAnonymous: false,
      isDemo: false,
    });
    mockRepository.findById.mockResolvedValue(null);

    const command = new RefreshCommand('valid-jwt');

    await expect(handler.execute(command)).rejects.toThrow(UnauthorizedException);
    await expect(handler.execute(command)).rejects.toThrow('Invalid refresh token');
  });

  it('should throw UnauthorizedException when profile has no refresh token (logged out)', async () => {
    mockTokenService.verifyToken.mockReturnValue({
      sub: 'user-1',
      isAnonymous: false,
      isDemo: false,
    });
    const profile = createProfile({ refreshToken: null });
    mockRepository.findById.mockResolvedValue(profile);

    const command = new RefreshCommand('valid-jwt');

    await expect(handler.execute(command)).rejects.toThrow(UnauthorizedException);
    await expect(handler.execute(command)).rejects.toThrow('Invalid refresh token');
  });

  it('should throw UnauthorizedException when demo account has expired', async () => {
    mockTokenService.verifyToken.mockReturnValue({
      sub: 'user-1',
      isAnonymous: true,
      isDemo: true,
    });
    const profile = createProfile({
      isDemo: true,
      demoExpiresAt: new Date(Date.now() - 1000),
      refreshToken: 'stored-hash',
    });
    mockRepository.findById.mockResolvedValue(profile);

    const command = new RefreshCommand('valid-jwt');

    await expect(handler.execute(command)).rejects.toThrow(UnauthorizedException);
    await expect(handler.execute(command)).rejects.toThrow('Demo account has expired');
  });

  it('should pass through isAnonymous from the original token payload', async () => {
    mockTokenService.verifyToken.mockReturnValue({
      sub: 'user-1',
      isAnonymous: true,
      isDemo: false,
    });
    const profile = createProfile({ refreshToken: 'stored-hash' });
    mockRepository.findById.mockResolvedValue(profile);
    mockTokenService.generateTokens.mockResolvedValue({
      accessToken: 'at',
      refreshToken: 'rt',
    });

    await handler.execute(new RefreshCommand('refresh-token'));

    expect(mockTokenService.generateTokens).toHaveBeenCalledWith(
      expect.objectContaining({ isAnonymous: true }),
    );
  });
});
