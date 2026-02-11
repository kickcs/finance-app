import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { LoginAnonymousCommand } from './login-anonymous.command';
import { Profile } from '../../../domain';
import {
  IProfileRepository,
  PROFILE_REPOSITORY,
} from '../../../domain/repositories/profile.repository.interface';
import { DomainEventPublisher } from '../../../../../shared';
import {
  AuthResponse,
  TokenService,
  DemoInitializationService,
} from '../../services';

// Demo account duration: 1 hour
const DEMO_DURATION_MS = 60 * 60 * 1000;

@CommandHandler(LoginAnonymousCommand)
export class LoginAnonymousHandler implements ICommandHandler<LoginAnonymousCommand> {
  private readonly logger = new Logger(LoginAnonymousHandler.name);

  constructor(
    @Inject(PROFILE_REPOSITORY)
    private readonly profileRepository: IProfileRepository,
    private readonly tokenService: TokenService,
    private readonly eventPublisher: DomainEventPublisher,
    private readonly demoInitializationService: DemoInitializationService,
  ) {}

  async execute(): Promise<AuthResponse> {
    // Create demo profile with 1 hour expiry
    // Use a single timestamp to ensure consistency between profile and tokens
    const expiresAt = new Date(Date.now() + DEMO_DURATION_MS);
    const profile = Profile.createDemo(crypto.randomUUID(), expiresAt);

    // Generate tokens with demo-appropriate lifetime
    const tokens = await this.tokenService.generateTokens({
      sub: profile.id,
      email: undefined,
      isAnonymous: true,
      isDemo: true,
    });

    // Set refresh token
    const hashedRefreshToken = await bcrypt.hash(tokens.refreshToken, 10);
    profile.setRefreshToken(hashedRefreshToken);

    // Save profile first
    await this.profileRepository.save(profile);

    // Publish domain events
    await this.eventPublisher.publishEvents(profile);

    // Initialize demo data (accounts, transactions, debts, reminders)
    // This is done atomically on the server to ensure consistency
    try {
      await this.demoInitializationService.initializeDemoData(profile);
    } catch (error) {
      this.logger.error(
        `Failed to initialize demo data for user ${profile.id}`,
        error,
      );
      // Continue anyway - user can still use the app, just without demo data
    }

    return {
      user: {
        id: profile.id,
        email: null,
        name: profile.name,
        isAnonymous: true,
        isDemo: true,
      },
      tokens,
    };
  }
}
