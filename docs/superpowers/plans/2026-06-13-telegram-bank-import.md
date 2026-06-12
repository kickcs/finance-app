# Telegram Bank Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Пользователи форвардят банковские Telegram-уведомления (HUMO/UZS) общему боту приложения; сообщения парсятся в инбокс «На подтверждение», где через полноэкранный флоу превращаются в транзакции (со счётом, категорией, долгом, сплитом, чеком, переводом).

**Architecture:** Новый bounded context `backend/src/modules/telegram-import` (DDD-структура проекта, CQRS). Бот grammY в webhook-режиме внутри NestJS (`@Public()` endpoint + secret-token, по образцу LemonSqueezy). Оркестрация подтверждения — на фронтенде: страница подтверждения переиспользует `useTransactionForm`/`TransactionForm`/`useSubmitTransaction`/`useSplitExpense`, после создания транзакции вызывает `confirm` с `transactionId`.

**Tech Stack:** NestJS 11 + TypeORM + @nestjs/cqrs + grammY (новая зависимость) | Vue 3 + TanStack Query + FSD. Spec: `docs/superpowers/specs/2026-06-12-telegram-bank-import-design.md`.

**Правила выполнения:**
- Все сабагенты — **только Opus**.
- UI-задачи (Task 11–13) выполняются с использованием skill **frontend-design**; строго семантические токены дизайн-системы (`frontend/DESIGN_SYSTEM.md`).
- Запуск тестов — через сабагента test-runner (вывод не в основной контекст).
- Backend-команды из `backend/`, frontend — из `frontend/`. Менеджер пакетов — bun.

---

## Контракты (общие для всех задач)

**Типы сообщений:** `'expense' | 'income' | 'balance_change' | 'unparsed'`.
**Статусы импорта:** `'pending' | 'confirmed' | 'dismissed'`.

**ParsedBankMessage (выход парсера):**
```ts
interface ParsedBankMessage {
  type: 'expense' | 'income' | 'balance_change';
  amount: number | null;        // null для balance_change (вычисляется дельтой на ingest)
  currency: string;             // 'UZS'
  merchant: string | null;
  cardMask: string;             // '*1951' (нормализовано)
  occurredAt: Date;             // Asia/Tashkent (+05:00)
  balanceAfter: number | null;  // 💰 для оплаты/пополнения; 💸 для balance_change
}
```

**REST API (все JWT, кроме webhook):**

| Метод | Путь | Тело / Ответ |
|---|---|---|
| POST | `/api/telegram-import/webhook` | `@Public()`, header `x-telegram-bot-api-secret-token` |
| POST | `/api/telegram-import/link-token` | → `{ deepLink: string }` |
| GET | `/api/telegram-import/link` | → `{ linked: boolean, telegramUsername: string \| null }` |
| DELETE | `/api/telegram-import/link` | → `{ success: true }` |
| GET | `/api/telegram-import/inbox` | → `{ items: ImportedTransactionResponse[], count: number }` |
| POST | `/api/telegram-import/inbox/:id/confirm` | `{ transactionId, accountId, toAccountId? }` → `{ success, counterpartId? }` |
| POST | `/api/telegram-import/inbox/:id/dismiss` | → `{ success: true }` |
| GET | `/api/telegram-import/cards` | → `{ cards: [{ cardMask, accountId, lastSeenAt }] }` |
| PUT | `/api/telegram-import/cards/:cardMask` | `{ accountId }` → `{ success: true }` (cardMask URL-encoded) |
| DELETE | `/api/telegram-import/cards/:cardMask` | → `{ success: true }` |

**ImportedTransactionResponse (camelCase, backend → frontend):**
```ts
{
  id: string; type: 'expense' | 'income' | 'balance_change';
  amount: number | null;          // для balance_change — подписанная дельта или null
  currency: string; merchant: string | null; cardMask: string;
  occurredAt: string;             // ISO
  balanceAfter: number | null; status: 'pending' | 'confirmed' | 'dismissed';
  transactionId: string | null; suggestedAccountId: string | null; createdAt: string;
}
```

**ENV (backend):** `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME` (без @), `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_WEBHOOK_URL` (полный URL до `/api/telegram-import/webhook`). Все опциональны: без токена модуль работает в «выключенном» режиме (webhook отвечает 503, бот не инициализируется) — dev без Telegram не ломается.

---

### Task 1: ORM-сущности, регистрация, миграция

**Files:**
- Create: `backend/src/modules/telegram-import/infrastructure/persistence/typeorm/telegram-link.orm-entity.ts`
- Create: `backend/src/modules/telegram-import/infrastructure/persistence/typeorm/telegram-link-token.orm-entity.ts`
- Create: `backend/src/modules/telegram-import/infrastructure/persistence/typeorm/imported-transaction.orm-entity.ts`
- Create: `backend/src/modules/telegram-import/infrastructure/persistence/typeorm/card-account-mapping.orm-entity.ts`
- Create: `backend/src/modules/telegram-import/infrastructure/persistence/typeorm/index.ts`
- Create: `backend/src/database/migrations/1781308800000-CreateTelegramImport.ts`
- Modify: `backend/src/config/data-source.ts` (entities array + import)
- Modify: `backend/src/app.module.ts` (entities array + import)

- [ ] **Step 1: Создать ORM-сущности**

`telegram-link.orm-entity.ts`:
```ts
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('telegram_links')
export class TelegramLinkOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid', unique: true })
  userId: string;

  @Column({ name: 'telegram_user_id', type: 'bigint', unique: true })
  telegramUserId: string; // bigint приходит строкой из pg-драйвера

  @Column({ name: 'telegram_username', type: 'varchar', nullable: true })
  telegramUsername: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
```

`telegram-link-token.orm-entity.ts`:
```ts
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('telegram_link_tokens')
export class TelegramLinkTokenOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', unique: true })
  token: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  usedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
```

`imported-transaction.orm-entity.ts`:
```ts
import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('imported_transactions')
@Index(['userId', 'dedupHash'], { unique: true })
@Index(['userId', 'status'])
export class ImportedTransactionOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'raw_text', type: 'text' })
  rawText: string;

  @Column({ type: 'varchar' })
  type: 'expense' | 'income' | 'balance_change' | 'unparsed';

  @Column({ type: 'decimal', precision: 18, scale: 2, nullable: true })
  amount: string | null; // decimal приходит строкой

  @Column({ type: 'varchar', default: 'UZS' })
  currency: string;

  @Column({ type: 'varchar', nullable: true })
  merchant: string | null;

  @Column({ name: 'card_mask', type: 'varchar', nullable: true })
  cardMask: string | null; // null для unparsed

  @Column({ name: 'occurred_at', type: 'timestamptz', nullable: true })
  occurredAt: Date | null; // null для unparsed

  @Column({ name: 'balance_after', type: 'decimal', precision: 18, scale: 2, nullable: true })
  balanceAfter: string | null;

  @Column({ name: 'dedup_hash', type: 'varchar' })
  dedupHash: string;

  @Column({ type: 'varchar', default: 'pending' })
  status: 'pending' | 'confirmed' | 'dismissed';

  @Column({ name: 'transaction_id', type: 'uuid', nullable: true })
  transactionId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
```

`card-account-mapping.orm-entity.ts`:
```ts
import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('card_account_mappings')
@Index(['userId', 'cardMask'], { unique: true })
export class CardAccountMappingOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'card_mask', type: 'varchar' })
  cardMask: string;

  @Column({ name: 'account_id', type: 'uuid' })
  accountId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

`index.ts` (barrel):
```ts
export * from './telegram-link.orm-entity';
export * from './telegram-link-token.orm-entity';
export * from './imported-transaction.orm-entity';
export * from './card-account-mapping.orm-entity';
```

- [ ] **Step 2: Зарегистрировать сущности в ДВУХ местах**

В `backend/src/config/data-source.ts`: добавить import из barrel и все 4 класса в массив `entities`. В `backend/src/app.module.ts`: добавить те же импорты и классы в `entities` внутри `TypeOrmModule.forRootAsync` useFactory. (Известная gotcha проекта: оба места обязательны.)

- [ ] **Step 3: Написать миграцию вручную**

`backend/src/database/migrations/1781308800000-CreateTelegramImport.ts`:
```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTelegramImport1781308800000 implements MigrationInterface {
  name = 'CreateTelegramImport1781308800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "telegram_links" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "user_id" uuid NOT NULL,
      "telegram_user_id" bigint NOT NULL,
      "telegram_username" character varying,
      "created_at" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_telegram_links" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_telegram_links_user" UNIQUE ("user_id"),
      CONSTRAINT "UQ_telegram_links_tg_user" UNIQUE ("telegram_user_id"))`);
    await queryRunner.query(`ALTER TABLE "telegram_links" ADD CONSTRAINT "FK_telegram_links_profiles"
      FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE`);

    await queryRunner.query(`CREATE TABLE "telegram_link_tokens" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "user_id" uuid NOT NULL,
      "token" character varying NOT NULL,
      "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
      "used_at" TIMESTAMP WITH TIME ZONE,
      "created_at" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_telegram_link_tokens" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_telegram_link_tokens_token" UNIQUE ("token"))`);
    await queryRunner.query(`ALTER TABLE "telegram_link_tokens" ADD CONSTRAINT "FK_telegram_link_tokens_profiles"
      FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE`);

    await queryRunner.query(`CREATE TABLE "imported_transactions" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "user_id" uuid NOT NULL,
      "raw_text" text NOT NULL,
      "type" character varying NOT NULL,
      "amount" numeric(18,2),
      "currency" character varying NOT NULL DEFAULT 'UZS',
      "merchant" character varying,
      "card_mask" character varying,
      "occurred_at" TIMESTAMP WITH TIME ZONE,
      "balance_after" numeric(18,2),
      "dedup_hash" character varying NOT NULL,
      "status" character varying NOT NULL DEFAULT 'pending',
      "transaction_id" uuid,
      "created_at" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_imported_transactions" PRIMARY KEY ("id"))`);
    await queryRunner.query(`ALTER TABLE "imported_transactions" ADD CONSTRAINT "FK_imported_transactions_profiles"
      FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_imported_transactions_user_dedup"
      ON "imported_transactions" ("user_id", "dedup_hash")`);
    await queryRunner.query(`CREATE INDEX "IDX_imported_transactions_user_status"
      ON "imported_transactions" ("user_id", "status")`);

    await queryRunner.query(`CREATE TABLE "card_account_mappings" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "user_id" uuid NOT NULL,
      "card_mask" character varying NOT NULL,
      "account_id" uuid NOT NULL,
      "created_at" TIMESTAMP NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_card_account_mappings" PRIMARY KEY ("id"))`);
    await queryRunner.query(`ALTER TABLE "card_account_mappings" ADD CONSTRAINT "FK_card_account_mappings_profiles"
      FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE "card_account_mappings" ADD CONSTRAINT "FK_card_account_mappings_accounts"
      FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_card_account_mappings_user_card"
      ON "card_account_mappings" ("user_id", "card_mask")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "card_account_mappings"`);
    await queryRunner.query(`DROP TABLE "imported_transactions"`);
    await queryRunner.query(`DROP TABLE "telegram_link_tokens"`);
    await queryRunner.query(`DROP TABLE "telegram_links"`);
  }
}
```

Сверь имя FK-таблицы счетов с существующими миграциями (`accounts`) — если в схеме другое имя, поправь.

- [ ] **Step 4: Проверить компиляцию**

Run: `cd backend && bun run build`
Expected: успех без ошибок TypeScript.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/telegram-import backend/src/database/migrations backend/src/config/data-source.ts backend/src/app.module.ts
git commit -m "feat(telegram-import): ORM entities and migration for telegram import tables"
```

---

### Task 2: Парсер банковских сообщений (TDD, ядро фичи)

**Files:**
- Create: `backend/src/modules/telegram-import/domain/parsers/parsed-bank-message.ts`
- Create: `backend/src/modules/telegram-import/domain/parsers/humo-message.parser.ts`
- Create: `backend/src/modules/telegram-import/domain/parsers/parser-registry.ts`
- Create: `backend/src/modules/telegram-import/domain/parsers/dedup-hash.ts`
- Test: `backend/src/modules/telegram-import/domain/parsers/humo-message.parser.spec.ts`

- [ ] **Step 1: Написать падающие тесты парсера**

`humo-message.parser.spec.ts`:
```ts
import { HumoMessageParser } from './humo-message.parser';

const PAYMENT = `💸 Оплата
➖ 1.700,00 UZS
📍 TRANSPORT TOLOV>TOS
💳 HUMOCARD *1951
🕓 22:11 12.06.2026
💰 12.543.101,08 UZS`;

const TOPUP = `🎉 Пополнение
➕ 103.500,00 UZS
📍 HAMKOR HUMO P2P>Andi
💳 HUMOCARD *1951
🕓 23:35 11.06.2026
💰 887.801,08 UZS`;

const BALANCE_CHANGE = `ℹ️ Счет по карте изменен
💸 13.244.800,00 UZS
💳 HUMO-CARD *1951
🕘 15:39 12.06.2026`;

describe('HumoMessageParser', () => {
  const parser = new HumoMessageParser();

  it('canParse возвращает true для всех трёх форматов', () => {
    expect(parser.canParse(PAYMENT)).toBe(true);
    expect(parser.canParse(TOPUP)).toBe(true);
    expect(parser.canParse(BALANCE_CHANGE)).toBe(true);
  });

  it('canParse возвращает false для постороннего текста', () => {
    expect(parser.canParse('привет, как дела?')).toBe(false);
  });

  it('парсит оплату как expense', () => {
    const r = parser.parse(PAYMENT)!;
    expect(r.type).toBe('expense');
    expect(r.amount).toBe(1700);
    expect(r.currency).toBe('UZS');
    expect(r.merchant).toBe('TRANSPORT TOLOV>TOS');
    expect(r.cardMask).toBe('*1951');
    expect(r.balanceAfter).toBe(12543101.08);
    expect(r.occurredAt.toISOString()).toBe('2026-06-12T17:11:00.000Z'); // 22:11 +05:00
  });

  it('парсит пополнение как income', () => {
    const r = parser.parse(TOPUP)!;
    expect(r.type).toBe('income');
    expect(r.amount).toBe(103500);
    expect(r.merchant).toBe('HAMKOR HUMO P2P>Andi');
    expect(r.balanceAfter).toBe(887801.08);
  });

  it('парсит смену баланса: amount=null, balanceAfter=новый баланс, HUMO-CARD и 🕘 не ломают', () => {
    const r = parser.parse(BALANCE_CHANGE)!;
    expect(r.type).toBe('balance_change');
    expect(r.amount).toBeNull();
    expect(r.merchant).toBeNull();
    expect(r.cardMask).toBe('*1951');
    expect(r.balanceAfter).toBe(13244800);
    expect(r.occurredAt.toISOString()).toBe('2026-06-12T10:39:00.000Z'); // 15:39 +05:00
  });

  it('терпит лишние пробелы и пустые строки', () => {
    const messy = PAYMENT.split('\n').map((l) => `  ${l}  `).join('\n\n');
    const r = parser.parse(messy)!;
    expect(r.amount).toBe(1700);
    expect(r.cardMask).toBe('*1951');
  });

  it('возвращает null, если нет суммы или карты', () => {
    expect(parser.parse('💸 Оплата\n📍 SHOP')).toBeNull();
  });

  it('парсит суммы без копеек и маленькие суммы', () => {
    const r = parser.parse(PAYMENT.replace('1.700,00', '500,00'))!;
    expect(r.amount).toBe(500);
  });
});
```

- [ ] **Step 2: Убедиться, что тесты падают**

Run (через test-runner сабагента): `cd backend && bun run test -- --testPathPattern=humo-message.parser`
Expected: FAIL — модуль не существует.

- [ ] **Step 3: Реализовать парсер**

`parsed-bank-message.ts`:
```ts
export type ParsedMessageType = 'expense' | 'income' | 'balance_change';

export interface ParsedBankMessage {
  type: ParsedMessageType;
  amount: number | null;
  currency: string;
  merchant: string | null;
  cardMask: string;
  occurredAt: Date;
  balanceAfter: number | null;
}

export interface BankMessageParser {
  canParse(text: string): boolean;
  parse(text: string): ParsedBankMessage | null;
}
```

`humo-message.parser.ts`:
```ts
import { BankMessageParser, ParsedBankMessage, ParsedMessageType } from './parsed-bank-message';

const TYPE_MARKERS: Array<{ marker: string; type: ParsedMessageType }> = [
  { marker: 'Оплата', type: 'expense' },
  { marker: 'Пополнение', type: 'income' },
  { marker: 'Счет по карте изменен', type: 'balance_change' },
];

/** '12.543.101,08' -> 12543101.08 */
function parseUzAmount(raw: string): number | null {
  const normalized = raw.replace(/\./g, '').replace(',', '.');
  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? value : null;
}

const AMOUNT_RE = /([\d.]+,\d{2})\s*([A-Z]{3})/;
const CARD_RE = /💳[^*]*(\*\d+)/;
const DATETIME_RE = /(\d{2}):(\d{2})\s+(\d{2})\.(\d{2})\.(\d{4})/;

export class HumoMessageParser implements BankMessageParser {
  canParse(text: string): boolean {
    const firstLine = text.trim().split('\n')[0] ?? '';
    return TYPE_MARKERS.some(({ marker }) => firstLine.includes(marker));
  }

  parse(text: string): ParsedBankMessage | null {
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (lines.length === 0) return null;

    const typeEntry = TYPE_MARKERS.find(({ marker }) => lines[0].includes(marker));
    if (!typeEntry) return null;
    const type = typeEntry.type;

    const cardMatch = text.match(CARD_RE);
    const dtMatch = text.match(DATETIME_RE);
    if (!cardMatch || !dtMatch) return null;

    const [, hh, min, dd, mm, yyyy] = dtMatch;
    const occurredAt = new Date(`${yyyy}-${mm}-${dd}T${hh}:${min}:00+05:00`);
    if (Number.isNaN(occurredAt.getTime())) return null;

    const merchantLine = lines.find((l) => l.startsWith('📍'));
    const merchant = merchantLine ? merchantLine.replace('📍', '').trim() : null;

    let amount: number | null = null;
    let balanceAfter: number | null = null;

    if (type === 'balance_change') {
      // 💸 здесь — новый баланс карты, суммы операции нет
      const balanceLine = lines.find((l) => l.startsWith('💸'));
      const m = balanceLine?.match(AMOUNT_RE);
      if (!m) return null;
      balanceAfter = parseUzAmount(m[1]);
    } else {
      const amountLine = lines.find((l) => l.startsWith('➖') || l.startsWith('➕'));
      const am = amountLine?.match(AMOUNT_RE);
      if (!am) return null;
      amount = parseUzAmount(am[1]);
      if (amount === null) return null;

      const balanceLine = lines.find((l) => l.startsWith('💰'));
      const bm = balanceLine?.match(AMOUNT_RE);
      balanceAfter = bm ? parseUzAmount(bm[1]) : null;
    }

    const currencyMatch = text.match(AMOUNT_RE);
    const currency = currencyMatch ? currencyMatch[2] : 'UZS';

    return { type, amount, currency, merchant, cardMask: cardMatch[1], occurredAt, balanceAfter };
  }
}
```

`parser-registry.ts`:
```ts
import { BankMessageParser, ParsedBankMessage } from './parsed-bank-message';
import { HumoMessageParser } from './humo-message.parser';

export class ParserRegistry {
  private readonly parsers: BankMessageParser[] = [new HumoMessageParser()];

  parse(text: string): ParsedBankMessage | null {
    for (const parser of this.parsers) {
      if (parser.canParse(text)) {
        const result = parser.parse(text);
        if (result) return result;
      }
    }
    return null;
  }
}
```

`dedup-hash.ts`:
```ts
import * as crypto from 'crypto';
import { ParsedBankMessage } from './parsed-bank-message';

export function computeDedupHash(parsed: ParsedBankMessage): string {
  const payload = [
    parsed.cardMask,
    parsed.type,
    parsed.occurredAt.toISOString(),
    parsed.amount ?? '',
    parsed.balanceAfter ?? '',
  ].join('|');
  return crypto.createHash('sha256').update(payload).digest('hex');
}

export function computeUnparsedDedupHash(rawText: string): string {
  return crypto.createHash('sha256').update(rawText.trim()).digest('hex');
}
```

- [ ] **Step 4: Убедиться, что тесты проходят**

Run (test-runner): `cd backend && bun run test -- --testPathPattern=humo-message.parser`
Expected: PASS, все тесты зелёные.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/telegram-import/domain
git commit -m "feat(telegram-import): bank message parser with HUMO format support"
```

---

### Task 3: Домен — модели и интерфейсы репозиториев + инфраструктура

Доменные модели — плоские (CRUD-модуль, без агрегатов и domain events; осознанное упрощение относительно accounting).

**Files:**
- Create: `backend/src/modules/telegram-import/domain/models.ts`
- Create: `backend/src/modules/telegram-import/domain/repositories/telegram-link.repository.interface.ts`
- Create: `backend/src/modules/telegram-import/domain/repositories/link-token.repository.interface.ts`
- Create: `backend/src/modules/telegram-import/domain/repositories/imported-transaction.repository.interface.ts`
- Create: `backend/src/modules/telegram-import/domain/repositories/card-mapping.repository.interface.ts`
- Create: `backend/src/modules/telegram-import/infrastructure/persistence/repositories/telegram-link.repository.ts`
- Create: `backend/src/modules/telegram-import/infrastructure/persistence/repositories/link-token.repository.ts`
- Create: `backend/src/modules/telegram-import/infrastructure/persistence/repositories/imported-transaction.repository.ts`
- Create: `backend/src/modules/telegram-import/infrastructure/persistence/repositories/card-mapping.repository.ts`

- [ ] **Step 1: Доменные модели**

`domain/models.ts`:
```ts
export type ImportedTransactionType = 'expense' | 'income' | 'balance_change' | 'unparsed';
export type ImportedTransactionStatus = 'pending' | 'confirmed' | 'dismissed';

export interface TelegramLink {
  id: string;
  userId: string;
  telegramUserId: string;
  telegramUsername: string | null;
  createdAt: Date;
}

export interface ImportedTransaction {
  id: string;
  userId: string;
  rawText: string;
  type: ImportedTransactionType;
  amount: number | null;
  currency: string;
  merchant: string | null;
  cardMask: string | null;
  occurredAt: Date | null;
  balanceAfter: number | null;
  dedupHash: string;
  status: ImportedTransactionStatus;
  transactionId: string | null;
  createdAt: Date;
}

export interface CardAccountMapping {
  userId: string;
  cardMask: string;
  accountId: string;
}

export interface CardWithMapping {
  cardMask: string;
  accountId: string | null;
  lastSeenAt: Date | null;
}
```

- [ ] **Step 2: Интерфейсы репозиториев (токены — Symbol)**

`telegram-link.repository.interface.ts`:
```ts
import { TelegramLink } from '../models';

export const TELEGRAM_LINK_REPOSITORY = Symbol('TELEGRAM_LINK_REPOSITORY');

export interface ITelegramLinkRepository {
  findByUserId(userId: string): Promise<TelegramLink | null>;
  findByTelegramUserId(telegramUserId: string): Promise<TelegramLink | null>;
  save(link: Omit<TelegramLink, 'id' | 'createdAt'>): Promise<TelegramLink>;
  deleteByUserId(userId: string): Promise<void>;
}
```

`link-token.repository.interface.ts`:
```ts
export const LINK_TOKEN_REPOSITORY = Symbol('LINK_TOKEN_REPOSITORY');

export interface ILinkTokenRepository {
  create(userId: string, token: string, expiresAt: Date): Promise<void>;
  /** Возвращает userId, если токен валиден (не истёк, не использован), иначе null */
  consume(token: string): Promise<string | null>;
}
```

`imported-transaction.repository.interface.ts`:
```ts
import { ImportedTransaction } from '../models';

export const IMPORTED_TRANSACTION_REPOSITORY = Symbol('IMPORTED_TRANSACTION_REPOSITORY');

export interface InboxItem extends ImportedTransaction {
  suggestedAccountId: string | null;
}

export interface ImportedTransactionCreate {
  userId: string;
  rawText: string;
  type: ImportedTransaction['type'];
  amount: number | null;
  currency: string;
  merchant: string | null;
  cardMask: string | null;
  occurredAt: Date | null;
  balanceAfter: number | null;
  dedupHash: string;
}

export interface IImportedTransactionRepository {
  /** Возвращает null при конфликте dedup (user_id, dedup_hash) */
  insertIfNew(data: ImportedTransactionCreate): Promise<ImportedTransaction | null>;
  findById(id: string): Promise<ImportedTransaction | null>;
  findPendingWithSuggestions(userId: string): Promise<InboxItem[]>;
  countPending(userId: string): Promise<number>;
  markConfirmed(id: string, transactionId: string): Promise<void>;
  markDismissed(id: string): Promise<void>;
  /** Последний известный баланс карты до occurredAt (для дельты balance_change) */
  findLatestBalance(userId: string, cardMask: string, before: Date): Promise<number | null>;
  /** Встречное pending-сообщение для перевода: противоположный тип, та же сумма, ±15 мин, карта замаплена на counterAccountId */
  findTransferCounterpart(params: {
    userId: string;
    oppositeType: 'expense' | 'income';
    amount: number;
    occurredAt: Date;
    counterAccountId: string;
    excludeId: string;
  }): Promise<ImportedTransaction | null>;
}
```

`card-mapping.repository.interface.ts`:
```ts
import { CardAccountMapping, CardWithMapping } from '../models';

export const CARD_MAPPING_REPOSITORY = Symbol('CARD_MAPPING_REPOSITORY');

export interface ICardMappingRepository {
  findByUserAndCard(userId: string, cardMask: string): Promise<CardAccountMapping | null>;
  upsert(mapping: CardAccountMapping): Promise<void>;
  delete(userId: string, cardMask: string): Promise<void>;
  /** Все замеченные карты: distinct из imported_transactions LEFT JOIN mappings */
  listCards(userId: string): Promise<CardWithMapping[]>;
}
```

- [ ] **Step 3: Реализации репозиториев**

`telegram-link.repository.ts`:
```ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TelegramLinkOrmEntity } from '../typeorm';
import { ITelegramLinkRepository } from '../../../domain/repositories/telegram-link.repository.interface';
import { TelegramLink } from '../../../domain/models';

@Injectable()
export class TelegramLinkRepository implements ITelegramLinkRepository {
  constructor(
    @InjectRepository(TelegramLinkOrmEntity)
    private readonly repo: Repository<TelegramLinkOrmEntity>,
  ) {}

  async findByUserId(userId: string): Promise<TelegramLink | null> {
    return this.repo.findOne({ where: { userId } });
  }

  async findByTelegramUserId(telegramUserId: string): Promise<TelegramLink | null> {
    return this.repo.findOne({ where: { telegramUserId } });
  }

  async save(link: Omit<TelegramLink, 'id' | 'createdAt'>): Promise<TelegramLink> {
    return this.repo.save(this.repo.create(link));
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.repo.delete({ userId });
  }
}
```
(ORM-сущность структурно совпадает с доменной моделью — отдельный mapper не нужен; то же для остальных, кроме `imported-transaction`, где decimal-строки конвертируются в number.)

`link-token.repository.ts`:
```ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { TelegramLinkTokenOrmEntity } from '../typeorm';
import { ILinkTokenRepository } from '../../../domain/repositories/link-token.repository.interface';

@Injectable()
export class LinkTokenRepository implements ILinkTokenRepository {
  constructor(
    @InjectRepository(TelegramLinkTokenOrmEntity)
    private readonly repo: Repository<TelegramLinkTokenOrmEntity>,
  ) {}

  async create(userId: string, token: string, expiresAt: Date): Promise<void> {
    await this.repo.save(this.repo.create({ userId, token, expiresAt }));
  }

  async consume(token: string): Promise<string | null> {
    const row = await this.repo.findOne({
      where: { token, usedAt: IsNull(), expiresAt: MoreThan(new Date()) },
    });
    if (!row) return null;
    await this.repo.update(row.id, { usedAt: new Date() });
    return row.userId;
  }
}
```

`imported-transaction.repository.ts`:
```ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ImportedTransactionOrmEntity } from '../typeorm';
import {
  IImportedTransactionRepository,
  ImportedTransactionCreate,
  InboxItem,
} from '../../../domain/repositories/imported-transaction.repository.interface';
import { ImportedTransaction } from '../../../domain/models';

function toDomain(orm: ImportedTransactionOrmEntity): ImportedTransaction {
  return {
    ...orm,
    amount: orm.amount === null ? null : Number(orm.amount),
    balanceAfter: orm.balanceAfter === null ? null : Number(orm.balanceAfter),
  };
}

const PG_UNIQUE_VIOLATION = '23505';

@Injectable()
export class ImportedTransactionRepository implements IImportedTransactionRepository {
  constructor(
    @InjectRepository(ImportedTransactionOrmEntity)
    private readonly repo: Repository<ImportedTransactionOrmEntity>,
  ) {}

  async insertIfNew(data: ImportedTransactionCreate): Promise<ImportedTransaction | null> {
    try {
      const saved = await this.repo.save(
        this.repo.create({
          ...data,
          amount: data.amount === null ? null : data.amount.toFixed(2),
          balanceAfter: data.balanceAfter === null ? null : data.balanceAfter.toFixed(2),
        }),
      );
      return toDomain(saved);
    } catch (error: unknown) {
      if ((error as { code?: string }).code === PG_UNIQUE_VIOLATION) return null;
      throw error;
    }
  }

  async findById(id: string): Promise<ImportedTransaction | null> {
    const orm = await this.repo.findOne({ where: { id } });
    return orm ? toDomain(orm) : null;
  }

  async findPendingWithSuggestions(userId: string): Promise<InboxItem[]> {
    const rows = await this.repo
      .createQueryBuilder('it')
      .leftJoin(
        'card_account_mappings',
        'cm',
        'cm.user_id = it.user_id AND cm.card_mask = it.card_mask',
      )
      .addSelect('cm.account_id', 'suggested_account_id')
      .where('it.userId = :userId', { userId })
      .andWhere('it.status = :status', { status: 'pending' })
      .andWhere("it.type != 'unparsed'")
      .orderBy('it.occurredAt', 'DESC')
      .getRawAndEntities();

    return rows.entities.map((orm, i) => ({
      ...toDomain(orm),
      suggestedAccountId: (rows.raw[i] as { suggested_account_id: string | null }).suggested_account_id,
    }));
  }

  async countPending(userId: string): Promise<number> {
    return this.repo.count({ where: { userId, status: 'pending' } }).then((total) =>
      // unparsed не показываем — вычитаем их
      this.repo
        .count({ where: { userId, status: 'pending', type: 'unparsed' } })
        .then((unparsed) => total - unparsed),
    );
  }

  async markConfirmed(id: string, transactionId: string): Promise<void> {
    await this.repo.update(id, { status: 'confirmed', transactionId });
  }

  async markDismissed(id: string): Promise<void> {
    await this.repo.update(id, { status: 'dismissed' });
  }

  async findLatestBalance(userId: string, cardMask: string, before: Date): Promise<number | null> {
    const row = await this.repo
      .createQueryBuilder('it')
      .where('it.userId = :userId', { userId })
      .andWhere('it.cardMask = :cardMask', { cardMask })
      .andWhere('it.balanceAfter IS NOT NULL')
      .andWhere('it.occurredAt < :before', { before })
      .orderBy('it.occurredAt', 'DESC')
      .getOne();
    return row?.balanceAfter !== null && row?.balanceAfter !== undefined ? Number(row.balanceAfter) : null;
  }

  async findTransferCounterpart(params: {
    userId: string;
    oppositeType: 'expense' | 'income';
    amount: number;
    occurredAt: Date;
    counterAccountId: string;
    excludeId: string;
  }): Promise<ImportedTransaction | null> {
    const windowMs = 15 * 60 * 1000;
    const from = new Date(params.occurredAt.getTime() - windowMs);
    const to = new Date(params.occurredAt.getTime() + windowMs);
    const orm = await this.repo
      .createQueryBuilder('it')
      .innerJoin(
        'card_account_mappings',
        'cm',
        'cm.user_id = it.user_id AND cm.card_mask = it.card_mask AND cm.account_id = :counterAccountId',
        { counterAccountId: params.counterAccountId },
      )
      .where('it.userId = :userId', { userId: params.userId })
      .andWhere('it.id != :excludeId', { excludeId: params.excludeId })
      .andWhere('it.status = :status', { status: 'pending' })
      .andWhere('it.type = :type', { type: params.oppositeType })
      .andWhere('it.amount = :amount', { amount: params.amount.toFixed(2) })
      .andWhere('it.occurredAt BETWEEN :from AND :to', { from, to })
      .getOne();
    return orm ? toDomain(orm) : null;
  }
}
```

`card-mapping.repository.ts`:
```ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CardAccountMappingOrmEntity, ImportedTransactionOrmEntity } from '../typeorm';
import { ICardMappingRepository } from '../../../domain/repositories/card-mapping.repository.interface';
import { CardAccountMapping, CardWithMapping } from '../../../domain/models';

@Injectable()
export class CardMappingRepository implements ICardMappingRepository {
  constructor(
    @InjectRepository(CardAccountMappingOrmEntity)
    private readonly repo: Repository<CardAccountMappingOrmEntity>,
    @InjectRepository(ImportedTransactionOrmEntity)
    private readonly importedRepo: Repository<ImportedTransactionOrmEntity>,
  ) {}

  async findByUserAndCard(userId: string, cardMask: string): Promise<CardAccountMapping | null> {
    return this.repo.findOne({ where: { userId, cardMask } });
  }

  async upsert(mapping: CardAccountMapping): Promise<void> {
    await this.repo.upsert(
      { userId: mapping.userId, cardMask: mapping.cardMask, accountId: mapping.accountId },
      ['userId', 'cardMask'],
    );
  }

  async delete(userId: string, cardMask: string): Promise<void> {
    await this.repo.delete({ userId, cardMask });
  }

  async listCards(userId: string): Promise<CardWithMapping[]> {
    const rows: Array<{ card_mask: string; account_id: string | null; last_seen_at: string | null }> =
      await this.importedRepo.query(
        `SELECT seen.card_mask, cm.account_id, seen.last_seen_at
         FROM (
           SELECT card_mask, MAX(occurred_at) AS last_seen_at
           FROM imported_transactions
           WHERE user_id = $1 AND card_mask IS NOT NULL
           GROUP BY card_mask
           UNION
           SELECT card_mask, NULL FROM card_account_mappings WHERE user_id = $1
         ) seen
         LEFT JOIN card_account_mappings cm ON cm.user_id = $1 AND cm.card_mask = seen.card_mask
         GROUP BY seen.card_mask, cm.account_id, seen.last_seen_at
         ORDER BY seen.last_seen_at DESC NULLS LAST`,
        [userId],
      );
    // UNION может дать дубль карты (одна строка с датой, одна без) — схлопываем, предпочитая строку с датой
    const byCard = new Map<string, CardWithMapping>();
    for (const r of rows) {
      const existing = byCard.get(r.card_mask);
      const candidate: CardWithMapping = {
        cardMask: r.card_mask,
        accountId: r.account_id,
        lastSeenAt: r.last_seen_at ? new Date(r.last_seen_at) : null,
      };
      if (!existing || (candidate.lastSeenAt && !existing.lastSeenAt)) byCard.set(r.card_mask, candidate);
    }
    return [...byCard.values()];
  }
}
```

- [ ] **Step 4: Проверить компиляцию**

Run: `cd backend && bun run build`
Expected: успех. (QueryBuilder использует camelCase-свойства — `it.userId`, `it.cardMask` — известная gotcha; в строках сырых JOIN'ов — snake_case колонок, это корректно.)

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/telegram-import
git commit -m "feat(telegram-import): domain models and repositories"
```

---

### Task 4: grammY-бот, webhook-контроллер, модуль

- [ ] **Step 1: Установить grammy**

Run: `cd backend && bun add grammy`
Expected: появляется в `package.json` dependencies.

**Files:**
- Create: `backend/src/modules/telegram-import/infrastructure/telegram/telegram-bot.service.ts`
- Create: `backend/src/modules/telegram-import/infrastructure/telegram/reply-aggregator.ts`
- Create: `backend/src/modules/telegram-import/presentation/controllers/telegram-webhook.controller.ts`
- Create: `backend/src/modules/telegram-import/telegram-import.module.ts`
- Modify: `backend/src/app.module.ts` (imports: TelegramImportModule)

- [ ] **Step 2: Reply-агрегатор (дебаунс сводки 3с)**

`reply-aggregator.ts`:
```ts
export interface IngestCounts {
  imported: number;
  duplicates: number;
  unparsed: number;
}

type Flush = (counts: IngestCounts) => Promise<void>;

const DEBOUNCE_MS = 3000;

/** Копит результаты ingest по chatId и шлёт одну сводку после паузы в форвардах */
export class ReplyAggregator {
  private readonly pending = new Map<number, { counts: IngestCounts; timer: NodeJS.Timeout; flush: Flush }>();

  add(chatId: number, result: keyof IngestCounts, flush: Flush): void {
    const entry = this.pending.get(chatId);
    if (entry) {
      clearTimeout(entry.timer);
      entry.counts[result] += 1;
      entry.flush = flush;
      entry.timer = setTimeout(() => this.flushChat(chatId), DEBOUNCE_MS);
    } else {
      const counts: IngestCounts = { imported: 0, duplicates: 0, unparsed: 0 };
      counts[result] += 1;
      this.pending.set(chatId, {
        counts,
        flush,
        timer: setTimeout(() => this.flushChat(chatId), DEBOUNCE_MS),
      });
    }
  }

  private flushChat(chatId: number): void {
    const entry = this.pending.get(chatId);
    if (!entry) return;
    this.pending.delete(chatId);
    void entry.flush(entry.counts);
  }
}
```

- [ ] **Step 3: TelegramBotService**

`telegram-bot.service.ts`:
```ts
import { Injectable, Logger, OnApplicationBootstrap, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommandBus } from '@nestjs/cqrs';
import { Bot } from 'grammy';
import type { Update } from 'grammy/types';
import { ReplyAggregator, IngestCounts } from './reply-aggregator';
import { LinkTelegramAccountCommand } from '../../application/commands/link-telegram-account/link-telegram-account.command';
import { IngestBankMessageCommand } from '../../application/commands/ingest-bank-message/ingest-bank-message.command';
import type { LinkResult } from '../../application/commands/link-telegram-account/link-telegram-account.handler';
import type { IngestResult } from '../../application/commands/ingest-bank-message/ingest-bank-message.handler';

function summaryText(c: IngestCounts): string {
  const parts: string[] = [];
  if (c.imported) parts.push(`✅ Импортировано: ${c.imported}`);
  if (c.duplicates) parts.push(`⏭ Пропущено дублей: ${c.duplicates}`);
  if (c.unparsed) parts.push(`⚠️ Не распознано: ${c.unparsed}`);
  if (c.imported) parts.push('\nПодтверди транзакции в приложении — раздел «На подтверждение».');
  return parts.join('\n') || 'Ничего не обработано.';
}

@Injectable()
export class TelegramBotService implements OnModuleInit, OnApplicationBootstrap {
  private readonly logger = new Logger(TelegramBotService.name);
  private bot: Bot | null = null;
  private readonly aggregator = new ReplyAggregator();
  readonly enabled: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly commandBus: CommandBus,
  ) {
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    this.enabled = Boolean(token);
    if (token) this.bot = new Bot(token);
  }

  async onModuleInit(): Promise<void> {
    if (!this.bot) {
      this.logger.warn('TELEGRAM_BOT_TOKEN не задан — telegram-import отключён');
      return;
    }
    this.registerHandlers(this.bot);
    await this.bot.init();
  }

  async onApplicationBootstrap(): Promise<void> {
    const url = this.configService.get<string>('TELEGRAM_WEBHOOK_URL');
    const secret = this.configService.get<string>('TELEGRAM_WEBHOOK_SECRET');
    if (this.bot && url && secret) {
      await this.bot.api.setWebhook(url, { secret_token: secret });
      this.logger.log(`Telegram webhook установлен: ${url}`);
    }
  }

  async handleUpdate(update: Update): Promise<void> {
    if (this.bot) await this.bot.handleUpdate(update);
  }

  private registerHandlers(bot: Bot): void {
    const pm = bot.chatType('private');

    pm.command('start', async (ctx) => {
      const token = ctx.match?.trim();
      if (!token) {
        await ctx.reply(
          'Привет! Я импортирую банковские уведомления в твоё финансовое приложение.\n\n' +
            'Привяжи аккаунт: открой приложение → Профиль → Telegram-импорт → «Подключить».',
        );
        return;
      }
      const result = await this.commandBus.execute<LinkTelegramAccountCommand, LinkResult>(
        new LinkTelegramAccountCommand(token, String(ctx.from.id), ctx.from.username ?? null),
      );
      const replies: Record<LinkResult, string> = {
        linked: '✅ Аккаунт привязан! Теперь форвардни мне уведомление от банка — я превращу его в транзакцию.',
        invalid_token: '⚠️ Ссылка устарела или уже использована. Сгенерируй новую в приложении.',
        already_linked_other: '⚠️ Этот Telegram уже привязан к другому аккаунту. Сначала отвяжи его там.',
      };
      await ctx.reply(replies[result]);
    });

    pm.on('message:text', async (ctx) => {
      const result = await this.commandBus.execute<IngestBankMessageCommand, IngestResult>(
        new IngestBankMessageCommand(String(ctx.from.id), ctx.message.text),
      );
      if (result === 'not_linked') {
        await ctx.reply('Сначала привяжи аккаунт: приложение → Профиль → Telegram-импорт → «Подключить».');
        return;
      }
      const key = result === 'imported' ? 'imported' : result === 'duplicate' ? 'duplicates' : 'unparsed';
      this.aggregator.add(ctx.chat.id, key, async (counts) => {
        await ctx.reply(summaryText(counts));
      });
    });
  }
}
```
(Команды из Task 5–6; типы `LinkResult`/`IngestResult` определены там. При выполнении этой задачи раньше Task 5–6 — создай команды-заглушки из тех задач сразу, код в них полный.)

- [ ] **Step 4: Webhook-контроллер**

`telegram-webhook.controller.ts`:
```ts
import {
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import * as crypto from 'crypto';
import { Public } from '../../../../common/decorators/public.decorator';
import { TelegramBotService } from '../../infrastructure/telegram/telegram-bot.service';

@Controller('telegram-import')
export class TelegramWebhookController {
  constructor(
    private readonly botService: TelegramBotService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @SkipThrottle()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Req() req: Request): Promise<{ ok: boolean }> {
    if (!this.botService.enabled) throw new ServiceUnavailableException('Telegram import disabled');

    const secret = this.configService.getOrThrow<string>('TELEGRAM_WEBHOOK_SECRET');
    const header = req.headers['x-telegram-bot-api-secret-token'];
    const provided = typeof header === 'string' ? header : '';
    const a = Buffer.from(provided);
    const b = Buffer.from(secret);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Invalid telegram secret token');
    }

    await this.botService.handleUpdate(req.body);
    return { ok: true };
  }
}
```

- [ ] **Step 5: Модуль**

`telegram-import.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  CardAccountMappingOrmEntity,
  ImportedTransactionOrmEntity,
  TelegramLinkOrmEntity,
  TelegramLinkTokenOrmEntity,
} from './infrastructure/persistence/typeorm';
import { TELEGRAM_LINK_REPOSITORY } from './domain/repositories/telegram-link.repository.interface';
import { LINK_TOKEN_REPOSITORY } from './domain/repositories/link-token.repository.interface';
import { IMPORTED_TRANSACTION_REPOSITORY } from './domain/repositories/imported-transaction.repository.interface';
import { CARD_MAPPING_REPOSITORY } from './domain/repositories/card-mapping.repository.interface';
import { TelegramLinkRepository } from './infrastructure/persistence/repositories/telegram-link.repository';
import { LinkTokenRepository } from './infrastructure/persistence/repositories/link-token.repository';
import { ImportedTransactionRepository } from './infrastructure/persistence/repositories/imported-transaction.repository';
import { CardMappingRepository } from './infrastructure/persistence/repositories/card-mapping.repository';
import { TelegramBotService } from './infrastructure/telegram/telegram-bot.service';
import { TelegramWebhookController } from './presentation/controllers/telegram-webhook.controller';
import { TelegramImportController } from './presentation/controllers/telegram-import.controller';
import { CommandHandlers } from './application/commands';
import { QueryHandlers } from './application/queries';

@Module({
  imports: [
    CqrsModule,
    ConfigModule,
    TypeOrmModule.forFeature([
      TelegramLinkOrmEntity,
      TelegramLinkTokenOrmEntity,
      ImportedTransactionOrmEntity,
      CardAccountMappingOrmEntity,
    ]),
  ],
  controllers: [TelegramWebhookController, TelegramImportController],
  providers: [
    { provide: TELEGRAM_LINK_REPOSITORY, useClass: TelegramLinkRepository },
    { provide: LINK_TOKEN_REPOSITORY, useClass: LinkTokenRepository },
    { provide: IMPORTED_TRANSACTION_REPOSITORY, useClass: ImportedTransactionRepository },
    { provide: CARD_MAPPING_REPOSITORY, useClass: CardMappingRepository },
    TelegramBotService,
    ...CommandHandlers,
    ...QueryHandlers,
  ],
})
export class TelegramImportModule {}
```
(`TelegramImportController` и индексы команд/запросов — Task 5–7; модуль компилируется после них. Добавь `TelegramImportModule` в `imports` в `app.module.ts`.)

- [ ] **Step 6: Commit (после Task 5–7, когда модуль компилируется)** — см. Task 7 Step 7.

---

### Task 5: Команды линковки + контроллер (часть 1)

**Files:**
- Create: `backend/src/modules/telegram-import/application/commands/create-link-token/create-link-token.command.ts`
- Create: `backend/src/modules/telegram-import/application/commands/create-link-token/create-link-token.handler.ts`
- Create: `backend/src/modules/telegram-import/application/commands/link-telegram-account/link-telegram-account.command.ts`
- Create: `backend/src/modules/telegram-import/application/commands/link-telegram-account/link-telegram-account.handler.ts`
- Test: `backend/src/modules/telegram-import/application/commands/link-telegram-account/link-telegram-account.handler.spec.ts`
- Create: `backend/src/modules/telegram-import/application/commands/unlink-telegram/unlink-telegram.command.ts`
- Create: `backend/src/modules/telegram-import/application/commands/unlink-telegram/unlink-telegram.handler.ts`
- Create: `backend/src/modules/telegram-import/application/queries/get-link-status/get-link-status.query.ts`
- Create: `backend/src/modules/telegram-import/application/queries/get-link-status/get-link-status.handler.ts`

- [ ] **Step 1: Тест LinkTelegramAccountHandler (падающий)**

`link-telegram-account.handler.spec.ts`:
```ts
import { Test, TestingModule } from '@nestjs/testing';
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
    linkRepo.save.mockImplementation((l) => Promise.resolve({ id: 'x', createdAt: new Date(), ...l }));

    const result = await handler.execute(new LinkTelegramAccountCommand('tok', '42', 'andi'));

    expect(result).toBe('linked');
    expect(linkRepo.deleteByUserId).toHaveBeenCalledWith('user-1');
    expect(linkRepo.save).toHaveBeenCalledWith({ userId: 'user-1', telegramUserId: '42', telegramUsername: 'andi' });
  });

  it('invalid_token при невалидном токене', async () => {
    tokenRepo.consume.mockResolvedValue(null);
    expect(await handler.execute(new LinkTelegramAccountCommand('bad', '42', null))).toBe('invalid_token');
  });

  it('already_linked_other, если TG привязан к другому пользователю', async () => {
    tokenRepo.consume.mockResolvedValue('user-1');
    linkRepo.findByTelegramUserId.mockResolvedValue({ userId: 'user-2', telegramUserId: '42' });
    expect(await handler.execute(new LinkTelegramAccountCommand('tok', '42', null))).toBe('already_linked_other');
  });

  it('перелинковка того же пользователя — ок', async () => {
    tokenRepo.consume.mockResolvedValue('user-1');
    linkRepo.findByTelegramUserId.mockResolvedValue({ userId: 'user-1', telegramUserId: '42' });
    linkRepo.save.mockImplementation((l) => Promise.resolve(l));
    expect(await handler.execute(new LinkTelegramAccountCommand('tok', '42', null))).toBe('linked');
  });
});
```

- [ ] **Step 2: Запустить — FAIL** (test-runner): `bun run test -- --testPathPattern=link-telegram-account`

- [ ] **Step 3: Реализация**

`create-link-token.command.ts`:
```ts
export class CreateLinkTokenCommand {
  constructor(public readonly userId: string) {}
}
```

`create-link-token.handler.ts`:
```ts
import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { CreateLinkTokenCommand } from './create-link-token.command';
import {
  ILinkTokenRepository,
  LINK_TOKEN_REPOSITORY,
} from '../../../domain/repositories/link-token.repository.interface';

const TOKEN_TTL_MS = 15 * 60 * 1000;

@CommandHandler(CreateLinkTokenCommand)
export class CreateLinkTokenHandler implements ICommandHandler<CreateLinkTokenCommand> {
  constructor(
    @Inject(LINK_TOKEN_REPOSITORY) private readonly tokenRepo: ILinkTokenRepository,
    private readonly configService: ConfigService,
  ) {}

  async execute(command: CreateLinkTokenCommand): Promise<{ deepLink: string }> {
    const token = crypto.randomBytes(24).toString('base64url');
    await this.tokenRepo.create(command.userId, token, new Date(Date.now() + TOKEN_TTL_MS));
    const botUsername = this.configService.getOrThrow<string>('TELEGRAM_BOT_USERNAME');
    return { deepLink: `https://t.me/${botUsername}?start=${token}` };
  }
}
```

`link-telegram-account.command.ts`:
```ts
export class LinkTelegramAccountCommand {
  constructor(
    public readonly token: string,
    public readonly telegramUserId: string,
    public readonly telegramUsername: string | null,
  ) {}
}
```

`link-telegram-account.handler.ts`:
```ts
import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { LinkTelegramAccountCommand } from './link-telegram-account.command';
import {
  ILinkTokenRepository,
  LINK_TOKEN_REPOSITORY,
} from '../../../domain/repositories/link-token.repository.interface';
import {
  ITelegramLinkRepository,
  TELEGRAM_LINK_REPOSITORY,
} from '../../../domain/repositories/telegram-link.repository.interface';

export type LinkResult = 'linked' | 'invalid_token' | 'already_linked_other';

@CommandHandler(LinkTelegramAccountCommand)
export class LinkTelegramAccountHandler implements ICommandHandler<LinkTelegramAccountCommand> {
  constructor(
    @Inject(LINK_TOKEN_REPOSITORY) private readonly tokenRepo: ILinkTokenRepository,
    @Inject(TELEGRAM_LINK_REPOSITORY) private readonly linkRepo: ITelegramLinkRepository,
  ) {}

  async execute(command: LinkTelegramAccountCommand): Promise<LinkResult> {
    const userId = await this.tokenRepo.consume(command.token);
    if (!userId) return 'invalid_token';

    const existingByTg = await this.linkRepo.findByTelegramUserId(command.telegramUserId);
    if (existingByTg && existingByTg.userId !== userId) return 'already_linked_other';

    // перелинковка: убираем старые связи (и по user, и по tg — это может быть одна и та же строка)
    await this.linkRepo.deleteByUserId(userId);
    if (existingByTg) await this.linkRepo.deleteByUserId(existingByTg.userId);

    await this.linkRepo.save({
      userId,
      telegramUserId: command.telegramUserId,
      telegramUsername: command.telegramUsername,
    });
    return 'linked';
  }
}
```

`unlink-telegram.command.ts`:
```ts
export class UnlinkTelegramCommand {
  constructor(public readonly userId: string) {}
}
```

`unlink-telegram.handler.ts`:
```ts
import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UnlinkTelegramCommand } from './unlink-telegram.command';
import {
  ITelegramLinkRepository,
  TELEGRAM_LINK_REPOSITORY,
} from '../../../domain/repositories/telegram-link.repository.interface';

@CommandHandler(UnlinkTelegramCommand)
export class UnlinkTelegramHandler implements ICommandHandler<UnlinkTelegramCommand> {
  constructor(@Inject(TELEGRAM_LINK_REPOSITORY) private readonly linkRepo: ITelegramLinkRepository) {}

  async execute(command: UnlinkTelegramCommand): Promise<{ success: boolean }> {
    await this.linkRepo.deleteByUserId(command.userId);
    return { success: true };
  }
}
```

`get-link-status.query.ts`:
```ts
export class GetLinkStatusQuery {
  constructor(public readonly userId: string) {}
}
```

`get-link-status.handler.ts`:
```ts
import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetLinkStatusQuery } from './get-link-status.query';
import {
  ITelegramLinkRepository,
  TELEGRAM_LINK_REPOSITORY,
} from '../../../domain/repositories/telegram-link.repository.interface';

@QueryHandler(GetLinkStatusQuery)
export class GetLinkStatusHandler implements IQueryHandler<GetLinkStatusQuery> {
  constructor(@Inject(TELEGRAM_LINK_REPOSITORY) private readonly linkRepo: ITelegramLinkRepository) {}

  async execute(query: GetLinkStatusQuery): Promise<{ linked: boolean; telegramUsername: string | null }> {
    const link = await this.linkRepo.findByUserId(query.userId);
    return { linked: Boolean(link), telegramUsername: link?.telegramUsername ?? null };
  }
}
```

- [ ] **Step 4: Запустить — PASS** (test-runner): `bun run test -- --testPathPattern=link-telegram-account`

- [ ] **Step 5: Commit** — вместе с Task 7 (модуль ещё не компилируется без индексов).

---

### Task 6: Команда ingest (парсинг + дедуп + дельта баланса)

**Files:**
- Create: `backend/src/modules/telegram-import/application/commands/ingest-bank-message/ingest-bank-message.command.ts`
- Create: `backend/src/modules/telegram-import/application/commands/ingest-bank-message/ingest-bank-message.handler.ts`
- Test: `backend/src/modules/telegram-import/application/commands/ingest-bank-message/ingest-bank-message.handler.spec.ts`

- [ ] **Step 1: Падающий тест**

`ingest-bank-message.handler.spec.ts`:
```ts
import { Test, TestingModule } from '@nestjs/testing';
import { IngestBankMessageHandler } from './ingest-bank-message.handler';
import { IngestBankMessageCommand } from './ingest-bank-message.command';
import { TELEGRAM_LINK_REPOSITORY } from '../../../domain/repositories/telegram-link.repository.interface';
import { IMPORTED_TRANSACTION_REPOSITORY } from '../../../domain/repositories/imported-transaction.repository.interface';

const PAYMENT = `💸 Оплата
➖ 1.700,00 UZS
📍 TRANSPORT TOLOV>TOS
💳 HUMOCARD *1951
🕓 22:11 12.06.2026
💰 12.543.101,08 UZS`;

const BALANCE_CHANGE = `ℹ️ Счет по карте изменен
💸 13.244.800,00 UZS
💳 HUMO-CARD *1951
🕘 15:39 12.06.2026`;

describe('IngestBankMessageHandler', () => {
  let handler: IngestBankMessageHandler;
  const linkRepo = {
    findByUserId: jest.fn(), findByTelegramUserId: jest.fn(), save: jest.fn(), deleteByUserId: jest.fn(),
  };
  const importedRepo = {
    insertIfNew: jest.fn(), findById: jest.fn(), findPendingWithSuggestions: jest.fn(),
    countPending: jest.fn(), markConfirmed: jest.fn(), markDismissed: jest.fn(),
    findLatestBalance: jest.fn(), findTransferCounterpart: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IngestBankMessageHandler,
        { provide: TELEGRAM_LINK_REPOSITORY, useValue: linkRepo },
        { provide: IMPORTED_TRANSACTION_REPOSITORY, useValue: importedRepo },
      ],
    }).compile();
    handler = module.get(IngestBankMessageHandler);
    jest.clearAllMocks();
  });

  it('not_linked, если telegram-аккаунт не привязан', async () => {
    linkRepo.findByTelegramUserId.mockResolvedValue(null);
    expect(await handler.execute(new IngestBankMessageCommand('42', PAYMENT))).toBe('not_linked');
  });

  it('imported: парсит и сохраняет', async () => {
    linkRepo.findByTelegramUserId.mockResolvedValue({ userId: 'user-1' });
    importedRepo.insertIfNew.mockResolvedValue({ id: 'imp-1' });
    expect(await handler.execute(new IngestBankMessageCommand('42', PAYMENT))).toBe('imported');
    const arg = importedRepo.insertIfNew.mock.calls[0][0];
    expect(arg).toMatchObject({ userId: 'user-1', type: 'expense', amount: 1700, cardMask: '*1951' });
    expect(arg.dedupHash).toHaveLength(64);
  });

  it('duplicate при конфликте dedup', async () => {
    linkRepo.findByTelegramUserId.mockResolvedValue({ userId: 'user-1' });
    importedRepo.insertIfNew.mockResolvedValue(null);
    expect(await handler.execute(new IngestBankMessageCommand('42', PAYMENT))).toBe('duplicate');
  });

  it('unparsed: сохраняет raw с type=unparsed', async () => {
    linkRepo.findByTelegramUserId.mockResolvedValue({ userId: 'user-1' });
    importedRepo.insertIfNew.mockResolvedValue({ id: 'imp-2' });
    expect(await handler.execute(new IngestBankMessageCommand('42', 'просто текст'))).toBe('unparsed');
    expect(importedRepo.insertIfNew.mock.calls[0][0]).toMatchObject({ type: 'unparsed', amount: null });
  });

  it('balance_change: amount = дельта от последнего баланса карты', async () => {
    linkRepo.findByTelegramUserId.mockResolvedValue({ userId: 'user-1' });
    importedRepo.findLatestBalance.mockResolvedValue(887801.08);
    importedRepo.insertIfNew.mockResolvedValue({ id: 'imp-3' });
    await handler.execute(new IngestBankMessageCommand('42', BALANCE_CHANGE));
    const arg = importedRepo.insertIfNew.mock.calls[0][0];
    expect(arg.type).toBe('balance_change');
    expect(arg.amount).toBeCloseTo(13244800 - 887801.08, 2);
    expect(importedRepo.findLatestBalance).toHaveBeenCalledWith('user-1', '*1951', expect.any(Date));
  });

  it('balance_change без предыдущего баланса: amount = null', async () => {
    linkRepo.findByTelegramUserId.mockResolvedValue({ userId: 'user-1' });
    importedRepo.findLatestBalance.mockResolvedValue(null);
    importedRepo.insertIfNew.mockResolvedValue({ id: 'imp-4' });
    await handler.execute(new IngestBankMessageCommand('42', BALANCE_CHANGE));
    expect(importedRepo.insertIfNew.mock.calls[0][0].amount).toBeNull();
  });
});
```

- [ ] **Step 2: Запустить — FAIL** (test-runner): `bun run test -- --testPathPattern=ingest-bank-message`

- [ ] **Step 3: Реализация**

`ingest-bank-message.command.ts`:
```ts
export class IngestBankMessageCommand {
  constructor(
    public readonly telegramUserId: string,
    public readonly text: string,
  ) {}
}
```

`ingest-bank-message.handler.ts`:
```ts
import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IngestBankMessageCommand } from './ingest-bank-message.command';
import {
  ITelegramLinkRepository,
  TELEGRAM_LINK_REPOSITORY,
} from '../../../domain/repositories/telegram-link.repository.interface';
import {
  IImportedTransactionRepository,
  IMPORTED_TRANSACTION_REPOSITORY,
} from '../../../domain/repositories/imported-transaction.repository.interface';
import { ParserRegistry } from '../../../domain/parsers/parser-registry';
import { computeDedupHash, computeUnparsedDedupHash } from '../../../domain/parsers/dedup-hash';

export type IngestResult = 'imported' | 'duplicate' | 'unparsed' | 'not_linked';

@CommandHandler(IngestBankMessageCommand)
export class IngestBankMessageHandler implements ICommandHandler<IngestBankMessageCommand> {
  private readonly registry = new ParserRegistry();

  constructor(
    @Inject(TELEGRAM_LINK_REPOSITORY) private readonly linkRepo: ITelegramLinkRepository,
    @Inject(IMPORTED_TRANSACTION_REPOSITORY) private readonly importedRepo: IImportedTransactionRepository,
  ) {}

  async execute(command: IngestBankMessageCommand): Promise<IngestResult> {
    const link = await this.linkRepo.findByTelegramUserId(command.telegramUserId);
    if (!link) return 'not_linked';

    const parsed = this.registry.parse(command.text);

    if (!parsed) {
      const inserted = await this.importedRepo.insertIfNew({
        userId: link.userId,
        rawText: command.text,
        type: 'unparsed',
        amount: null,
        currency: 'UZS',
        merchant: null,
        cardMask: null,
        occurredAt: null,
        balanceAfter: null,
        dedupHash: computeUnparsedDedupHash(command.text),
      });
      return inserted ? 'unparsed' : 'duplicate';
    }

    let amount = parsed.amount;
    if (parsed.type === 'balance_change' && parsed.balanceAfter !== null) {
      const prev = await this.importedRepo.findLatestBalance(link.userId, parsed.cardMask, parsed.occurredAt);
      amount = prev === null ? null : Math.round((parsed.balanceAfter - prev) * 100) / 100;
    }

    const inserted = await this.importedRepo.insertIfNew({
      userId: link.userId,
      rawText: command.text,
      type: parsed.type,
      amount,
      currency: parsed.currency,
      merchant: parsed.merchant,
      cardMask: parsed.cardMask,
      occurredAt: parsed.occurredAt,
      balanceAfter: parsed.balanceAfter,
      dedupHash: computeDedupHash(parsed),
    });
    return inserted ? 'imported' : 'duplicate';
  }
}
```

- [ ] **Step 4: Запустить — PASS** (test-runner): `bun run test -- --testPathPattern=ingest-bank-message`

- [ ] **Step 5: Commit** — вместе с Task 7.

---

### Task 7: Инбокс: confirm/dismiss/query, карты, контроллер, индексы

**Files:**
- Create: `backend/src/modules/telegram-import/application/commands/confirm-imported/confirm-imported.command.ts`
- Create: `backend/src/modules/telegram-import/application/commands/confirm-imported/confirm-imported.handler.ts`
- Test: `backend/src/modules/telegram-import/application/commands/confirm-imported/confirm-imported.handler.spec.ts`
- Create: `backend/src/modules/telegram-import/application/commands/dismiss-imported/dismiss-imported.command.ts`
- Create: `backend/src/modules/telegram-import/application/commands/dismiss-imported/dismiss-imported.handler.ts`
- Create: `backend/src/modules/telegram-import/application/commands/set-card-mapping/set-card-mapping.command.ts`
- Create: `backend/src/modules/telegram-import/application/commands/set-card-mapping/set-card-mapping.handler.ts`
- Create: `backend/src/modules/telegram-import/application/commands/delete-card-mapping/delete-card-mapping.command.ts`
- Create: `backend/src/modules/telegram-import/application/commands/delete-card-mapping/delete-card-mapping.handler.ts`
- Create: `backend/src/modules/telegram-import/application/queries/get-inbox/get-inbox.query.ts`
- Create: `backend/src/modules/telegram-import/application/queries/get-inbox/get-inbox.handler.ts`
- Create: `backend/src/modules/telegram-import/application/queries/get-cards/get-cards.query.ts`
- Create: `backend/src/modules/telegram-import/application/queries/get-cards/get-cards.handler.ts`
- Create: `backend/src/modules/telegram-import/application/commands/index.ts`
- Create: `backend/src/modules/telegram-import/application/queries/index.ts`
- Create: `backend/src/modules/telegram-import/presentation/dto/confirm-imported.dto.ts`
- Create: `backend/src/modules/telegram-import/presentation/dto/set-card-mapping.dto.ts`
- Create: `backend/src/modules/telegram-import/presentation/controllers/telegram-import.controller.ts`

- [ ] **Step 1: Падающий тест ConfirmImportedHandler**

`confirm-imported.handler.spec.ts`:
```ts
import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfirmImportedHandler } from './confirm-imported.handler';
import { ConfirmImportedCommand } from './confirm-imported.command';
import { IMPORTED_TRANSACTION_REPOSITORY } from '../../../domain/repositories/imported-transaction.repository.interface';
import { CARD_MAPPING_REPOSITORY } from '../../../domain/repositories/card-mapping.repository.interface';

const basePending = {
  id: 'imp-1', userId: 'user-1', status: 'pending', type: 'expense',
  amount: 50000, cardMask: '*1951', occurredAt: new Date('2026-06-12T17:11:00Z'),
};

describe('ConfirmImportedHandler', () => {
  let handler: ConfirmImportedHandler;
  const importedRepo = {
    insertIfNew: jest.fn(), findById: jest.fn(), findPendingWithSuggestions: jest.fn(),
    countPending: jest.fn(), markConfirmed: jest.fn(), markDismissed: jest.fn(),
    findLatestBalance: jest.fn(), findTransferCounterpart: jest.fn(),
  };
  const cardRepo = { findByUserAndCard: jest.fn(), upsert: jest.fn(), delete: jest.fn(), listCards: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConfirmImportedHandler,
        { provide: IMPORTED_TRANSACTION_REPOSITORY, useValue: importedRepo },
        { provide: CARD_MAPPING_REPOSITORY, useValue: cardRepo },
      ],
    }).compile();
    handler = module.get(ConfirmImportedHandler);
    jest.clearAllMocks();
  });

  it('подтверждает, сохраняет маппинг карты', async () => {
    importedRepo.findById.mockResolvedValue(basePending);
    importedRepo.findTransferCounterpart.mockResolvedValue(null);

    const result = await handler.execute(
      new ConfirmImportedCommand('user-1', 'imp-1', 'tx-1', 'acc-1', undefined),
    );

    expect(result).toEqual({ success: true, counterpartId: null });
    expect(importedRepo.markConfirmed).toHaveBeenCalledWith('imp-1', 'tx-1');
    expect(cardRepo.upsert).toHaveBeenCalledWith({ userId: 'user-1', cardMask: '*1951', accountId: 'acc-1' });
  });

  it('NotFound для чужого/несуществующего id', async () => {
    importedRepo.findById.mockResolvedValue(null);
    await expect(
      handler.execute(new ConfirmImportedCommand('user-1', 'nope', 'tx-1', 'acc-1', undefined)),
    ).rejects.toThrow(NotFoundException);

    importedRepo.findById.mockResolvedValue({ ...basePending, userId: 'other' });
    await expect(
      handler.execute(new ConfirmImportedCommand('user-1', 'imp-1', 'tx-1', 'acc-1', undefined)),
    ).rejects.toThrow(ForbiddenException);
  });

  it('Forbidden, если не pending', async () => {
    importedRepo.findById.mockResolvedValue({ ...basePending, status: 'confirmed' });
    await expect(
      handler.execute(new ConfirmImportedCommand('user-1', 'imp-1', 'tx-1', 'acc-1', undefined)),
    ).rejects.toThrow(ForbiddenException);
  });

  it('перевод: гасит встречное сообщение той же транзакцией', async () => {
    importedRepo.findById.mockResolvedValue(basePending);
    importedRepo.findTransferCounterpart.mockResolvedValue({ id: 'imp-2' });

    const result = await handler.execute(
      new ConfirmImportedCommand('user-1', 'imp-1', 'tx-1', 'acc-1', 'acc-2'),
    );

    expect(importedRepo.findTransferCounterpart).toHaveBeenCalledWith({
      userId: 'user-1', oppositeType: 'income', amount: 50000,
      occurredAt: basePending.occurredAt, counterAccountId: 'acc-2', excludeId: 'imp-1',
    });
    expect(importedRepo.markConfirmed).toHaveBeenCalledWith('imp-2', 'tx-1');
    expect(result).toEqual({ success: true, counterpartId: 'imp-2' });
  });

  it('перевод без встречного — просто подтверждает', async () => {
    importedRepo.findById.mockResolvedValue(basePending);
    importedRepo.findTransferCounterpart.mockResolvedValue(null);
    const result = await handler.execute(
      new ConfirmImportedCommand('user-1', 'imp-1', 'tx-1', 'acc-1', 'acc-2'),
    );
    expect(result.counterpartId).toBeNull();
  });
});
```

- [ ] **Step 2: Запустить — FAIL** (test-runner): `bun run test -- --testPathPattern=confirm-imported`

- [ ] **Step 3: Реализация команд/запросов**

`confirm-imported.command.ts`:
```ts
export class ConfirmImportedCommand {
  constructor(
    public readonly userId: string,
    public readonly importedId: string,
    public readonly transactionId: string,
    public readonly accountId: string,
    public readonly toAccountId: string | undefined, // задан => подтверждено как перевод
  ) {}
}
```

`confirm-imported.handler.ts`:
```ts
import { ForbiddenException, Inject, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ConfirmImportedCommand } from './confirm-imported.command';
import {
  IImportedTransactionRepository,
  IMPORTED_TRANSACTION_REPOSITORY,
} from '../../../domain/repositories/imported-transaction.repository.interface';
import {
  CARD_MAPPING_REPOSITORY,
  ICardMappingRepository,
} from '../../../domain/repositories/card-mapping.repository.interface';

@CommandHandler(ConfirmImportedCommand)
export class ConfirmImportedHandler implements ICommandHandler<ConfirmImportedCommand> {
  constructor(
    @Inject(IMPORTED_TRANSACTION_REPOSITORY) private readonly importedRepo: IImportedTransactionRepository,
    @Inject(CARD_MAPPING_REPOSITORY) private readonly cardRepo: ICardMappingRepository,
  ) {}

  async execute(command: ConfirmImportedCommand): Promise<{ success: boolean; counterpartId: string | null }> {
    const item = await this.importedRepo.findById(command.importedId);
    if (!item) throw new NotFoundException('Imported transaction not found');
    if (item.userId !== command.userId) throw new ForbiddenException();
    if (item.status !== 'pending') throw new ForbiddenException('Already processed');

    await this.importedRepo.markConfirmed(item.id, command.transactionId);

    if (item.cardMask) {
      await this.cardRepo.upsert({
        userId: command.userId,
        cardMask: item.cardMask,
        accountId: command.accountId,
      });
    }

    let counterpartId: string | null = null;
    if (command.toAccountId && item.amount !== null && item.occurredAt) {
      const counterpart = await this.importedRepo.findTransferCounterpart({
        userId: command.userId,
        oppositeType: item.type === 'expense' ? 'income' : 'expense',
        amount: Math.abs(item.amount),
        occurredAt: item.occurredAt,
        counterAccountId: command.toAccountId,
        excludeId: item.id,
      });
      if (counterpart) {
        await this.importedRepo.markConfirmed(counterpart.id, command.transactionId);
        counterpartId = counterpart.id;
      }
    }

    return { success: true, counterpartId };
  }
}
```

`dismiss-imported.command.ts` / `dismiss-imported.handler.ts` (handler проверяет владельца и pending так же, как confirm, затем `markDismissed`):
```ts
export class DismissImportedCommand {
  constructor(
    public readonly userId: string,
    public readonly importedId: string,
  ) {}
}
```
```ts
import { ForbiddenException, Inject, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DismissImportedCommand } from './dismiss-imported.command';
import {
  IImportedTransactionRepository,
  IMPORTED_TRANSACTION_REPOSITORY,
} from '../../../domain/repositories/imported-transaction.repository.interface';

@CommandHandler(DismissImportedCommand)
export class DismissImportedHandler implements ICommandHandler<DismissImportedCommand> {
  constructor(
    @Inject(IMPORTED_TRANSACTION_REPOSITORY) private readonly importedRepo: IImportedTransactionRepository,
  ) {}

  async execute(command: DismissImportedCommand): Promise<{ success: boolean }> {
    const item = await this.importedRepo.findById(command.importedId);
    if (!item) throw new NotFoundException('Imported transaction not found');
    if (item.userId !== command.userId) throw new ForbiddenException();
    if (item.status !== 'pending') throw new ForbiddenException('Already processed');
    await this.importedRepo.markDismissed(item.id);
    return { success: true };
  }
}
```

`set-card-mapping.command.ts` / handler:
```ts
export class SetCardMappingCommand {
  constructor(
    public readonly userId: string,
    public readonly cardMask: string,
    public readonly accountId: string,
  ) {}
}
```
```ts
import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { SetCardMappingCommand } from './set-card-mapping.command';
import {
  CARD_MAPPING_REPOSITORY,
  ICardMappingRepository,
} from '../../../domain/repositories/card-mapping.repository.interface';

@CommandHandler(SetCardMappingCommand)
export class SetCardMappingHandler implements ICommandHandler<SetCardMappingCommand> {
  constructor(@Inject(CARD_MAPPING_REPOSITORY) private readonly cardRepo: ICardMappingRepository) {}

  async execute(command: SetCardMappingCommand): Promise<{ success: boolean }> {
    await this.cardRepo.upsert({
      userId: command.userId,
      cardMask: command.cardMask,
      accountId: command.accountId,
    });
    return { success: true };
  }
}
```

`delete-card-mapping.command.ts` / handler (аналогично, вызывает `cardRepo.delete(userId, cardMask)`).

`get-inbox.query.ts` / handler:
```ts
export class GetInboxQuery {
  constructor(public readonly userId: string) {}
}
```
```ts
import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetInboxQuery } from './get-inbox.query';
import {
  IImportedTransactionRepository,
  IMPORTED_TRANSACTION_REPOSITORY,
  InboxItem,
} from '../../../domain/repositories/imported-transaction.repository.interface';

function toResponse(item: InboxItem) {
  return {
    id: item.id,
    type: item.type,
    amount: item.amount,
    currency: item.currency,
    merchant: item.merchant,
    cardMask: item.cardMask,
    occurredAt: item.occurredAt?.toISOString() ?? null,
    balanceAfter: item.balanceAfter,
    status: item.status,
    transactionId: item.transactionId,
    suggestedAccountId: item.suggestedAccountId,
    createdAt: item.createdAt.toISOString(),
  };
}

@QueryHandler(GetInboxQuery)
export class GetInboxHandler implements IQueryHandler<GetInboxQuery> {
  constructor(
    @Inject(IMPORTED_TRANSACTION_REPOSITORY) private readonly importedRepo: IImportedTransactionRepository,
  ) {}

  async execute(query: GetInboxQuery) {
    const items = await this.importedRepo.findPendingWithSuggestions(query.userId);
    return { items: items.map(toResponse), count: items.length };
  }
}
```

`get-cards.query.ts` / handler:
```ts
export class GetCardsQuery {
  constructor(public readonly userId: string) {}
}
```
```ts
import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetCardsQuery } from './get-cards.query';
import {
  CARD_MAPPING_REPOSITORY,
  ICardMappingRepository,
} from '../../../domain/repositories/card-mapping.repository.interface';

@QueryHandler(GetCardsQuery)
export class GetCardsHandler implements IQueryHandler<GetCardsQuery> {
  constructor(@Inject(CARD_MAPPING_REPOSITORY) private readonly cardRepo: ICardMappingRepository) {}

  async execute(query: GetCardsQuery) {
    const cards = await this.cardRepo.listCards(query.userId);
    return {
      cards: cards.map((c) => ({
        cardMask: c.cardMask,
        accountId: c.accountId,
        lastSeenAt: c.lastSeenAt?.toISOString() ?? null,
      })),
    };
  }
}
```

`application/commands/index.ts` (паттерн проекта — реэкспорт + массив):
```ts
export * from './create-link-token/create-link-token.command';
export * from './create-link-token/create-link-token.handler';
export * from './link-telegram-account/link-telegram-account.command';
export * from './link-telegram-account/link-telegram-account.handler';
export * from './unlink-telegram/unlink-telegram.command';
export * from './unlink-telegram/unlink-telegram.handler';
export * from './ingest-bank-message/ingest-bank-message.command';
export * from './ingest-bank-message/ingest-bank-message.handler';
export * from './confirm-imported/confirm-imported.command';
export * from './confirm-imported/confirm-imported.handler';
export * from './dismiss-imported/dismiss-imported.command';
export * from './dismiss-imported/dismiss-imported.handler';
export * from './set-card-mapping/set-card-mapping.command';
export * from './set-card-mapping/set-card-mapping.handler';
export * from './delete-card-mapping/delete-card-mapping.command';
export * from './delete-card-mapping/delete-card-mapping.handler';

import { CreateLinkTokenHandler } from './create-link-token/create-link-token.handler';
import { LinkTelegramAccountHandler } from './link-telegram-account/link-telegram-account.handler';
import { UnlinkTelegramHandler } from './unlink-telegram/unlink-telegram.handler';
import { IngestBankMessageHandler } from './ingest-bank-message/ingest-bank-message.handler';
import { ConfirmImportedHandler } from './confirm-imported/confirm-imported.handler';
import { DismissImportedHandler } from './dismiss-imported/dismiss-imported.handler';
import { SetCardMappingHandler } from './set-card-mapping/set-card-mapping.handler';
import { DeleteCardMappingHandler } from './delete-card-mapping/delete-card-mapping.handler';

export const CommandHandlers = [
  CreateLinkTokenHandler,
  LinkTelegramAccountHandler,
  UnlinkTelegramHandler,
  IngestBankMessageHandler,
  ConfirmImportedHandler,
  DismissImportedHandler,
  SetCardMappingHandler,
  DeleteCardMappingHandler,
];
```

`application/queries/index.ts` — аналогично для `GetLinkStatusHandler`, `GetInboxHandler`, `GetCardsHandler` → `QueryHandlers`.

- [ ] **Step 4: DTO и контроллер**

`presentation/dto/confirm-imported.dto.ts`:
```ts
import { IsOptional, IsUUID } from 'class-validator';

export class ConfirmImportedDto {
  @IsUUID()
  transactionId: string;

  @IsUUID()
  accountId: string;

  @IsOptional()
  @IsUUID()
  toAccountId?: string;
}
```

`presentation/dto/set-card-mapping.dto.ts`:
```ts
import { IsUUID } from 'class-validator';

export class SetCardMappingDto {
  @IsUUID()
  accountId: string;
}
```

`presentation/controllers/telegram-import.controller.ts`:
```ts
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { CreateLinkTokenCommand } from '../../application/commands/create-link-token/create-link-token.command';
import { UnlinkTelegramCommand } from '../../application/commands/unlink-telegram/unlink-telegram.command';
import { ConfirmImportedCommand } from '../../application/commands/confirm-imported/confirm-imported.command';
import { DismissImportedCommand } from '../../application/commands/dismiss-imported/dismiss-imported.command';
import { SetCardMappingCommand } from '../../application/commands/set-card-mapping/set-card-mapping.command';
import { DeleteCardMappingCommand } from '../../application/commands/delete-card-mapping/delete-card-mapping.command';
import { GetLinkStatusQuery } from '../../application/queries/get-link-status/get-link-status.query';
import { GetInboxQuery } from '../../application/queries/get-inbox/get-inbox.query';
import { GetCardsQuery } from '../../application/queries/get-cards/get-cards.query';
import { ConfirmImportedDto } from '../dto/confirm-imported.dto';
import { SetCardMappingDto } from '../dto/set-card-mapping.dto';

@Controller('telegram-import')
export class TelegramImportController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post('link-token')
  async createLinkToken(@CurrentUser('sub') userId: string) {
    return this.commandBus.execute(new CreateLinkTokenCommand(userId));
  }

  @Get('link')
  async getLinkStatus(@CurrentUser('sub') userId: string) {
    return this.queryBus.execute(new GetLinkStatusQuery(userId));
  }

  @Delete('link')
  async unlink(@CurrentUser('sub') userId: string) {
    return this.commandBus.execute(new UnlinkTelegramCommand(userId));
  }

  @Get('inbox')
  async getInbox(@CurrentUser('sub') userId: string) {
    return this.queryBus.execute(new GetInboxQuery(userId));
  }

  @Post('inbox/:id/confirm')
  @HttpCode(HttpStatus.OK)
  async confirm(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: ConfirmImportedDto,
  ) {
    return this.commandBus.execute(
      new ConfirmImportedCommand(userId, id, dto.transactionId, dto.accountId, dto.toAccountId),
    );
  }

  @Post('inbox/:id/dismiss')
  @HttpCode(HttpStatus.OK)
  async dismiss(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.commandBus.execute(new DismissImportedCommand(userId, id));
  }

  @Get('cards')
  async getCards(@CurrentUser('sub') userId: string) {
    return this.queryBus.execute(new GetCardsQuery(userId));
  }

  @Put('cards/:cardMask')
  async setCardMapping(
    @CurrentUser('sub') userId: string,
    @Param('cardMask') cardMask: string,
    @Body() dto: SetCardMappingDto,
  ) {
    return this.commandBus.execute(new SetCardMappingCommand(userId, decodeURIComponent(cardMask), dto.accountId));
  }

  @Delete('cards/:cardMask')
  async deleteCardMapping(@CurrentUser('sub') userId: string, @Param('cardMask') cardMask: string) {
    return this.commandBus.execute(new DeleteCardMappingCommand(userId, decodeURIComponent(cardMask)));
  }
}
```

- [ ] **Step 5: Запустить тесты — PASS** (test-runner): `bun run test -- --testPathPattern=telegram-import`
Expected: парсер + link + ingest + confirm зелёные.

- [ ] **Step 6: Полная сборка + линт**

Run: `cd backend && bun run build && bun run lint`
Expected: успех.

- [ ] **Step 7: Commit (Tasks 4–7)**

```bash
git add backend/src/modules/telegram-import backend/src/app.module.ts backend/package.json backend/bun.lock
git commit -m "feat(telegram-import): grammY bot, webhook, linking, ingest, inbox API"
```

---

### Task 8: ENV + deploy.yml

**Files:**
- Modify: `backend/.env.example`
- Modify: `.github/workflows/deploy.yml`

- [ ] **Step 1: Добавить в `backend/.env.example`:**
```bash
# Telegram import (optional — отключено, если TELEGRAM_BOT_TOKEN пуст)
TELEGRAM_BOT_TOKEN=
TELEGRAM_BOT_USERNAME=
TELEGRAM_WEBHOOK_SECRET=
TELEGRAM_WEBHOOK_URL=
```

- [ ] **Step 2: deploy.yml** — добавить `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_WEBHOOK_URL` и в блок `env:`, и в whitelist `envs:` шага appleboy/ssh-action (известная gotcha: без `envs:` heredoc запишет пустые строки), и в генерацию `.env` на сервере по образцу существующих секретов (`LEMONSQUEEZY_*`). Также добавить эти переменные в `docker-compose.prod.yml` (секция environment backend-сервиса), если остальные секреты прокинуты там.

- [ ] **Step 3: Commit**

```bash
git add backend/.env.example .github/workflows/deploy.yml docker-compose.prod.yml
git commit -m "chore(telegram-import): env vars and deploy wiring"
```

---

### Task 9: Frontend entity `imported-transaction`

**Files:**
- Create: `frontend/src/entities/imported-transaction/model/types.ts`
- Create: `frontend/src/entities/imported-transaction/api/importedTransactionsApi.ts`
- Create: `frontend/src/entities/imported-transaction/api/queryKeys.ts`
- Create: `frontend/src/entities/imported-transaction/api/useImportedTransactions.ts`
- Create: `frontend/src/entities/imported-transaction/api/useTelegramLink.ts`
- Create: `frontend/src/entities/imported-transaction/api/useTelegramCards.ts`
- Create: `frontend/src/entities/imported-transaction/api/index.ts`
- Create: `frontend/src/entities/imported-transaction/index.ts`

- [ ] **Step 1: Типы (frontend snake_case, как принято)**

`model/types.ts`:
```ts
export type ImportedTransactionType = 'expense' | 'income' | 'balance_change';
export type ImportedTransactionStatus = 'pending' | 'confirmed' | 'dismissed';

export interface ImportedTransaction {
  id: string;
  type: ImportedTransactionType;
  amount: number | null; // для balance_change — подписанная дельта или null
  currency: string;
  merchant: string | null;
  card_mask: string;
  occurred_at: string; // ISO
  balance_after: number | null;
  status: ImportedTransactionStatus;
  transaction_id: string | null;
  suggested_account_id: string | null;
  created_at: string;
}

export interface TelegramLinkStatus {
  linked: boolean;
  telegram_username: string | null;
}

export interface TelegramCard {
  card_mask: string;
  account_id: string | null;
  last_seen_at: string | null;
}
```

- [ ] **Step 2: API**

`api/importedTransactionsApi.ts`:
```ts
import { http } from '@/shared/api/http';
import type { ImportedTransaction, TelegramCard, TelegramLinkStatus } from '../model/types';

interface ImportedTransactionResponse {
  id: string;
  type: ImportedTransaction['type'];
  amount: number | null;
  currency: string;
  merchant: string | null;
  cardMask: string;
  occurredAt: string;
  balanceAfter: number | null;
  status: ImportedTransaction['status'];
  transactionId: string | null;
  suggestedAccountId: string | null;
  createdAt: string;
}

function transformImported(item: ImportedTransactionResponse): ImportedTransaction {
  return {
    id: item.id,
    type: item.type,
    amount: item.amount === null ? null : Number(item.amount),
    currency: item.currency,
    merchant: item.merchant,
    card_mask: item.cardMask,
    occurred_at: item.occurredAt,
    balance_after: item.balanceAfter === null ? null : Number(item.balanceAfter),
    status: item.status,
    transaction_id: item.transactionId,
    suggested_account_id: item.suggestedAccountId,
    created_at: item.createdAt,
  };
}

export const importedTransactionsApi = {
  async getInbox(): Promise<{ items: ImportedTransaction[]; count: number }> {
    const data = await http.get<{ items: ImportedTransactionResponse[]; count: number }>(
      '/telegram-import/inbox',
    );
    return { items: data.items.map(transformImported), count: data.count };
  },

  async confirm(
    id: string,
    payload: { transactionId: string; accountId: string; toAccountId?: string },
  ): Promise<{ success: boolean; counterpartId: string | null }> {
    return http.post(`/telegram-import/inbox/${id}/confirm`, payload);
  },

  async dismiss(id: string): Promise<{ success: boolean }> {
    return http.post(`/telegram-import/inbox/${id}/dismiss`);
  },

  async getLinkStatus(): Promise<TelegramLinkStatus> {
    const data = await http.get<{ linked: boolean; telegramUsername: string | null }>('/telegram-import/link');
    return { linked: data.linked, telegram_username: data.telegramUsername };
  },

  async createLinkToken(): Promise<{ deepLink: string }> {
    return http.post<{ deepLink: string }>('/telegram-import/link-token');
  },

  async unlink(): Promise<{ success: boolean }> {
    return http.delete('/telegram-import/link');
  },

  async getCards(): Promise<TelegramCard[]> {
    const data = await http.get<{ cards: Array<{ cardMask: string; accountId: string | null; lastSeenAt: string | null }> }>(
      '/telegram-import/cards',
    );
    return data.cards.map((c) => ({ card_mask: c.cardMask, account_id: c.accountId, last_seen_at: c.lastSeenAt }));
  },

  async setCardAccount(cardMask: string, accountId: string): Promise<{ success: boolean }> {
    return http.put(`/telegram-import/cards/${encodeURIComponent(cardMask)}`, { accountId });
  },

  async deleteCardMapping(cardMask: string): Promise<{ success: boolean }> {
    return http.delete(`/telegram-import/cards/${encodeURIComponent(cardMask)}`);
  },
};
```

`api/queryKeys.ts`:
```ts
export const importedTransactionQueryKeys = {
  all: ['imported-transactions'] as const,
  inbox: (userId: string) => [...importedTransactionQueryKeys.all, 'inbox', userId] as const,
  link: (userId: string) => [...importedTransactionQueryKeys.all, 'link', userId] as const,
  cards: (userId: string) => [...importedTransactionQueryKeys.all, 'cards', userId] as const,
};
```

- [ ] **Step 3: Композаблы**

`api/useImportedTransactions.ts`:
```ts
import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { importedTransactionsApi } from './importedTransactionsApi';
import { importedTransactionQueryKeys } from './queryKeys';

export function useImportedTransactions(userId: MaybeRefOrGetter<string | null>) {
  const queryClient = useQueryClient();
  const enabled = computed(() => Boolean(toValue(userId)));
  const queryKey = computed(() => importedTransactionQueryKeys.inbox(toValue(userId) ?? ''));

  const inboxQuery = useQuery({
    queryKey,
    queryFn: () => importedTransactionsApi.getInbox(),
    enabled,
  });

  const items = computed(() => inboxQuery.data.value?.items ?? []);
  const pendingCount = computed(() => inboxQuery.data.value?.count ?? 0);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: importedTransactionQueryKeys.all });

  const confirmMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { transactionId: string; accountId: string; toAccountId?: string } }) =>
      importedTransactionsApi.confirm(id, payload),
    onSettled: invalidate,
  });

  const dismissMutation = useMutation({
    mutationFn: (id: string) => importedTransactionsApi.dismiss(id),
    onSettled: invalidate,
  });

  return {
    items,
    pendingCount,
    isLoading: inboxQuery.isLoading,
    error: inboxQuery.error,
    refetch: inboxQuery.refetch,
    confirmImported: (id: string, payload: { transactionId: string; accountId: string; toAccountId?: string }) =>
      confirmMutation.mutateAsync({ id, payload }),
    dismissImported: (id: string) => dismissMutation.mutateAsync(id),
    isConfirming: confirmMutation.isPending,
    isDismissing: dismissMutation.isPending,
  };
}
```

`api/useTelegramLink.ts`:
```ts
import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { importedTransactionsApi } from './importedTransactionsApi';
import { importedTransactionQueryKeys } from './queryKeys';

export function useTelegramLink(userId: MaybeRefOrGetter<string | null>) {
  const queryClient = useQueryClient();
  const enabled = computed(() => Boolean(toValue(userId)));

  const statusQuery = useQuery({
    queryKey: computed(() => importedTransactionQueryKeys.link(toValue(userId) ?? '')),
    queryFn: () => importedTransactionsApi.getLinkStatus(),
    enabled,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: importedTransactionQueryKeys.all });

  const createTokenMutation = useMutation({
    mutationFn: () => importedTransactionsApi.createLinkToken(),
  });

  const unlinkMutation = useMutation({
    mutationFn: () => importedTransactionsApi.unlink(),
    onSettled: invalidate,
  });

  return {
    status: computed(() => statusQuery.data.value ?? null),
    isLoading: statusQuery.isLoading,
    refetchStatus: statusQuery.refetch,
    createLinkToken: () => createTokenMutation.mutateAsync(),
    unlink: () => unlinkMutation.mutateAsync(),
    isUnlinking: unlinkMutation.isPending,
  };
}
```

`api/useTelegramCards.ts`:
```ts
import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { importedTransactionsApi } from './importedTransactionsApi';
import { importedTransactionQueryKeys } from './queryKeys';

export function useTelegramCards(userId: MaybeRefOrGetter<string | null>) {
  const queryClient = useQueryClient();
  const enabled = computed(() => Boolean(toValue(userId)));

  const cardsQuery = useQuery({
    queryKey: computed(() => importedTransactionQueryKeys.cards(toValue(userId) ?? '')),
    queryFn: () => importedTransactionsApi.getCards(),
    enabled,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: importedTransactionQueryKeys.all });

  const setMutation = useMutation({
    mutationFn: ({ cardMask, accountId }: { cardMask: string; accountId: string }) =>
      importedTransactionsApi.setCardAccount(cardMask, accountId),
    onSettled: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (cardMask: string) => importedTransactionsApi.deleteCardMapping(cardMask),
    onSettled: invalidate,
  });

  return {
    cards: computed(() => cardsQuery.data.value ?? []),
    isLoading: cardsQuery.isLoading,
    setCardAccount: (cardMask: string, accountId: string) => setMutation.mutateAsync({ cardMask, accountId }),
    deleteCardMapping: (cardMask: string) => deleteMutation.mutateAsync(cardMask),
  };
}
```

`api/index.ts` и `index.ts` — barrel-реэкспорты по образцу `entities/debt`.

- [ ] **Step 4: Сборка**

Run: `cd frontend && bun run build`
Expected: успех (type-check + Vite).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/entities/imported-transaction
git commit -m "feat(imported-transaction): entity api, query keys, composables"
```

---

### Task 10: Vitest-тест композабла useImportedTransactions

**Files:**
- Test: `frontend/src/entities/imported-transaction/api/useImportedTransactions.spec.ts`

- [ ] **Step 1: Написать тест (MSW-паттерн проекта, по образцу useSplitExpense.spec.ts)**

```ts
import { describe, it, expect, afterEach } from 'vitest';
import { defineComponent, h } from 'vue';
import { flushPromises } from '@vue/test-utils';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@/test/test-utils';
import { server } from '@/test/mocks/server';
import { useImportedTransactions } from './useImportedTransactions';

const INBOX_RESPONSE = {
  items: [
    {
      id: 'imp-1', type: 'expense', amount: 1700, currency: 'UZS',
      merchant: 'TRANSPORT TOLOV>TOS', cardMask: '*1951',
      occurredAt: '2026-06-12T17:11:00.000Z', balanceAfter: 12543101.08,
      status: 'pending', transactionId: null, suggestedAccountId: 'acc-1',
      createdAt: '2026-06-12T17:12:00.000Z',
    },
  ],
  count: 1,
};

let wrapper: ReturnType<typeof renderWithProviders> | null = null;

function mountComposable() {
  let result!: ReturnType<typeof useImportedTransactions>;
  const Stub = defineComponent({
    setup() {
      result = useImportedTransactions(() => 'user-1');
      return () => h('div');
    },
  });
  wrapper = renderWithProviders(Stub);
  return result;
}

afterEach(async () => {
  server.resetHandlers();
  wrapper?.unmount();
  await flushPromises();
});

describe('useImportedTransactions', () => {
  it('загружает инбокс и трансформирует в snake_case', async () => {
    server.use(http.get('*/api/telegram-import/inbox', () => HttpResponse.json(INBOX_RESPONSE)));
    const result = mountComposable();
    await flushPromises();
    expect(result.pendingCount.value).toBe(1);
    expect(result.items.value[0]).toMatchObject({
      id: 'imp-1',
      card_mask: '*1951',
      suggested_account_id: 'acc-1',
      occurred_at: '2026-06-12T17:11:00.000Z',
    });
  });

  it('confirm отправляет payload и инвалидирует инбокс', async () => {
    let confirmBody: unknown = null;
    server.use(
      http.get('*/api/telegram-import/inbox', () => HttpResponse.json(INBOX_RESPONSE)),
      http.post('*/api/telegram-import/inbox/imp-1/confirm', async ({ request }) => {
        confirmBody = await request.json();
        return HttpResponse.json({ success: true, counterpartId: null });
      }),
    );
    const result = mountComposable();
    await flushPromises();
    await result.confirmImported('imp-1', { transactionId: 'tx-9', accountId: 'acc-1' });
    expect(confirmBody).toEqual({ transactionId: 'tx-9', accountId: 'acc-1' });
  });
});
```

- [ ] **Step 2: Запустить — PASS** (test-runner): `cd frontend && bun run test -- --run useImportedTransactions`
(Если в проекте vitest запускается иначе — посмотри scripts в `frontend/package.json` и используй его команду.)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/entities/imported-transaction
git commit -m "test(imported-transaction): inbox composable tests"
```

---

### Task 11: Feature `link-telegram` (секция профиля + «Мои карты») — UI через frontend-design

**Files:**
- Create: `frontend/src/features/link-telegram/ui/TelegramSection.vue`
- Create: `frontend/src/features/link-telegram/ui/TelegramCardsList.vue`
- Create: `frontend/src/features/link-telegram/index.ts`
- Modify: `frontend/src/pages/profile/ProfilePage.vue` (вставить `<TelegramSection />` в `<main>` рядом с `NotificationSettings`)

**Требование: использовать skill frontend-design; только семантические токены.**

- [ ] **Step 1: TelegramSection.vue** — секция по паттерну профиля (`<section><h2>…</h2><UCard>…</UCard></section>`):
  - Не привязан: описание фичи (1–2 строки) + `UButton` «Подключить Telegram». Клик: `const { deepLink } = await createLinkToken(); window.open(deepLink, '_blank');` затем подсказка «Возвращайся после привязки» + кнопка «Проверить» (refetchStatus).
  - Привязан: строка «Подключён как @username» + `UIcon name="send"`, кнопка «Отвязать» (с `ConfirmDeleteModal`), и ниже — `<TelegramCardsList />`.
  - Использует `useTelegramLink(userId)` из entity, `useCurrentUser()`.

Референс-структура (frontend-design дорабатывает визуал):
```vue
<script setup lang="ts">
import { ref } from 'vue';
import { UButton, UCard, UIcon, ConfirmDeleteModal, useToast } from '@/shared/ui';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import { useTelegramLink } from '@/entities/imported-transaction';
import TelegramCardsList from './TelegramCardsList.vue';

const { userId } = useCurrentUser();
const { status, isLoading, createLinkToken, unlink, isUnlinking, refetchStatus } = useTelegramLink(userId);
const { toast } = useToast();
const showUnlinkConfirm = ref(false);
const waitingForLink = ref(false);

async function handleConnect() {
  const { deepLink } = await createLinkToken();
  waitingForLink.value = true;
  window.open(deepLink, '_blank');
}

async function handleCheck() {
  await refetchStatus();
  if (status.value?.linked) waitingForLink.value = false;
}

async function handleUnlink() {
  await unlink();
  showUnlinkConfirm.value = false;
  toast({ title: 'Telegram отвязан', variant: 'default' });
}
</script>
```

- [ ] **Step 2: TelegramCardsList.vue** — «Мои карты»: для каждой карты из `useTelegramCards(userId)` строка `💳 *1951` + текущий привязанный счёт; тап — раскрытие `AccountSelector` (accounts из `useAccounts(userId)`), `select` → `setCardAccount(card_mask, accountId)` + toast. Кнопка-иконка удаления маппинга. Пустое состояние: «Карты появятся после первого импортированного сообщения».

- [ ] **Step 3: Вставить секцию в ProfilePage** рядом с другими секциями (`NotificationSettings`).

- [ ] **Step 4: Проверка**: `cd frontend && bun run build` — успех. Визуально (если доступен dev-сервер): секция в профиле в обоих темах.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/link-telegram frontend/src/pages/profile
git commit -m "feat(link-telegram): profile section with telegram link and card mappings"
```

---

### Task 12: Роуты, инбокс-страница, баннер в Истории — UI через frontend-design

**Files:**
- Modify: `frontend/src/shared/config/routeNames.ts` (`IMPORT_INBOX: 'import-inbox'`, `IMPORT_CONFIRM: 'import-confirm'`)
- Modify: `frontend/src/app/router/index.ts` (два child-роута)
- Create: `frontend/src/pages/import-inbox/ImportInboxPage.vue`
- Create: `frontend/src/pages/import-inbox/ui/ImportInboxItem.vue`
- Modify: `frontend/src/pages/history/HistoryPage.vue` (баннер)

- [ ] **Step 1: Роуты**

```ts
{ path: 'import-inbox', name: ROUTE_NAMES.IMPORT_INBOX,
  component: () => import('@/pages/import-inbox/ImportInboxPage.vue') },
{ path: 'import-inbox/:id', name: ROUTE_NAMES.IMPORT_CONFIRM,
  component: () => import('@/pages/import-inbox/confirm/ImportConfirmPage.vue') },
```

- [ ] **Step 2: ImportInboxPage.vue** — `AppHeader title="На подтверждение"` + список `ImportInboxItem` (для каждого: иконка типа, сумма с валютой `formatCurrency`, мерчант, `💳 card_mask`, дата `formatRelativeDate`; для `balance_change` — бейдж «Изменение баланса» и сумма-дельта со знаком, или «Сумма неизвестна»). Тап по элементу → `router.push({ name: ROUTE_NAMES.IMPORT_CONFIRM, params: { id } })`. `EmptyState` (icon `inbox`): «Нет импортов на подтверждение» + описание про бота. Skeleton при загрузке. Данные: `useImportedTransactions(userId)`.

- [ ] **Step 3: Баннер в HistoryPage** — в `#master`, над контролами: если `pendingCount > 0`, кликабельная карточка-баннер (семантические токены, акцентный фон) «📥 На подтверждение: N» → переход на `IMPORT_INBOX`. Компонент инлайн в HistoryPage или маленький `ImportInboxBanner.vue` в `frontend/src/pages/import-inbox/ui/` (реэкспортить не нужно — прямой импорт страницы допустим между pages? нет: FSD запрещает page→page импорты. Размести баннер как `frontend/src/widgets/ImportInboxBanner/ImportInboxBanner.vue` + index.ts, импортируй в HistoryPage из widgets).

- [ ] **Step 4: Проверка + Commit**

Run: `cd frontend && bun run build` → успех.
```bash
git add frontend/src/pages/import-inbox frontend/src/widgets/ImportInboxBanner frontend/src/app/router frontend/src/shared/config/routeNames.ts frontend/src/pages/history
git commit -m "feat(import-inbox): inbox page, routes, history banner"
```

---

### Task 13: Флоу подтверждения (ImportConfirmPage) + интеграция scan-receipt — UI через frontend-design

**Files:**
- Create: `frontend/src/pages/import-inbox/confirm/ImportConfirmPage.vue`
- Modify: `frontend/src/pages/scan-receipt/ScanReceiptPage.vue` (+query `importedId`, `expectedAmount`)
- Modify: `frontend/src/features/scan-receipt/model/useSubmitStep.ts` (confirm после submit при `importedId`)

- [ ] **Step 1: ImportConfirmPage.vue**

Логика (референс, полная):
```vue
<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ROUTE_NAMES } from '@/shared/config/routeNames';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import { useToast } from '@/shared/ui';
import { useAccounts } from '@/entities/account';
import { useCategories } from '@/entities/category';
import { useImportedTransactions } from '@/entities/imported-transaction';
import { useTransactionForm } from '@/features/add-transaction/model/useTransactionForm';
import { useSubmitTransaction } from '@/features/add-transaction/model/useSubmitTransaction';
import { useSplitExpense } from '@/features/split-expense';
import TransactionForm from '@/features/add-transaction/ui/TransactionForm.vue';

const route = useRoute();
const router = useRouter();
const { userId } = useCurrentUser();
const { toast } = useToast();

const { items, isLoading, confirmImported, dismissImported } = useImportedTransactions(userId);
const { accounts } = useAccounts(userId);
const { expenseCategories, incomeCategories } = useCategories(userId);

const importedId = computed(() => route.params.id as string);
const item = computed(() => items.value.find((i) => i.id === importedId.value) ?? null);

const { formData, isValid, updateField, setType, resetForm } = useTransactionForm();
const { submitAndWait, rollbackTransaction, isSubmitting } = useSubmitTransaction();
const split = useSplitExpense(() => formData.value.amount);

// Предзаполнение из импортированной записи
watch(
  item,
  (it) => {
    if (!it) return;
    resetForm();
    const isNegativeDelta = it.type === 'balance_change' && (it.amount ?? 0) < 0;
    const formType = it.type === 'income' || (it.type === 'balance_change' && !isNegativeDelta) ? 'income' : 'expense';
    setType(formType);
    updateField('amount', Math.abs(it.amount ?? 0));
    updateField('currency', it.currency);
    updateField('date', new Date(it.occurred_at).getTime());
    updateField('description', it.merchant ?? '');
    if (it.suggested_account_id) updateField('accountId', it.suggested_account_id);
  },
  { immediate: true },
);

function goNextOrBack() {
  const next = items.value.find((i) => i.id !== importedId.value);
  if (next) {
    void router.replace({ name: ROUTE_NAMES.IMPORT_CONFIRM, params: { id: next.id } });
  } else {
    void router.replace({ name: ROUTE_NAMES.IMPORT_INBOX });
  }
}

async function handleSubmit() {
  if (!item.value || !formData.value.accountId || !userId.value) return;
  const transactionId = await submitAndWait(userId.value, formData.value);
  if (!transactionId) return; // ошибка уже показана toast'ом в useSubmitTransaction

  if (split.splitData.value.enabled) {
    const ok = await split.createDebtsForSplit(
      transactionId, userId.value, formData.value.accountId,
      formData.value.currency, formData.value.date,
    );
    if (!ok) {
      await rollbackTransaction(transactionId, userId.value);
      return;
    }
  }

  try {
    await confirmImported(item.value.id, {
      transactionId,
      accountId: formData.value.accountId,
      toAccountId: formData.value.type === 'transfer' ? (formData.value.toAccountId ?? undefined) : undefined,
    });
  } catch {
    toast({ title: 'Не удалось отметить импорт подтверждённым', variant: 'error' });
    return;
  }
  split.reset();
  goNextOrBack();
}

async function handleDismiss() {
  if (!item.value) return;
  await dismissImported(item.value.id);
  goNextOrBack();
}

function toScanReceipt() {
  if (!item.value) return;
  void router.push({
    name: ROUTE_NAMES.SCAN_RECEIPT,
    query: { importedId: item.value.id, expectedAmount: String(Math.abs(item.value.amount ?? 0)) },
  });
}
</script>
```

Шаблон: контекст-карточка импорта сверху (источник: «Из Telegram · 💳 *1951 · дата», мерчант, для balance_change — пояснение «Баланс изменился на N» / «Укажи сумму вручную»), затем `<TransactionForm v-model:form-data="formData" :accounts="accounts" :expense-categories="expenseCategories" :income-categories="incomeCategories" :is-valid="isValid" :is-submitting="isSubmitting" :split-data="split.splitData.value" … @submit="handleSubmit">` (split-эмиты проксируются в `split.*` как в AddTransactionPage — скопируй обвязку оттуда), кнопка «Сканировать чек» (`toScanReceipt`), кнопка «Отклонить» (ghost/danger, с подтверждением `ConfirmDeleteModal`). `NotFoundState`, если `item` null после загрузки. BottomNav на этом роуте скрывать не нужно (но если страница в стиле add-transaction полноэкранная — реши по образцу `transactions/new`).

Заметка: вкладка «долг» уже есть внутри `TransactionForm` (type `debt`) — отдельной обвязки не требуется; «вся сумма как долг» закрывается этим табом (обвязка `@debt-submitted` — по образцу AddTransactionPage: в обработчике вызывай `confirmImported` с создавшейся транзакцией, если таб долга сам создаёт транзакцию; посмотри реализацию `DebtPanel` при выполнении и сделай консистентно).

- [ ] **Step 2: Интеграция scan-receipt**

В `ScanReceiptPage.vue`: прочитать `route.query.importedId` / `expectedAmount`, передать в `useSubmitStep` (через параметр инициализации или props к Step4Summary). В `useSubmitStep.handleSubmit` после успешного создания транзакции:
```ts
if (importedId) {
  await importedTransactionsApi.confirm(importedId, {
    transactionId: createdTransactionId,
    accountId: formData.accountId!,
  });
  queryClient.invalidateQueries({ queryKey: importedTransactionQueryKeys.all });
}
```
В Step4Summary (или TotalFooter) — если `expectedAmount` задан и не совпадает с итогом чека (±1%), показать предупреждение «Сумма чека (X) отличается от импортированной (Y)» — не блокирующее. После успеха — навигация назад в инбокс (`IMPORT_INBOX`), а не на дашборд, когда `importedId` задан.

- [ ] **Step 3: Проверка**

Run: `cd frontend && bun run build` → успех.
Прогнать vitest scan-receipt (test-runner): `bun run test -- --run useReceiptWizard` — не сломали существующее.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/import-inbox frontend/src/pages/scan-receipt frontend/src/features/scan-receipt
git commit -m "feat(import-confirm): full confirmation flow with split, debt, transfer and receipt scan"
```

---

### Task 14: Changelog + финальная верификация

**Files:**
- Modify: `frontend/src/features/changelog/model/changelogData.ts`

- [ ] **Step 1: Changelog** — поднять `CURRENT_VERSION` на patch (например `1.0.55` → `1.0.56`; проверь актуальную) и добавить запись В НАЧАЛО `CHANGELOG_ENTRIES`:
```ts
{
  version: '1.0.56',
  date: '<сегодняшняя дата>',
  title: 'Импорт банковских уведомлений из Telegram',
  items: [
    { type: 'feature', text: 'Подключи Telegram-бота в профиле и пересылай ему уведомления банка — они превратятся в транзакции.' },
    { type: 'feature', text: 'Новый раздел «На подтверждение»: укажи счёт и категорию, раздели расход с друзьями, отметь перевод между картами или прикрепи чек.' },
    { type: 'feature', text: 'Карты можно привязать к счетам — счёт будет подставляться автоматически.' },
  ],
}
```

- [ ] **Step 2: Полная верификация**

- `cd backend && bun run build && bun run lint` → успех
- backend-тесты через test-runner: `bun run test` → все зелёные
- `cd frontend && bun run build` → успех
- frontend-тесты через test-runner → все зелёные

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/changelog
git commit -m "feat(changelog): v1.0.56 — telegram bank import"
```

---

## Self-Review навигатор (для исполнителя)

- Спека §2 (форматы/парсинг) → Task 2. §2.5 (дедуп) → Task 2 + 6. §3.1 (webhook) → Task 4. §3.2 (линковка) → Task 5. §3.3 (ingest+сводка) → Task 4 (агрегатор) + 6. §3.4 (инбокс/confirm) → Task 7. §3.4.1 (карты) → Task 7 + 9 + 11. §3.4.2 (переводы) → Task 7 (counterpart) + 13 (UI). §3.5 (данные) → Task 1. §3.6 (env/deploy) → Task 8. §4 (frontend) → Task 9–13. §4.4 (changelog) → Task 14. §7 (тесты) → Task 2, 5, 6, 7, 10.
- Деплой: после мержа выполнить `bun run migration:run` (CI делает условно), создать бота в BotFather, заполнить 4 env-переменные в GitHub Secrets.
