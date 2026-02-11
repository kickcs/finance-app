import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { JwtPayload, AuthTokens, AuthResponse } from '../types';

export { JwtPayload, AuthTokens, AuthResponse };

// Demo account token lifetime (1 hour) - matches demo account duration
const DEMO_ACCESS_TOKEN_EXPIRY = '15m';
const DEMO_REFRESH_TOKEN_EXPIRY = '1h';

// Regular account token lifetime
const REGULAR_ACCESS_TOKEN_EXPIRY = '15m';
const REGULAR_REFRESH_TOKEN_EXPIRY = '7d';

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Generate tokens with appropriate lifetime based on account type
   * Demo accounts get shorter-lived refresh tokens (1 hour)
   * Regular accounts get standard refresh tokens (7 days)
   */
  async generateTokens(payload: JwtPayload): Promise<AuthTokens> {
    const isDemo = payload.isDemo ?? false;

    const accessExpiry = isDemo
      ? DEMO_ACCESS_TOKEN_EXPIRY
      : REGULAR_ACCESS_TOKEN_EXPIRY;
    const refreshExpiry = isDemo
      ? DEMO_REFRESH_TOKEN_EXPIRY
      : REGULAR_REFRESH_TOKEN_EXPIRY;

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        expiresIn: accessExpiry,
      }),
      this.jwtService.signAsync(payload, {
        expiresIn: refreshExpiry,
      }),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }

  verifyToken(token: string): JwtPayload {
    return this.jwtService.verify<JwtPayload>(token, {
      secret: this.configService.get<string>('jwt.secret'),
    });
  }
}
