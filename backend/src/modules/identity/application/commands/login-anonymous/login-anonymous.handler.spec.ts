import { Test, type TestingModule } from '@nestjs/testing';
import { LoginAnonymousHandler } from './login-anonymous.handler';
import { PROFILE_REPOSITORY } from '../../../domain/repositories/profile.repository.interface';
import { DomainEventPublisher } from '../../../../../shared';
import { TokenService } from '../../services/token.service';
import { DemoInitializationService } from '../../services/demo-initialization.service';

describe('LoginAnonymousHandler', () => {
  let handler: LoginAnonymousHandler;
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
  const mockEventPublisher = {
    publishEvents: jest.fn(),
    publishEventsFromMultiple: jest.fn(),
  };
  const mockDemoInitService = {
    initializeDemoData: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoginAnonymousHandler,
        { provide: PROFILE_REPOSITORY, useValue: mockRepository },
        { provide: TokenService, useValue: mockTokenService },
        { provide: DomainEventPublisher, useValue: mockEventPublisher },
        { provide: DemoInitializationService, useValue: mockDemoInitService },
      ],
    }).compile();

    handler = module.get<LoginAnonymousHandler>(LoginAnonymousHandler);
    jest.clearAllMocks();
  });

  it('should create a demo user and return auth response', async () => {
    mockRepository.save.mockImplementation((profile) => Promise.resolve(profile));
    mockTokenService.generateTokens.mockResolvedValue({
      accessToken: 'demo-access-token',
      refreshToken: 'demo-refresh-token',
    });
    mockTokenService.hashToken.mockReturnValue('hashed-demo-refresh');
    mockEventPublisher.publishEvents.mockResolvedValue(undefined);
    mockDemoInitService.initializeDemoData.mockResolvedValue(undefined);

    const result = await handler.execute();

    expect(result.user.email).toBeNull();
    expect(result.user.name).toBe('Demo User');
    expect(result.user.isAnonymous).toBe(true);
    expect(result.user.isDemo).toBe(true);
    expect(result.tokens.accessToken).toBe('demo-access-token');
    expect(result.tokens.refreshToken).toBe('demo-refresh-token');
    expect(mockRepository.save).toHaveBeenCalled();
    expect(mockEventPublisher.publishEvents).toHaveBeenCalled();
    expect(mockDemoInitService.initializeDemoData).toHaveBeenCalled();
  });

  it('should generate tokens with isAnonymous=true and isDemo=true', async () => {
    mockRepository.save.mockImplementation((profile) => Promise.resolve(profile));
    mockTokenService.generateTokens.mockResolvedValue({
      accessToken: 'at',
      refreshToken: 'rt',
    });
    mockTokenService.hashToken.mockReturnValue('hashed');
    mockEventPublisher.publishEvents.mockResolvedValue(undefined);
    mockDemoInitService.initializeDemoData.mockResolvedValue(undefined);

    await handler.execute();

    expect(mockTokenService.generateTokens).toHaveBeenCalledWith(
      expect.objectContaining({
        isAnonymous: true,
        isDemo: true,
        email: undefined,
      }),
    );
  });

  it('should continue even if demo data initialization fails', async () => {
    mockRepository.save.mockImplementation((profile) => Promise.resolve(profile));
    mockTokenService.generateTokens.mockResolvedValue({
      accessToken: 'at',
      refreshToken: 'rt',
    });
    mockTokenService.hashToken.mockReturnValue('hashed');
    mockEventPublisher.publishEvents.mockResolvedValue(undefined);
    mockDemoInitService.initializeDemoData.mockRejectedValue(new Error('Init failed'));

    const result = await handler.execute();

    expect(result.user.isDemo).toBe(true);
    expect(result.tokens.accessToken).toBe('at');
  });
});
