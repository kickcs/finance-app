import { createHmac } from 'crypto';
import { UnauthorizedException, ServiceUnavailableException } from '@nestjs/common';
import { TmaAuthHandler } from './tma-auth.handler';
import { TmaAuthCommand } from './tma-auth.command';

const BOT_TOKEN = '123456:TEST-TOKEN';

function buildInitData(telegramUserId: number): string {
  const fields: Record<string, string> = {
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify({ id: telegramUserId, username: 'kickcs' }),
  };
  const dataCheckString = Object.entries(fields)
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('\n');
  const secretKey = createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const hash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  const params = new URLSearchParams(fields);
  params.set('hash', hash);
  return params.toString();
}

const PROFILE = {
  id: 'user-1',
  emailValue: 'a@b.c',
  name: 'A',
  isDemo: false,
  setRefreshToken: jest.fn(),
};

function makeHandler(overrides?: {
  link?: unknown;
  profile?: unknown;
  botToken?: string | undefined;
}) {
  const linkRepo = {
    findByTelegramUserId: jest
      .fn()
      .mockResolvedValue(
        overrides && 'link' in overrides
          ? overrides.link
          : { userId: 'user-1', telegramUserId: '42' },
      ),
  };
  const profileRepo = {
    findById: jest
      .fn()
      .mockResolvedValue(overrides && 'profile' in overrides ? overrides.profile : PROFILE),
    save: jest.fn(),
  };
  const tokenService = {
    generateTokens: jest.fn().mockResolvedValue({ accessToken: 'access', refreshToken: 'refresh' }),
    hashToken: jest.fn().mockReturnValue('hashed'),
  };
  const config = {
    get: jest
      .fn()
      .mockReturnValue(overrides && 'botToken' in overrides ? overrides.botToken : BOT_TOKEN),
  };
  const handler = new TmaAuthHandler(
    config as never,
    linkRepo as never,
    profileRepo as never,
    tokenService as never,
  );
  return { handler, linkRepo, profileRepo, tokenService };
}

describe('TmaAuthHandler', () => {
  it('привязанный пользователь → linked:true, зеркало login-ответа, refresh сохранён', async () => {
    const { handler, profileRepo, tokenService } = makeHandler();
    const result = await handler.execute(new TmaAuthCommand(buildInitData(42)));
    expect(result).toEqual({
      linked: true,
      auth: {
        user: { id: 'user-1', email: 'a@b.c', name: 'A', isAnonymous: false, isDemo: false },
        tokens: { accessToken: 'access', refreshToken: 'refresh' },
      },
    });
    expect(tokenService.generateTokens).toHaveBeenCalledWith({
      sub: 'user-1',
      email: 'a@b.c',
      isAnonymous: false,
      isDemo: false,
    });
    expect(PROFILE.setRefreshToken).toHaveBeenCalledWith('hashed');
    expect(profileRepo.save).toHaveBeenCalled();
  });

  it('нет связи → linked:false', async () => {
    const { handler } = makeHandler({ link: null });
    await expect(handler.execute(new TmaAuthCommand(buildInitData(42)))).resolves.toEqual({
      linked: false,
    });
  });

  it('связь есть, профиль удалён → linked:false', async () => {
    const { handler } = makeHandler({ profile: null });
    await expect(handler.execute(new TmaAuthCommand(buildInitData(42)))).resolves.toEqual({
      linked: false,
    });
  });

  it('невалидный initData → UnauthorizedException', async () => {
    const { handler } = makeHandler();
    await expect(handler.execute(new TmaAuthCommand('garbage'))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('нет bot token → ServiceUnavailableException', async () => {
    const { handler } = makeHandler({ botToken: undefined });
    await expect(handler.execute(new TmaAuthCommand(buildInitData(42)))).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
