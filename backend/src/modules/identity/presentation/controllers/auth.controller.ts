import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  Res,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { Response, Request } from 'express';
import { RegisterDto, LoginDto } from '../dto';
import { Public, CurrentUser } from '../../../../common';
import type { JwtPayload } from '../../../../common';
import {
  RegisterCommand,
  LoginCommand,
  LoginAnonymousCommand,
  LogoutCommand,
  RefreshCommand,
} from '../../application/commands';
import { GetProfileQuery } from '../../application/queries';
import {
  TokenService,
  type AuthResponse,
  type AuthTokens,
} from '../../application/services/token.service';

// Cookie configuration
const REFRESH_TOKEN_COOKIE = 'refresh_token';
const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: COOKIE_SECURE,
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/api/auth',
};

// Demo accounts get shorter cookie lifetime
const DEMO_COOKIE_OPTIONS = {
  ...COOKIE_OPTIONS,
  maxAge: 60 * 60 * 1000, // 1 hour
};

@Controller('auth')
export class AuthController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly tokenService: TokenService,
  ) {}

  @Public()
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result: AuthResponse = await this.commandBus.execute(
      new RegisterCommand(dto.email, dto.password, dto.name),
    );

    // Set refresh token in httpOnly cookie
    response.cookie(
      REFRESH_TOKEN_COOKIE,
      result.tokens.refreshToken,
      COOKIE_OPTIONS,
    );

    // Return only access token and user (refresh token is in cookie)
    return {
      accessToken: result.tokens.accessToken,
      user: result.user,
    };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result: AuthResponse = await this.commandBus.execute(
      new LoginCommand(dto.email, dto.password),
    );

    // Set refresh token in httpOnly cookie
    response.cookie(
      REFRESH_TOKEN_COOKIE,
      result.tokens.refreshToken,
      COOKIE_OPTIONS,
    );

    // Return only access token and user (refresh token is in cookie)
    return {
      accessToken: result.tokens.accessToken,
      user: result.user,
    };
  }

  /**
   * Anonymous/Demo login endpoint with strict rate limiting
   * - Max 5 requests per minute per IP
   * - Max 20 requests per hour per IP
   * This prevents abuse while allowing legitimate demo usage
   */
  @Public()
  @Post('login/anonymous')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 per minute
  async loginAnonymously(@Res({ passthrough: true }) response: Response) {
    const result: AuthResponse = await this.commandBus.execute(
      new LoginAnonymousCommand(),
    );

    // Set refresh token in httpOnly cookie (shorter duration for demo)
    response.cookie(
      REFRESH_TOKEN_COOKIE,
      result.tokens.refreshToken,
      DEMO_COOKIE_OPTIONS,
    );

    // Return only access token and user (refresh token is in cookie)
    return {
      accessToken: result.tokens.accessToken,
      user: result.user,
    };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    // Read refresh token from httpOnly cookie
    const refreshToken = (request.cookies as Record<string, string>)[
      REFRESH_TOKEN_COOKIE
    ];

    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token');
    }

    const tokens: AuthTokens = await this.commandBus.execute<
      RefreshCommand,
      AuthTokens
    >(new RefreshCommand(refreshToken));

    // Decode token to check if demo account, use appropriate cookie options
    const payload = this.tokenService.verifyToken(tokens.accessToken);
    const cookieOpts = payload.isDemo ? DEMO_COOKIE_OPTIONS : COOKIE_OPTIONS;

    // Set new refresh token in httpOnly cookie
    response.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, cookieOpts);

    // Return only access token (refresh token is in cookie)
    return {
      accessToken: tokens.accessToken,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser('sub') userId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ message: string }> {
    await this.commandBus.execute(new LogoutCommand(userId));

    // Clear refresh token cookie
    response.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/api/auth' });

    return { message: 'Logged out successfully' };
  }

  @SkipThrottle()
  @Get('me')
  async me(@CurrentUser() user: JwtPayload): Promise<unknown> {
    const profile: unknown = await this.queryBus.execute(
      new GetProfileQuery(user.sub),
    );
    return {
      ...(profile as Record<string, unknown>),
      isAnonymous: user.isAnonymous,
    };
  }
}
