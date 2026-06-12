import { Test, type TestingModule } from '@nestjs/testing';
import { LinkTelegramAccountHandler } from './link-telegram-account.handler';
import { LinkTelegramAccountCommand } from './link-telegram-account.command';
import { LINK_TOKEN_REPOSITORY } from '../../../domain/repositories/link-token.repository.interface';
import { TELEGRAM_LINK_REPOSITORY } from '../../../domain/repositories/telegram-link.repository.interface';

describe('LinkTelegramAccountHandler', () => {
  let handler: LinkTelegramAccountHandler;
  const tokenRepo = { create: jest.fn(), consume: jest.fn() };
  const linkRepo = {
    findByUserId: jest.fn(),
    findByTelegramUserId: jest.fn(),
    save: jest.fn(),
    deleteByUserId: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LinkTelegramAccountHandler,
        { provide: LINK_TOKEN_REPOSITORY, useValue: tokenRepo },
        { provide: TELEGRAM_LINK_REPOSITORY, useValue: linkRepo },
      ],
    }).compile();
    handler = module.get(LinkTelegramAccountHandler);
    jest.clearAllMocks();
  });

  it('линкует при валидном токене (и убирает старую связь пользователя)', async () => {
    tokenRepo.consume.mockResolvedValue('user-1');
    linkRepo.findByTelegramUserId.mockResolvedValue(null);
    linkRepo.save.mockImplementation((l) =>
      Promise.resolve({ id: 'x', createdAt: new Date(), ...l }),
    );

    const result = await handler.execute(new LinkTelegramAccountCommand('tok', '42', 'andi'));

    expect(result).toBe('linked');
    expect(linkRepo.deleteByUserId).toHaveBeenCalledWith('user-1');
    expect(linkRepo.save).toHaveBeenCalledWith({
      userId: 'user-1',
      telegramUserId: '42',
      telegramUsername: 'andi',
    });
  });

  it('invalid_token при невалидном токене', async () => {
    tokenRepo.consume.mockResolvedValue(null);
    expect(await handler.execute(new LinkTelegramAccountCommand('bad', '42', null))).toBe(
      'invalid_token',
    );
  });

  it('already_linked_other, если TG привязан к другому пользователю', async () => {
    tokenRepo.consume.mockResolvedValue('user-1');
    linkRepo.findByTelegramUserId.mockResolvedValue({ userId: 'user-2', telegramUserId: '42' });
    expect(await handler.execute(new LinkTelegramAccountCommand('tok', '42', null))).toBe(
      'already_linked_other',
    );
  });

  it('перелинковка того же пользователя — ок', async () => {
    tokenRepo.consume.mockResolvedValue('user-1');
    linkRepo.findByTelegramUserId.mockResolvedValue({ userId: 'user-1', telegramUserId: '42' });
    linkRepo.save.mockImplementation((l) => Promise.resolve(l));
    expect(await handler.execute(new LinkTelegramAccountCommand('tok', '42', null))).toBe('linked');
  });
});
