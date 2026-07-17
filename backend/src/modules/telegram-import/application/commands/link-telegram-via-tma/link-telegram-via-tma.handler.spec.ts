import { createHmac } from 'crypto';
import { UnauthorizedException } from '@nestjs/common';
import { LinkTelegramViaTmaHandler } from './link-telegram-via-tma.handler';
import { LinkTelegramViaTmaCommand } from './link-telegram-via-tma.command';

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

function makeHandler(existingByTg: { userId: string } | null) {
  const linkRepo = {
    findByTelegramUserId: jest.fn().mockResolvedValue(existingByTg),
    deleteByUserId: jest.fn().mockResolvedValue(undefined),
    save: jest.fn().mockResolvedValue(undefined),
  };
  const config = { get: jest.fn().mockReturnValue(BOT_TOKEN) };
  return { handler: new LinkTelegramViaTmaHandler(config as never, linkRepo as never), linkRepo };
}

describe('LinkTelegramViaTmaHandler', () => {
  it('создаёт связь: чистит старую по userId и сохраняет новую', async () => {
    const { handler, linkRepo } = makeHandler(null);
    const result = await handler.execute(
      new LinkTelegramViaTmaCommand('user-1', buildInitData(42)),
    );
    expect(result).toBe('linked');
    expect(linkRepo.deleteByUserId).toHaveBeenCalledWith('user-1');
    expect(linkRepo.save).toHaveBeenCalledWith({
      userId: 'user-1',
      telegramUserId: '42',
      telegramUsername: 'kickcs',
    });
  });

  it('этот Telegram уже у другого userId → already_linked_other, ничего не пишет', async () => {
    const { handler, linkRepo } = makeHandler({ userId: 'other-user' });
    const result = await handler.execute(
      new LinkTelegramViaTmaCommand('user-1', buildInitData(42)),
    );
    expect(result).toBe('already_linked_other');
    expect(linkRepo.save).not.toHaveBeenCalled();
  });

  it('повторная привязка своего же Telegram → linked (идемпотентно)', async () => {
    const { handler } = makeHandler({ userId: 'user-1' });
    await expect(
      handler.execute(new LinkTelegramViaTmaCommand('user-1', buildInitData(42))),
    ).resolves.toBe('linked');
  });

  it('невалидный initData → UnauthorizedException', async () => {
    const { handler } = makeHandler(null);
    await expect(
      handler.execute(new LinkTelegramViaTmaCommand('user-1', 'garbage')),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
