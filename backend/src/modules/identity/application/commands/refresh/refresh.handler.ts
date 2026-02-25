import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UnauthorizedException, Inject, Logger } from '@nestjs/common';
import { RefreshCommand } from './refresh.command';
import {
  IProfileRepository,
  PROFILE_REPOSITORY,
} from '../../../domain/repositories/profile.repository.interface';
import { AuthTokens, TokenService } from '../../services/token.service';

@CommandHandler(RefreshCommand)
export class RefreshHandler implements ICommandHandler<RefreshCommand> {
  private readonly logger = new Logger(RefreshHandler.name);

  constructor(
    @Inject(PROFILE_REPOSITORY)
    private readonly profileRepository: IProfileRepository,
    private readonly tokenService: TokenService,
  ) {}

  async execute(command: RefreshCommand): Promise<AuthTokens> {
    try {
      // Verify refresh token
      const payload = this.tokenService.verifyToken(command.refreshToken);

      const profile = await this.profileRepository.findById(payload.sub);

      if (!profile?.refreshToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Check if demo account has expired
      if (profile.isDemo && profile.isExpired()) {
        this.logger.debug(`Demo account ${profile.id} has expired, rejecting refresh`);
        throw new UnauthorizedException('Demo account has expired');
      }

      // Verify stored refresh token matches (SHA-256 hash comparison).
      // NOTE: Migrated from bcrypt to SHA-256. Existing bcrypt hashes will fail
      // this comparison, forcing a one-time re-login for all active sessions on deploy.
      const hashedInput = this.tokenService.hashToken(command.refreshToken);
      const isValid = hashedInput === profile.refreshToken;
      if (!isValid) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Generate new tokens
      const tokens = await this.tokenService.generateTokens({
        sub: profile.id,
        email: profile.emailValue || undefined,
        isAnonymous: payload.isAnonymous,
        isDemo: profile.isDemo,
      });

      // Update refresh token
      const hashedRefreshToken = this.tokenService.hashToken(tokens.refreshToken);
      profile.setRefreshToken(hashedRefreshToken);
      await this.profileRepository.save(profile);

      return tokens;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
