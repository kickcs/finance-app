import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UnauthorizedException, Inject } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { LoginCommand } from './login.command';
import {
  IProfileRepository,
  PROFILE_REPOSITORY,
} from '../../../domain/repositories/profile.repository.interface';
import { AuthResponse, TokenService } from '../../services/token.service';

@CommandHandler(LoginCommand)
export class LoginHandler implements ICommandHandler<LoginCommand> {
  constructor(
    @Inject(PROFILE_REPOSITORY)
    private readonly profileRepository: IProfileRepository,
    private readonly tokenService: TokenService,
  ) {}

  async execute(command: LoginCommand): Promise<AuthResponse> {
    const profile = await this.profileRepository.findByEmail(command.email.toLowerCase());

    if (!profile?.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(command.password, profile.password.hashedValue);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate tokens
    const tokens = await this.tokenService.generateTokens({
      sub: profile.id,
      email: profile.emailValue || undefined,
      isAnonymous: false,
      isDemo: profile.isDemo,
    });

    // Update refresh token
    const hashedRefreshToken = this.tokenService.hashToken(tokens.refreshToken);
    profile.setRefreshToken(hashedRefreshToken);
    await this.profileRepository.save(profile);

    return {
      user: {
        id: profile.id,
        email: profile.emailValue,
        name: profile.name,
        isAnonymous: false,
        isDemo: profile.isDemo,
      },
      tokens,
    };
  }
}
