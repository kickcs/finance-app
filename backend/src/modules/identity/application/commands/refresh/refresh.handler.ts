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
      // Verify refresh token JWT (signature + expiry)
      const payload = this.tokenService.verifyToken(command.refreshToken);

      const profile = await this.profileRepository.findById(payload.sub);

      if (!profile?.refreshToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      if (profile.isDemo && profile.isExpired()) {
        this.logger.debug(`Demo account ${profile.id} has expired, rejecting refresh`);
        throw new UnauthorizedException('Demo account has expired');
      }

      // Compare incoming token hash against stored hash to detect reuse of rotated tokens
      const incomingHash = this.tokenService.hashToken(command.refreshToken);
      if (incomingHash !== profile.refreshToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const tokens = await this.tokenService.generateTokens({
        sub: profile.id,
        email: profile.emailValue ?? undefined,
        isAnonymous: payload.isAnonymous,
        isDemo: profile.isDemo,
      });

      // Rotate refresh token: write new hashed token so the old one is invalidated
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
