# Telegram Mini App для импорта транзакций — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Пользователь подтверждает импортированные банковские операции, не покидая Telegram, — через Mini App, открывающийся кнопками из ответов бота; привязка аккаунта — логином внутри Mini App.

**Architecture:** TMA — это существующий Vue SPA: публичный роут `/tma` аутентифицируется по `Telegram.WebApp.initData` через новый эндпоинт `POST /api/telegram-import/tma-auth` (HMAC-валидация → выдача штатного JWT + refresh-cookie) и редиректит на существующий инбокс импорта. Бот получает `web_app` inline-кнопки и menu button. Спека: `docs/superpowers/specs/2026-07-17-telegram-mini-app-import-design.md`.

**Tech Stack:** NestJS 11 + CQRS + grammY (backend), Vue 3 + vue-i18n + TanStack Query (frontend), node:crypto HMAC.

## Global Constraints

- **НЕ коммитить** — пользователь коммитит сам (feedback_no_commits). Шагов `git commit` в плане нет намеренно.
- Новых env-переменных нет: URL Mini App = `PUBLIC_APP_URL` + `/tma`; нет `PUBLIC_APP_URL` → кнопки и menu button просто не ставятся (warn), бот работает как раньше.
- Все пользовательские строки — через i18n: backend `backend/src/i18n/{ru,en}/telegram.json` (nestjs-i18n), frontend — per-slice `locales/{ru,en}.json` (namespace из FSD-пути, см. `frontend/src/shared/i18n/index.ts`). Никаких захардкоженных строк в компонентах.
- Backend: TS-тесты Jest колокацией (`*.spec.ts` рядом с кодом), запуск `cd backend && bun run test -- --testPathPattern=<pattern>`.
- Тесты запускать через subagent `test-runner` (Sonnet), не в основном контексте.
- Дизайн-токены фронта: только семантические (`bg-background-light dark:bg-background-dark` и т.п.), компоненты из `shared/ui` (`UButton`, `UInput`, `USpinner`, `EmptyState`).
- Окно свежести `auth_date` initData — **1 час** (3600 с).
- Троттлинг `tma-auth` — 10/min (`@Throttle`).

---

### Task 1: Валидатор initData (backend, TDD)

**Files:**
- Create: `backend/src/modules/telegram-import/domain/tma/init-data.validator.ts`
- Create: `backend/src/modules/telegram-import/domain/tma/init-data.validator.spec.ts`

**Interfaces:**
- Consumes: только `node:crypto`.
- Produces: `validateTmaInitData(initData: string, botToken: string, nowMs?: number): TmaInitData | null`; `interface TmaInitData { telegramUserId: string; telegramUsername: string | null }`; `INIT_DATA_MAX_AGE_SECONDS = 3600`.

- [ ] **Step 1: Написать падающий тест**

`init-data.validator.spec.ts`:

```ts
import { createHmac } from 'crypto';
import { validateTmaInitData } from './init-data.validator';

const BOT_TOKEN = '123456:TEST-TOKEN';

/** Собирает валидный initData тем же алгоритмом, что описан в доке Telegram */
function buildInitData(
  fields: Record<string, string>,
  token: string = BOT_TOKEN,
  tamperHash?: string,
): string {
  const dataCheckString = Object.entries(fields)
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('\n');
  const secretKey = createHmac('sha256', 'WebAppData').update(token).digest();
  const hash = tamperHash ?? createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  const params = new URLSearchParams(fields);
  params.set('hash', hash);
  return params.toString();
}

const NOW_MS = 1_800_000_000_000; // фиксированное "сейчас"
const FRESH_AUTH_DATE = String(Math.floor(NOW_MS / 1000) - 60);
const USER_JSON = JSON.stringify({ id: 42, username: 'kickcs', first_name: 'A' });

describe('validateTmaInitData', () => {
  it('валидный initData → telegramUserId и username', () => {
    const initData = buildInitData({ auth_date: FRESH_AUTH_DATE, user: USER_JSON });
    expect(validateTmaInitData(initData, BOT_TOKEN, NOW_MS)).toEqual({
      telegramUserId: '42',
      telegramUsername: 'kickcs',
    });
  });

  it('user без username → telegramUsername null', () => {
    const initData = buildInitData({
      auth_date: FRESH_AUTH_DATE,
      user: JSON.stringify({ id: 42, first_name: 'A' }),
    });
    expect(validateTmaInitData(initData, BOT_TOKEN, NOW_MS)?.telegramUsername).toBeNull();
  });

  it('подделанный hash → null', () => {
    const initData = buildInitData(
      { auth_date: FRESH_AUTH_DATE, user: USER_JSON },
      BOT_TOKEN,
      'a'.repeat(64),
    );
    expect(validateTmaInitData(initData, BOT_TOKEN, NOW_MS)).toBeNull();
  });

  it('изменённое поле после подписи → null', () => {
    const initData = buildInitData({ auth_date: FRESH_AUTH_DATE, user: USER_JSON });
    const tampered = initData.replace('%22id%22%3A42', '%22id%22%3A43');
    expect(validateTmaInitData(tampered, BOT_TOKEN, NOW_MS)).toBeNull();
  });

  it('чужой bot token → null', () => {
    const initData = buildInitData({ auth_date: FRESH_AUTH_DATE, user: USER_JSON }, 'other:token');
    expect(validateTmaInitData(initData, BOT_TOKEN, NOW_MS)).toBeNull();
  });

  it('auth_date старше часа → null', () => {
    const stale = String(Math.floor(NOW_MS / 1000) - 3601);
    const initData = buildInitData({ auth_date: stale, user: USER_JSON });
    expect(validateTmaInitData(initData, BOT_TOKEN, NOW_MS)).toBeNull();
  });

  it('нет поля user → null', () => {
    const initData = buildInitData({ auth_date: FRESH_AUTH_DATE });
    expect(validateTmaInitData(initData, BOT_TOKEN, NOW_MS)).toBeNull();
  });

  it('битый hash не hex-длины / пустая строка / пустой токен → null', () => {
    const initData = buildInitData(
      { auth_date: FRESH_AUTH_DATE, user: USER_JSON },
      BOT_TOKEN,
      'zz',
    );
    expect(validateTmaInitData(initData, BOT_TOKEN, NOW_MS)).toBeNull();
    expect(validateTmaInitData('', BOT_TOKEN, NOW_MS)).toBeNull();
    const ok = buildInitData({ auth_date: FRESH_AUTH_DATE, user: USER_JSON });
    expect(validateTmaInitData(ok, '', NOW_MS)).toBeNull();
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Через subagent test-runner: `cd backend && bun run test -- --testPathPattern=init-data`
Ожидание: FAIL — «Cannot find module './init-data.validator'».

- [ ] **Step 3: Реализация**

`init-data.validator.ts`:

```ts
import { createHmac, timingSafeEqual } from 'crypto';

export interface TmaInitData {
  telegramUserId: string;
  telegramUsername: string | null;
}

export const INIT_DATA_MAX_AGE_SECONDS = 3600;

/**
 * Валидация initData Telegram Mini App по алгоритму из
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 * secret_key = HMAC_SHA256(key="WebAppData", data=bot_token);
 * hash = hex(HMAC_SHA256(data_check_string, secret_key)).
 */
export function validateTmaInitData(
  initData: string,
  botToken: string,
  nowMs: number = Date.now(),
): TmaInitData | null {
  if (!initData || !botToken) return null;

  const params = new URLSearchParams(initData);
  const receivedHash = params.get('hash');
  if (!receivedHash) return null;
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join('\n');

  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const computedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  const computed = Buffer.from(computedHash, 'hex');
  const received = Buffer.from(receivedHash, 'hex');
  if (computed.length !== received.length || !timingSafeEqual(computed, received)) return null;

  const authDate = Number(params.get('auth_date'));
  if (!Number.isFinite(authDate)) return null;
  if (nowMs / 1000 - authDate > INIT_DATA_MAX_AGE_SECONDS) return null;

  const userJson = params.get('user');
  if (!userJson) return null;
  try {
    const user = JSON.parse(userJson) as { id?: number | string; username?: string };
    if (user.id === undefined || user.id === null) return null;
    return {
      telegramUserId: String(user.id),
      telegramUsername: user.username ?? null,
    };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Тесты зелёные**

test-runner: `cd backend && bun run test -- --testPathPattern=init-data` → PASS (8 тестов).

---

### Task 2: Identity — экспорт TokenService и вынос cookie-констант

**Files:**
- Create: `backend/src/modules/identity/presentation/cookie.constants.ts`
- Modify: `backend/src/modules/identity/presentation/controllers/auth.controller.ts:32-47` (удалить локальные константы, импортировать новые)
- Modify: `backend/src/modules/identity/identity.module.ts:97` (`exports`)

**Interfaces:**
- Produces: `REFRESH_TOKEN_COOKIE: string`, `COOKIE_OPTIONS`, `DEMO_COOKIE_OPTIONS` из `cookie.constants.ts`; `TokenService` доступен модулям, импортирующим `IdentityModule`.

- [ ] **Step 1: Создать `cookie.constants.ts`**

```ts
// Cookie configuration (общая для auth.controller и TMA-auth в telegram-import)
export const REFRESH_TOKEN_COOKIE = 'refresh_token';

const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true';

export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: COOKIE_SECURE,
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/api/auth',
};

// Demo accounts get shorter cookie lifetime
export const DEMO_COOKIE_OPTIONS = {
  ...COOKIE_OPTIONS,
  maxAge: 60 * 60 * 1000, // 1 hour
};
```

- [ ] **Step 2: Переключить `auth.controller.ts` на импорт**

Удалить строки 32-47 (блок «Cookie configuration» с тремя константами) и добавить импорт:

```ts
import {
  REFRESH_TOKEN_COOKIE,
  COOKIE_OPTIONS,
  DEMO_COOKIE_OPTIONS,
} from '../cookie.constants';
```

Остальной код контроллера не меняется (константы используются по тем же именам).

- [ ] **Step 3: Экспортировать TokenService**

В `identity.module.ts` заменить:

```ts
exports: [JwtModule, PassportModule, PROFILE_REPOSITORY],
```

на:

```ts
exports: [JwtModule, PassportModule, PROFILE_REPOSITORY, TokenService],
```

(`TokenService` уже в `providers` этого модуля — проверить и не дублировать.)

- [ ] **Step 4: Сборка**

`cd backend && bun run build` → без ошибок.

---

### Task 3: TmaAuthCommand — авторизация по initData (backend, TDD)

**Files:**
- Create: `backend/src/modules/telegram-import/application/commands/tma-auth/tma-auth.command.ts`
- Create: `backend/src/modules/telegram-import/application/commands/tma-auth/tma-auth.handler.ts`
- Create: `backend/src/modules/telegram-import/application/commands/tma-auth/tma-auth.handler.spec.ts`
- Delete: пустой каталог `backend/src/modules/telegram-import/application/commands/webapp-auth/` (остаток прерванной попытки)

**Interfaces:**
- Consumes: `validateTmaInitData` (Task 1), `TokenService.generateTokens/hashToken` + `AuthResponse` из `identity/application/services/token.service`, `PROFILE_REPOSITORY.findById`, `TELEGRAM_LINK_REPOSITORY.findByTelegramUserId`, `ConfigService` (`TELEGRAM_IMPORT_BOT_TOKEN`).
- Produces: `TmaAuthCommand(initData: string)`; `type TmaAuthResult = { linked: false } | { linked: true; auth: AuthResponse }`. Бросает `UnauthorizedException` (невалидный initData), `ServiceUnavailableException` (нет bot token).

- [ ] **Step 1: Command**

`tma-auth.command.ts`:

```ts
export class TmaAuthCommand {
  constructor(public readonly initData: string) {}
}
```

- [ ] **Step 2: Падающий тест**

`tma-auth.handler.spec.ts` (initData собирается тем же хелпером, что в Task 1 — продублировать локально, тесты читаются автономно):

```ts
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
    findByTelegramUserId: jest.fn().mockResolvedValue(
      overrides && 'link' in overrides ? overrides.link : { userId: 'user-1', telegramUserId: '42' },
    ),
  };
  const profileRepo = {
    findById: jest.fn().mockResolvedValue(
      overrides && 'profile' in overrides ? overrides.profile : PROFILE,
    ),
    save: jest.fn(),
  };
  const tokenService = {
    generateTokens: jest
      .fn()
      .mockResolvedValue({ accessToken: 'access', refreshToken: 'refresh' }),
    hashToken: jest.fn().mockReturnValue('hashed'),
  };
  const config = {
    get: jest.fn().mockReturnValue(
      overrides && 'botToken' in overrides ? overrides.botToken : BOT_TOKEN,
    ),
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
    await expect(
      handler.execute(new TmaAuthCommand(buildInitData(42))),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
```

- [ ] **Step 3: Убедиться, что падает**

test-runner: `cd backend && bun run test -- --testPathPattern=tma-auth` → FAIL (нет `tma-auth.handler`).

- [ ] **Step 4: Handler**

`tma-auth.handler.ts`:

```ts
import { Inject, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { TmaAuthCommand } from './tma-auth.command';
import { validateTmaInitData } from '../../../domain/tma/init-data.validator';
import {
  type ITelegramLinkRepository,
  TELEGRAM_LINK_REPOSITORY,
} from '../../../domain/repositories/telegram-link.repository.interface';
import {
  type IProfileRepository,
  PROFILE_REPOSITORY,
} from '../../../../identity/domain/repositories/profile.repository.interface';
import {
  type AuthResponse,
  TokenService,
} from '../../../../identity/application/services/token.service';

export type TmaAuthResult = { linked: false } | { linked: true; auth: AuthResponse };

@CommandHandler(TmaAuthCommand)
export class TmaAuthHandler implements ICommandHandler<TmaAuthCommand> {
  constructor(
    private readonly configService: ConfigService,
    @Inject(TELEGRAM_LINK_REPOSITORY) private readonly linkRepo: ITelegramLinkRepository,
    @Inject(PROFILE_REPOSITORY) private readonly profileRepo: IProfileRepository,
    private readonly tokenService: TokenService,
  ) {}

  async execute(command: TmaAuthCommand): Promise<TmaAuthResult> {
    const botToken = this.configService.get<string>('TELEGRAM_IMPORT_BOT_TOKEN');
    if (!botToken) throw new ServiceUnavailableException('Telegram import disabled');

    const initData = validateTmaInitData(command.initData, botToken);
    if (!initData) throw new UnauthorizedException('Invalid initData');

    const link = await this.linkRepo.findByTelegramUserId(initData.telegramUserId);
    if (!link) return { linked: false };

    const profile = await this.profileRepo.findById(link.userId);
    if (!profile) return { linked: false };

    // Зеркало LoginHandler: те же payload, refresh-bookkeeping и форма ответа
    const tokens = await this.tokenService.generateTokens({
      sub: profile.id,
      email: profile.emailValue || undefined,
      isAnonymous: false,
      isDemo: profile.isDemo,
    });
    profile.setRefreshToken(this.tokenService.hashToken(tokens.refreshToken));
    await this.profileRepo.save(profile);

    return {
      linked: true,
      auth: {
        user: {
          id: profile.id,
          email: profile.emailValue,
          name: profile.name,
          isAnonymous: false,
          isDemo: profile.isDemo,
        },
        tokens,
      },
    };
  }
}
```

Перед реализацией свериться с реальными полями: `AuthResponse.user` в `token.service.ts` и использование `profile.emailValue`/`profile.name` в `login.handler.ts:45-54` — форма user-объекта должна совпадать 1-в-1 с login.

- [ ] **Step 5: Тесты зелёные + удалить пустой каталог**

test-runner: `cd backend && bun run test -- --testPathPattern=tma-auth` → PASS.
`rmdir backend/src/modules/telegram-import/application/commands/webapp-auth`

---

### Task 4: LinkTelegramViaTmaCommand — привязка из TMA (backend, TDD)

**Files:**
- Create: `backend/src/modules/telegram-import/application/commands/link-telegram-via-tma/link-telegram-via-tma.command.ts`
- Create: `backend/src/modules/telegram-import/application/commands/link-telegram-via-tma/link-telegram-via-tma.handler.ts`
- Create: `backend/src/modules/telegram-import/application/commands/link-telegram-via-tma/link-telegram-via-tma.handler.spec.ts`

**Interfaces:**
- Consumes: `validateTmaInitData` (Task 1), `TELEGRAM_LINK_REPOSITORY` (`findByTelegramUserId`, `deleteByUserId`, `save`), `ConfigService`.
- Produces: `LinkTelegramViaTmaCommand(userId: string, initData: string)`; `type TmaLinkResult = 'linked' | 'already_linked_other'`. Бросает `UnauthorizedException`/`ServiceUnavailableException` как Task 3.

- [ ] **Step 1: Command**

```ts
export class LinkTelegramViaTmaCommand {
  constructor(
    public readonly userId: string,
    public readonly initData: string,
  ) {}
}
```

- [ ] **Step 2: Падающий тест**

`link-telegram-via-tma.handler.spec.ts` (хелпер `buildInitData` — тот же, что в Task 3, скопировать):

```ts
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
    const result = await handler.execute(new LinkTelegramViaTmaCommand('user-1', buildInitData(42)));
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
    const result = await handler.execute(new LinkTelegramViaTmaCommand('user-1', buildInitData(42)));
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
```

- [ ] **Step 3: Убедиться, что падает**

test-runner: `cd backend && bun run test -- --testPathPattern=link-telegram-via-tma` → FAIL.

- [ ] **Step 4: Handler**

```ts
import { Inject, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { LinkTelegramViaTmaCommand } from './link-telegram-via-tma.command';
import { validateTmaInitData } from '../../../domain/tma/init-data.validator';
import {
  type ITelegramLinkRepository,
  TELEGRAM_LINK_REPOSITORY,
} from '../../../domain/repositories/telegram-link.repository.interface';

export type TmaLinkResult = 'linked' | 'already_linked_other';

@CommandHandler(LinkTelegramViaTmaCommand)
export class LinkTelegramViaTmaHandler implements ICommandHandler<LinkTelegramViaTmaCommand> {
  constructor(
    private readonly configService: ConfigService,
    @Inject(TELEGRAM_LINK_REPOSITORY) private readonly linkRepo: ITelegramLinkRepository,
  ) {}

  async execute(command: LinkTelegramViaTmaCommand): Promise<TmaLinkResult> {
    const botToken = this.configService.get<string>('TELEGRAM_IMPORT_BOT_TOKEN');
    if (!botToken) throw new ServiceUnavailableException('Telegram import disabled');

    const initData = validateTmaInitData(command.initData, botToken);
    if (!initData) throw new UnauthorizedException('Invalid initData');

    const existingByTg = await this.linkRepo.findByTelegramUserId(initData.telegramUserId);
    if (existingByTg && existingByTg.userId !== command.userId) return 'already_linked_other';

    // перелинковка своего Telegram: старая связь userId уходит (может совпадать с existingByTg)
    await this.linkRepo.deleteByUserId(command.userId);
    await this.linkRepo.save({
      userId: command.userId,
      telegramUserId: initData.telegramUserId,
      telegramUsername: initData.telegramUsername,
    });
    return 'linked';
  }
}
```

Перед реализацией свериться с сигнатурой `ITelegramLinkRepository.save` (`telegram-link.repository.interface.ts`) — форма объекта как в `link-telegram-account.handler.ts:33-37`.

- [ ] **Step 5: Тесты зелёные**

test-runner: `cd backend && bun run test -- --testPathPattern=link-telegram-via-tma` → PASS.

---

### Task 5: TMA-контроллер, DTO и wiring модулей (backend)

**Files:**
- Create: `backend/src/modules/telegram-import/presentation/dto/tma-auth.dto.ts`
- Create: `backend/src/modules/telegram-import/presentation/controllers/tma.controller.ts`
- Modify: `backend/src/modules/telegram-import/application/commands/index.ts` (экспорт + регистрация двух новых хендлеров)
- Modify: `backend/src/modules/telegram-import/telegram-import.module.ts` (imports: `IdentityModule`; controllers: `TmaController`)

**Interfaces:**
- Consumes: `TmaAuthCommand`/`TmaAuthResult` (Task 3), `LinkTelegramViaTmaCommand`/`TmaLinkResult` (Task 4), cookie-константы (Task 2), `Public`/`CurrentUser` из `backend/src/common`.
- Produces: `POST /api/telegram-import/tma-auth` (`{ initData }` → `{ linked:false }` | `{ linked:true, accessToken, user }` + refresh-cookie); `POST /api/telegram-import/tma-link` (JWT; `{ initData }` → `{ success:true }`, 409 при `already_linked_other`).

- [ ] **Step 1: DTO**

`tma-auth.dto.ts` (стиль по образцу `presentation/dto/confirm-imported.dto.ts` — class-validator):

```ts
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class TmaAuthDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  initData!: string;
}
```

- [ ] **Step 2: Контроллер**

`tma.controller.ts`:

```ts
import { Body, Controller, HttpCode, HttpStatus, Post, Res, ConflictException } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public, CurrentUser } from '../../../../common';
import { TmaAuthDto } from '../dto/tma-auth.dto';
import { TmaAuthCommand } from '../../application/commands/tma-auth/tma-auth.command';
import type { TmaAuthResult } from '../../application/commands/tma-auth/tma-auth.handler';
import { LinkTelegramViaTmaCommand } from '../../application/commands/link-telegram-via-tma/link-telegram-via-tma.command';
import type { TmaLinkResult } from '../../application/commands/link-telegram-via-tma/link-telegram-via-tma.handler';
import {
  REFRESH_TOKEN_COOKIE,
  COOKIE_OPTIONS,
  DEMO_COOKIE_OPTIONS,
} from '../../../identity/presentation/cookie.constants';

@Controller('telegram-import')
export class TmaController {
  constructor(private readonly commandBus: CommandBus) {}

  /** Авторизация Mini App по initData: выдаёт штатную сессию (access + refresh-cookie) */
  @Public()
  @Post('tma-auth')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async tmaAuth(@Body() dto: TmaAuthDto, @Res({ passthrough: true }) response: Response) {
    const result: TmaAuthResult = await this.commandBus.execute(new TmaAuthCommand(dto.initData));
    if (!result.linked) return { linked: false };

    const cookieOpts = result.auth.user.isDemo ? DEMO_COOKIE_OPTIONS : COOKIE_OPTIONS;
    response.cookie(REFRESH_TOKEN_COOKIE, result.auth.tokens.refreshToken, cookieOpts);
    return {
      linked: true,
      accessToken: result.auth.tokens.accessToken,
      user: result.auth.user,
    };
  }

  /** Привязка Telegram к текущему аккаунту из Mini App (initData доказывает tg-идентичность) */
  @Post('tma-link')
  @HttpCode(HttpStatus.OK)
  async tmaLink(@CurrentUser('sub') userId: string, @Body() dto: TmaAuthDto) {
    const result: TmaLinkResult = await this.commandBus.execute(
      new LinkTelegramViaTmaCommand(userId, dto.initData),
    );
    if (result === 'already_linked_other') {
      throw new ConflictException('telegram_already_linked_other');
    }
    return { success: true };
  }
}
```

Проверить фактический путь импорта `Public`/`CurrentUser` по соседнему `telegram-import.controller.ts` (в auth.controller это `../../../../common`, но глубина у telegram-import другая — свериться).

- [ ] **Step 3: Регистрация хендлеров и модулей**

`application/commands/index.ts` — по образцу существующих: экспортировать `TmaAuthHandler`, `LinkTelegramViaTmaHandler` (+ команды) и добавить оба в массив `CommandHandlers`.

`telegram-import.module.ts`:
- imports: добавить `IdentityModule` (импорт из `../identity/identity.module`);
- controllers: добавить `TmaController`.

- [ ] **Step 4: Сборка + все тесты модуля**

`cd backend && bun run build` → OK. test-runner: `cd backend && bun run test -- --testPathPattern=telegram-import` → все PASS (старые и новые).

---

### Task 6: Кнопки бота и menu button (backend)

**Files:**
- Modify: `backend/src/modules/telegram-import/infrastructure/telegram/telegram-bot.service.ts`
- Modify: `backend/src/i18n/ru/telegram.json`, `backend/src/i18n/en/telegram.json`

**Interfaces:**
- Consumes: `PUBLIC_APP_URL` из ConfigService (env уже существует, используется receipt-модулем), `InlineKeyboard` из grammY.
- Produces: web_app-кнопки на ответах бота (сводка при `imported > 0`, `notLinked`, `/start` без токена) и menu button «Инбокс».

- [ ] **Step 1: i18n-ключи**

В `ru/telegram.json` добавить секцию:

```json
"buttons": {
  "confirm": "✅ Подтвердить операции",
  "linkAccount": "🔗 Привязать аккаунт",
  "openInbox": "📥 Открыть инбокс"
}
```

В `en/telegram.json`:

```json
"buttons": {
  "confirm": "✅ Confirm transactions",
  "linkAccount": "🔗 Link account",
  "openInbox": "📥 Open inbox"
}
```

- [ ] **Step 2: Хелперы URL и клавиатуры в TelegramBotService**

Импортировать `InlineKeyboard` из grammY (`import { Bot, InlineKeyboard } from 'grammy';`) и добавить приватные члены:

```ts
/** URL Mini App: PUBLIC_APP_URL + /tma; без PUBLIC_APP_URL кнопки не ставятся */
private get tmaUrl(): string | null {
  const base = this.configService.get<string>('PUBLIC_APP_URL');
  return base ? `${base.replace(/\/+$/, '')}/tma` : null;
}

private tmaKeyboard(labelKey: string, lang: string): { reply_markup: InlineKeyboard } | undefined {
  const url = this.tmaUrl;
  if (!url) return undefined;
  return {
    reply_markup: new InlineKeyboard().webApp(this.i18n.translate(labelKey, { lang }), url),
  };
}
```

- [ ] **Step 3: Прикрепить кнопки к ответам**

В `registerHandlers`:
- `/start` без токена (строка ~116): `await ctx.reply(this.i18n.translate('telegram.start.noToken', { lang }), this.tmaKeyboard('telegram.buttons.openInbox', lang));`
- ответ `not_linked` (строка ~138): `await ctx.reply(this.i18n.translate('telegram.notLinked', { lang }), this.tmaKeyboard('telegram.buttons.linkAccount', lang));`
- сводка в `aggregator.add` (строка ~143):

```ts
this.aggregator.add(ctx.chat.id, key, async (counts) => {
  const keyboard = counts.imported
    ? this.tmaKeyboard('telegram.buttons.confirm', lang)
    : undefined;
  await ctx.reply(this.summaryText(counts, lang), keyboard);
});
```

`ReplyAggregator` не меняется.

- [ ] **Step 4: Menu button при старте**

В `onApplicationBootstrap` после установки webhook добавить:

```ts
if (this.bot && this.tmaUrl) {
  try {
    await this.bot.api.setChatMenuButton({
      menu_button: { type: 'web_app', text: 'Инбокс', web_app: { url: this.tmaUrl } },
    });
    this.logger.log(`Telegram menu button установлен: ${this.tmaUrl}`);
  } catch (err) {
    this.logger.error('Не удалось установить Telegram menu button', err);
  }
}
```

(Глобальный menu button не знает языка конкретного пользователя, поэтому текст один — «Инбокс».)

- [ ] **Step 5: Сборка + линт**

`cd backend && bun run build && bun run lint` → OK. Свериться с API grammY при сомнении: context7 `/grammyjs/grammy` (метод `InlineKeyboard.webApp(text, url)` и `api.setChatMenuButton`).

---

### Task 7: Frontend — loadTelegramWebApp, applySession, API-функции

**Files:**
- Create: `frontend/src/shared/lib/telegram/loadTelegramWebApp.ts`
- Modify: `frontend/src/shared/api/composables/useAuth.ts` (добавить `applySession`, дедуп в signIn/signUp/signInAnonymously)
- Modify: `frontend/src/entities/imported-transaction/api/importedTransactionsApi.ts` (+2 функции)
- Modify: `frontend/src/entities/imported-transaction/model/types.ts` (+тип ответа)

**Interfaces:**
- Consumes: `http` клиент (`{ skipAuth: true }` для публичного вызова), тип `User` (тот же, что использует `AuthResponse` в `useAuth.ts` — посмотреть импорт там).
- Produces:
  - `loadTelegramWebApp(): Promise<TelegramWebApp | null>`; `interface TelegramWebApp { initData: string; colorScheme: 'light' | 'dark'; ready(): void; expand(): void; openLink(url: string): void }`
  - `useAuth().applySession(accessToken: string, sessionUser: User): void`
  - `importedTransactionsApi.tmaAuth(initData: string): Promise<TmaAuthResponse>`; `importedTransactionsApi.tmaLink(initData: string): Promise<{ success: boolean }>`
  - `type TmaAuthResponse = { linked: false } | { linked: true; accessToken: string; user: User }`

- [ ] **Step 1: loadTelegramWebApp**

`frontend/src/shared/lib/telegram/loadTelegramWebApp.ts`:

```ts
/**
 * Ленивая загрузка SDK Telegram Mini Apps.
 * Скрипт нужен только странице /tma, поэтому не подключён в index.html.
 */
const SCRIPT_SRC = 'https://telegram.org/js/telegram-web-app.js';

export interface TelegramWebApp {
  /** Сырая строка initData для серверной валидации; пустая вне Telegram */
  initData: string;
  colorScheme: 'light' | 'dark';
  ready(): void;
  expand(): void;
  openLink(url: string): void;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

let loadPromise: Promise<TelegramWebApp | null> | null = null;

export function loadTelegramWebApp(): Promise<TelegramWebApp | null> {
  if (window.Telegram?.WebApp) return Promise.resolve(window.Telegram.WebApp);
  loadPromise ??= new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve(window.Telegram?.WebApp ?? null);
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
  return loadPromise;
}
```

- [ ] **Step 2: applySession в useAuth**

В `useAuth()` (`useAuth.ts`, рядом с `signIn`) добавить и вернуть из composable:

```ts
/** Программная установка сессии (используется TMA-входом): токен + user как после login */
function applySession(accessToken: string, sessionUser: User) {
  setTokens(accessToken);
  user.value = sessionUser;
}
```

В `signUp` (строки ~209-210), `signIn` (~236-237), `signInAnonymously` (~293-294) заменить пары `setTokens(data.accessToken); user.value = data.user;` на `applySession(data.accessToken, data.user);`. Тип `User` — тот же, каким типизирован `data.user` (см. импорт `AuthResponse` в начале файла).

- [ ] **Step 3: API-функции entity**

В `model/types.ts` добавить (импортировав тип `User` из того же места, что использует `useAuth`; если User живёт в `shared/api`, импорт корректен по FSD — entities могут зависеть от shared):

```ts
export type TmaAuthResponse =
  | { linked: false }
  | { linked: true; accessToken: string; user: User };
```

В `importedTransactionsApi.ts` добавить по образцу существующих функций:

```ts
async tmaAuth(initData: string): Promise<TmaAuthResponse> {
  return http.post<TmaAuthResponse>('/telegram-import/tma-auth', { initData }, { skipAuth: true });
},

async tmaLink(initData: string): Promise<{ success: boolean }> {
  return http.post<{ success: boolean }>('/telegram-import/tma-link', { initData });
},
```

(Сверить фактическую форму объекта `importedTransactionsApi` — если это плоские экспортируемые функции, добавить в том же стиле. Ответ tma-auth не трансформируется в snake_case: это auth-ответ, идентичный `/auth/login`.)

- [ ] **Step 4: Проверка типов**

`cd frontend && bun run build` → без ошибок типов.

---

### Task 8: Frontend — feature tma-auth, страница /tma, роут

**Files:**
- Create: `frontend/src/features/tma-auth/model/useTmaEntry.ts`
- Create: `frontend/src/features/tma-auth/ui/TmaLoginForm.vue`
- Create: `frontend/src/features/tma-auth/locales/ru.json`, `frontend/src/features/tma-auth/locales/en.json`
- Create: `frontend/src/features/tma-auth/index.ts`
- Create: `frontend/src/pages/tma/TmaEntryPage.vue`
- Modify: `frontend/src/shared/config/routeNames.ts` (+`TMA_ENTRY`)
- Modify: `frontend/src/app/router/index.ts` (+роут `/tma` рядом с `/shared/:token`)

**Interfaces:**
- Consumes: Task 7 полностью; `waitForAuth`, `useAuth().signIn/applySession/isAuthenticated/user`; `useTheme().setTheme`; `ROUTE_NAMES.IMPORT_INBOX`; i18n `useI18n()` (ключи `features.tmaAuth.*`).
- Produces: роут `/tma` (`ROUTE_NAMES.TMA_ENTRY = 'tma-entry'`), состояние-машина `useTmaEntry`.

- [ ] **Step 1: Локали**

`locales/ru.json`:

```json
{
  "loading": "Подключаемся к Telegram…",
  "notTelegram": {
    "title": "Откройте через Telegram",
    "description": "Эта страница работает только внутри Telegram. Откройте бота и нажмите кнопку меню.",
    "openSite": "Открыть сайт"
  },
  "confirmLink": {
    "title": "Привязать Telegram",
    "description": "Привязать этот Telegram к аккаунту {email}? Форварды банковских уведомлений будут попадать в него.",
    "confirm": "Привязать",
    "logout": "Войти в другой аккаунт"
  },
  "login": {
    "title": "Вход",
    "description": "Войдите, чтобы привязать Telegram и подтверждать операции здесь.",
    "email": "Email",
    "password": "Пароль",
    "submit": "Войти и привязать",
    "noAccount": "Нет аккаунта? Зарегистрируйтесь на сайте",
    "error": "Не удалось войти. Проверьте email и пароль."
  },
  "errors": {
    "generic": "Что-то пошло не так. Попробуйте ещё раз.",
    "staleInitData": "Сессия Telegram устарела. Закройте и откройте мини-приложение заново.",
    "alreadyLinkedOther": "Этот Telegram уже привязан к другому аккаунту. Сначала отвяжите его там.",
    "retry": "Повторить"
  }
}
```

`locales/en.json`:

```json
{
  "loading": "Connecting to Telegram…",
  "notTelegram": {
    "title": "Open via Telegram",
    "description": "This page only works inside Telegram. Open the bot and tap the menu button.",
    "openSite": "Open the website"
  },
  "confirmLink": {
    "title": "Link Telegram",
    "description": "Link this Telegram to the {email} account? Forwarded bank notifications will land in it.",
    "confirm": "Link",
    "logout": "Sign in to another account"
  },
  "login": {
    "title": "Sign in",
    "description": "Sign in to link Telegram and confirm transactions here.",
    "email": "Email",
    "password": "Password",
    "submit": "Sign in and link",
    "noAccount": "No account? Register on the website",
    "error": "Could not sign in. Check your email and password."
  },
  "errors": {
    "generic": "Something went wrong. Please try again.",
    "staleInitData": "The Telegram session has expired. Close and reopen the mini app.",
    "alreadyLinkedOther": "This Telegram is already linked to another account. Unlink it there first.",
    "retry": "Retry"
  }
}
```

(Внимание: в en.json выше после `"error"` не должно быть висячей запятой — убрать при создании файла.)

- [ ] **Step 2: Композабл useTmaEntry**

`model/useTmaEntry.ts`:

```ts
import { onMounted, ref, shallowRef } from 'vue';
import { useRouter } from 'vue-router';
import { loadTelegramWebApp, type TelegramWebApp } from '@/shared/lib/telegram/loadTelegramWebApp';
import { useAuth, waitForAuth } from '@/shared/api/composables/useAuth';
import { useTheme } from '@/features/toggle-theme';
import { importedTransactionsApi } from '@/entities/imported-transaction';
import { ROUTE_NAMES } from '@/shared/config/routeNames';

export type TmaEntryState =
  | 'loading'
  | 'not-telegram'
  | 'confirm-link'
  | 'login'
  | 'error';

/** Состояние-машина входа через Telegram Mini App (страница /tma) */
export function useTmaEntry() {
  const router = useRouter();
  const { signIn, applySession, user } = useAuth();
  const { setTheme } = useTheme();

  const state = ref<TmaEntryState>('loading');
  const errorKey = ref<string | null>(null); // ключ i18n внутри features.tmaAuth
  const webApp = shallowRef<TelegramWebApp | null>(null);

  function goInbox() {
    void router.replace({ name: ROUTE_NAMES.IMPORT_INBOX });
  }

  async function linkAndGo() {
    if (!webApp.value) return;
    try {
      await importedTransactionsApi.tmaLink(webApp.value.initData);
      goInbox();
    } catch (err) {
      const status = (err as { status?: number }).status;
      errorKey.value = status === 409 ? 'errors.alreadyLinkedOther' : 'errors.generic';
      state.value = 'error';
    }
  }

  async function submitLogin(email: string, password: string) {
    // Ошибку логина ловит форма (показывает login.error), сюда долетает только успех
    await signIn(email, password);
    await linkAndGo();
  }

  async function start() {
    state.value = 'loading';
    errorKey.value = null;

    const wa = webApp.value ?? (await loadTelegramWebApp());
    webApp.value = wa;
    if (!wa || !wa.initData) {
      state.value = 'not-telegram';
      return;
    }
    wa.ready();
    wa.expand();
    setTheme(wa.colorScheme);

    try {
      const res = await importedTransactionsApi.tmaAuth(wa.initData);
      if (res.linked) {
        applySession(res.accessToken, res.user);
        goInbox();
        return;
      }
      // Не привязан: если в webview уже есть сессия — предлагаем привязать её
      const existing = await waitForAuth();
      state.value = existing ? 'confirm-link' : 'login';
    } catch (err) {
      const status = (err as { status?: number }).status;
      errorKey.value = status === 401 ? 'errors.staleInitData' : 'errors.generic';
      state.value = 'error';
    }
  }

  onMounted(() => void start());

  return { state, errorKey, user, start, linkAndGo, submitLogin, webApp };
}
```

Сверить, как http-клиент прокидывает статус ошибки (поле `status` на Error? — посмотреть класс ошибки в `shared/api/http.ts` и использовать фактическое поле).

- [ ] **Step 3: Форма логина**

`ui/TmaLoginForm.vue` (использовать `UInput`, `UButton` из `@/shared/ui`; текст — `useI18n` с ключами `features.tmaAuth.login.*`):

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { UButton, UInput } from '@/shared/ui';

const props = defineProps<{ submit: (email: string, password: string) => Promise<void> }>();

const { t } = useI18n();
const email = ref('');
const password = ref('');
const pending = ref(false);
const failed = ref(false);

async function onSubmit() {
  if (!email.value || !password.value || pending.value) return;
  pending.value = true;
  failed.value = false;
  try {
    await props.submit(email.value, password.value);
  } catch {
    failed.value = true;
  } finally {
    pending.value = false;
  }
}
</script>

<template>
  <form class="flex flex-col gap-3" @submit.prevent="onSubmit">
    <UInput
      v-model="email"
      type="email"
      autocomplete="email"
      :placeholder="t('features.tmaAuth.login.email')"
    />
    <UInput
      v-model="password"
      type="password"
      autocomplete="current-password"
      :placeholder="t('features.tmaAuth.login.password')"
    />
    <p v-if="failed" class="text-sm text-danger">{{ t('features.tmaAuth.login.error') }}</p>
    <UButton type="submit" :loading="pending" class="w-full">
      {{ t('features.tmaAuth.login.submit') }}
    </UButton>
  </form>
</template>
```

Сверить фактические пропсы `UInput`/`UButton` (variants, `loading`) по исходникам `shared/ui` и цветовой токен ошибки (`text-danger` — проверить точное имя в `DESIGN_SYSTEM.md` / соседних формах, например LoginPage).

- [ ] **Step 4: Публичный API фичи**

`features/tma-auth/index.ts`:

```ts
export { useTmaEntry, type TmaEntryState } from './model/useTmaEntry';
export { default as TmaLoginForm } from './ui/TmaLoginForm.vue';
```

- [ ] **Step 5: Страница**

`pages/tma/TmaEntryPage.vue`:

```vue
<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useTmaEntry, TmaLoginForm } from '@/features/tma-auth';
import { UButton, USpinner } from '@/shared/ui';

const { t } = useI18n();
const { state, errorKey, user, start, linkAndGo, submitLogin, webApp } = useTmaEntry();

function openSite() {
  webApp.value?.openLink(window.location.origin);
}
</script>

<template>
  <div
    class="min-h-screen bg-background-light dark:bg-background-dark flex flex-col items-center justify-center gap-4 p-6 text-center"
  >
    <template v-if="state === 'loading'">
      <USpinner />
      <p class="text-content-secondary">{{ t('features.tmaAuth.loading') }}</p>
    </template>

    <template v-else-if="state === 'not-telegram'">
      <h1 class="text-xl font-bold">{{ t('features.tmaAuth.notTelegram.title') }}</h1>
      <p class="text-content-secondary">{{ t('features.tmaAuth.notTelegram.description') }}</p>
      <UButton variant="secondary" @click="openSite">
        {{ t('features.tmaAuth.notTelegram.openSite') }}
      </UButton>
    </template>

    <template v-else-if="state === 'confirm-link'">
      <h1 class="text-xl font-bold">{{ t('features.tmaAuth.confirmLink.title') }}</h1>
      <p class="text-content-secondary">
        {{ t('features.tmaAuth.confirmLink.description', { email: user?.email ?? '' }) }}
      </p>
      <UButton class="w-full" @click="linkAndGo">
        {{ t('features.tmaAuth.confirmLink.confirm') }}
      </UButton>
    </template>

    <template v-else-if="state === 'login'">
      <h1 class="text-xl font-bold">{{ t('features.tmaAuth.login.title') }}</h1>
      <p class="text-content-secondary">{{ t('features.tmaAuth.login.description') }}</p>
      <TmaLoginForm class="w-full max-w-sm" :submit="submitLogin" />
    </template>

    <template v-else>
      <h1 class="text-xl font-bold">😕</h1>
      <p class="text-content-secondary">
        {{ t(`features.tmaAuth.${errorKey ?? 'errors.generic'}`) }}
      </p>
      <UButton variant="secondary" @click="start">
        {{ t('features.tmaAuth.errors.retry') }}
      </UButton>
    </template>
  </div>
</template>
```

Семантические токены текста (`text-content-secondary`) сверить с фактическими из `DESIGN_SYSTEM.md` (могут называться иначе, напр. `text-secondary-*` — использовать те, что применяются в соседних страницах, например `SharedReceiptPage.vue`).

- [ ] **Step 6: Роут**

`routeNames.ts`: добавить `TMA_ENTRY: 'tma-entry',` в `ROUTE_NAMES`.

`router/index.ts`, рядом с `/shared/:token` (перед catch-all):

```ts
// Вход из Telegram Mini App — публичный, авторизуется сам по initData
{
  path: '/tma',
  name: ROUTE_NAMES.TMA_ENTRY,
  component: () => import('@/pages/tma/TmaEntryPage.vue'),
},
```

- [ ] **Step 7: Сборка**

`cd frontend && bun run build` → OK (vue-tsc + vite).

---

### Task 9: Финализация — changelog, nginx-проверка, полный прогон

**Files:**
- Modify: `frontend/src/features/changelog/model/changelogData.ts`
- Inspect (modify если нужно): `docker/frontend/nginx.conf`
- Modify: `docs/features/telegram-bank-import.md` (короткая секция про TMA)

- [ ] **Step 1: Changelog**

В `CHANGELOG_ENTRIES` добавить запись **в начало** массива с patch-бампом версии (посмотреть текущую верхнюю версию, например `1.0.X` → `1.0.X+1`), тип `feature`, описание на русском:

```ts
{
  version: '<текущая+patch>',
  date: '2026-07-17',
  type: 'feature',
  title: 'Подтверждение импорта прямо в Telegram',
  description:
    'Теперь операции из банковских уведомлений можно подтверждать, не выходя из Telegram: бот присылает кнопку, открывающую мини-приложение с инбоксом. Привязка аккаунта — простым входом внутри мини-приложения.',
},
```

(Форму объекта записи сверить с существующими элементами массива и повторить её точно.)

- [ ] **Step 2: Проверка nginx на iframe-заголовки**

Прочитать `docker/frontend/nginx.conf`. Если присутствует `add_header X-Frame-Options` (`DENY`/`SAMEORIGIN`) или CSP c `frame-ancestors` без `web.telegram.org` — Telegram Web не сможет открыть Mini App (iframe). В этом случае: для `location /` убрать `X-Frame-Options` (или ограничить его исключением для `/tma`). Если заголовков нет — ничего не делать, зафиксировать факт в итоговом отчёте.

- [ ] **Step 3: Обновить доку фичи**

В `docs/features/telegram-bank-import.md` добавить подсекцию в §2 (после «Привязка аккаунта») кратко: TMA-вход (`/tma` → `tma-auth` → JWT → инбокс; `tma-link` для привязки), новые эндпоинты в таблицу §3.1, кнопки бота в §3.2, файлы в карту §10.

- [ ] **Step 4: Полный прогон**

- test-runner: `cd backend && bun run test` → все PASS.
- `cd backend && bun run build && bun run lint` → OK.
- `cd frontend && bun run build` → OK.

- [ ] **Step 5: Ручной смоук (локально, вне Telegram)**

`bun run dev` (корень), открыть `http://localhost:5173/tma` в браузере: должен показаться экран «Откройте через Telegram» (initData пуст) без ошибок в консоли. Это подтверждает, что роут публичный и скрипт SDK грузится.

---

## Manual post-deploy checklist (для пользователя, не для агента)

1. Задеплоить master (CI сам всё соберёт; env-изменений нет).
2. В чате с `@ouro_parser_robot`: `/start` → появилась кнопка «📥 Открыть инбокс», рядом с полем ввода — menu button «Инбокс».
3. Форвардни уведомление HUMO → сводка с кнопкой «✅ Подтвердить операции» → тап → Mini App открывает инбокс без логина (если Telegram привязан).
4. Проверка непривязанного аккаунта: `DELETE /api/telegram-import/link` (или «Отвязать» в профиле) → кнопка из бота → форма входа в TMA → вход → привязка → инбокс.
5. Telegram Web (web.telegram.org): Mini App открывается в iframe — проверить, что не блокируется заголовками.
