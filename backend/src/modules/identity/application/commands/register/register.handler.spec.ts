import { Test, type TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { RegisterHandler } from './register.handler';
import { RegisterCommand } from './register.command';
import { PROFILE_REPOSITORY } from '../../../domain/repositories/profile.repository.interface';
import { DomainEventPublisher } from '../../../../../shared';
import { TokenService } from '../../services/token.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
}));

describe('RegisterHandler', () => {
  let handler: RegisterHandler;
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RegisterHandler,
        { provide: PROFILE_REPOSITORY, useValue: mockRepository },
        { provide: TokenService, useValue: mockTokenService },
        { provide: DomainEventPublisher, useValue: mockEventPublisher },
      ],
    }).compile();

    handler = module.get<RegisterHandler>(RegisterHandler);
    jest.clearAllMocks();
  });

  it('should register a new user and return auth response', async () => {
    mockRepository.existsByEmail.mockResolvedValue(false);
    mockRepository.save.mockImplementation((profile) => Promise.resolve(profile));
    mockTokenService.generateTokens.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
    mockTokenService.hashToken.mockReturnValue('hashed-refresh-token');
    mockEventPublisher.publishEvents.mockResolvedValue(undefined);

    const command = new RegisterCommand('user@test.com', 'password123', 'John');

    const result = await handler.execute(command);

    expect(result.user.email).toBe('user@test.com');
    expect(result.user.name).toBe('John');
    expect(result.user.isAnonymous).toBe(false);
    expect(result.user.isDemo).toBe(false);
    expect(result.tokens.accessToken).toBe('access-token');
    expect(result.tokens.refreshToken).toBe('refresh-token');
    expect(mockRepository.existsByEmail).toHaveBeenCalledWith('user@test.com');
    expect(mockRepository.save).toHaveBeenCalled();
    expect(mockEventPublisher.publishEvents).toHaveBeenCalled();
  });

  it('should throw ConflictException if email already exists', async () => {
    mockRepository.existsByEmail.mockResolvedValue(true);

    const command = new RegisterCommand('existing@test.com', 'password123');

    await expect(handler.execute(command)).rejects.toThrow(ConflictException);
    await expect(handler.execute(command)).rejects.toThrow('User with this email already exists');
    expect(mockRepository.save).not.toHaveBeenCalled();
  });

  it('should throw for an invalid email format', async () => {
    const command = new RegisterCommand('not-an-email', 'password123');

    await expect(handler.execute(command)).rejects.toThrow('Invalid email address');
  });

  it('should throw for a short password', async () => {
    const command = new RegisterCommand('user@test.com', '12345');

    await expect(handler.execute(command)).rejects.toThrow(
      'Password must be at least 6 characters long',
    );
  });

  it('should register without a name when name is not provided', async () => {
    mockRepository.existsByEmail.mockResolvedValue(false);
    mockRepository.save.mockImplementation((profile) => Promise.resolve(profile));
    mockTokenService.generateTokens.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
    mockTokenService.hashToken.mockReturnValue('hashed-refresh-token');
    mockEventPublisher.publishEvents.mockResolvedValue(undefined);

    const command = new RegisterCommand('user@test.com', 'password123');

    const result = await handler.execute(command);

    expect(result.user.name).toBeNull();
  });
});
