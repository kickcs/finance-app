import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import {
  IProfileRepository,
  PROFILE_REPOSITORY,
} from '../../domain/repositories/profile.repository.interface';
import { JwtPayload } from '../../application/types';

export { JwtPayload };

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    @Inject(PROFILE_REPOSITORY)
    private readonly profileRepository: IProfileRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('jwt.secret'),
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    const profile = await this.profileRepository.findById(payload.sub);

    if (!profile) {
      throw new UnauthorizedException('User not found');
    }

    // Check if demo account expired
    if (profile.isExpired()) {
      throw new UnauthorizedException('Demo account has expired');
    }

    return payload;
  }
}
