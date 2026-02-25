import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ConflictException, Inject } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { RegisterCommand } from './register.command';
import { Profile, Email, Password } from '../../../domain';
import {
  IProfileRepository,
  PROFILE_REPOSITORY,
} from '../../../domain/repositories/profile.repository.interface';
import { DomainEventPublisher } from '../../../../../shared';
import { AuthResponse } from '../../services/token.service';
import { TokenService } from '../../services/token.service';

@CommandHandler(RegisterCommand)
export class RegisterHandler implements ICommandHandler<RegisterCommand> {
  constructor(
    @Inject(PROFILE_REPOSITORY)
    private readonly profileRepository: IProfileRepository,
    private readonly tokenService: TokenService,
    private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(command: RegisterCommand): Promise<AuthResponse> {
    // Validate email
    const email = Email.create(command.email);

    // Validate password
    Password.validatePlainText(command.password);

    // Check if user exists
    const exists = await this.profileRepository.existsByEmail(email.value);
    if (exists) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(command.password, 10);

    // Create profile aggregate
    const profile = Profile.createRegistered(
      crypto.randomUUID(),
      email,
      command.name || null,
      passwordHash,
    );

    // Generate tokens
    const tokens = await this.tokenService.generateTokens({
      sub: profile.id,
      email: profile.emailValue || undefined,
      isAnonymous: false,
      isDemo: false,
    });

    // Set refresh token
    const hashedRefreshToken = this.tokenService.hashToken(tokens.refreshToken);
    profile.setRefreshToken(hashedRefreshToken);

    // Save profile
    await this.profileRepository.save(profile);

    // Publish domain events
    await this.eventPublisher.publishEvents(profile);

    return {
      user: {
        id: profile.id,
        email: profile.emailValue,
        name: profile.name,
        isAnonymous: false,
        isDemo: false,
      },
      tokens,
    };
  }
}
