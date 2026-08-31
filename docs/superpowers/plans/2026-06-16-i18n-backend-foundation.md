# i18n Backend Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `language` field to the user profile and integrate `nestjs-i18n` so the backend serves localized default categories, demo data, push notifications, and Telegram messages in the user's language.

**Architecture:** `language` (`'ru' | 'en'`) is added to the Profile aggregate following the existing per-field pattern (props → private field → getter → create/update/reconstitute → ORM column → mapper → DTO → migration). `nestjs-i18n` is registered globally with JSON dictionaries under `backend/src/i18n/{ru,en}/`. A custom resolver reads the language from the authenticated profile (HTTP scope), falls back to `Accept-Language`, then `'ru'`. Background jobs (push/recurring) and the Telegram bot translate by passing `lang` explicitly from the profile. Default categories are created in the user's language by threading `language` into `InitializeDefaultCategoriesCommand`.

**Tech Stack:** NestJS 11, TypeORM, `nestjs-i18n`, Jest. API error localization is explicitly out of scope (deferred per spec).

**Spec:** `docs/superpowers/specs/2026-06-16-i18n-english-language-design.md` (Sections 2 & 3).

---

## File Structure

**Create:**
- `backend/src/i18n/ru/categories.json` — category id → Russian name
- `backend/src/i18n/en/categories.json` — category id → English name
- `backend/src/i18n/ru/demo.json` — demo accounts, transaction descriptions, contacts, debts (RU)
- `backend/src/i18n/en/demo.json` — same keys (EN)
- `backend/src/i18n/ru/notifications.json` — push title/body templates (RU)
- `backend/src/i18n/en/notifications.json` — same keys (EN)
- `backend/src/i18n/ru/telegram.json` — bot messages (RU)
- `backend/src/i18n/en/telegram.json` — same keys (EN)
- `backend/src/modules/identity/infrastructure/i18n/profile-language.resolver.ts` — custom nestjs-i18n resolver
- `backend/src/database/migrations/<TS>-AddLanguageToProfiles.ts` — ALTER TABLE migration

**Modify:**
- `backend/src/modules/identity/domain/entities/profile.entity.ts` — props, field, getter, create/update/reconstitute
- `backend/src/modules/identity/infrastructure/persistence/typeorm/profile.orm-entity.ts` — `@Column` for `language`
- `backend/src/modules/identity/infrastructure/persistence/mappers/profile.mapper.ts` — map `language` both ways
- `backend/src/modules/identity/application/types/index.ts` — `ProfileResponse.language`
- `backend/src/modules/identity/application/queries/get-profile/get-profile.handler.ts` — include `language` in `toResponse`
- `backend/src/modules/identity/application/commands/update-profile/update-profile.handler.ts` — include `language` in `toResponse`
- `backend/src/modules/identity/presentation/dto/update-profile.dto.ts` — `language?` with `@IsIn(['ru','en'])`
- `backend/src/modules/identity/application/commands/register/register.command.ts` + `register.handler.ts` — accept optional `language`
- `backend/src/modules/identity/presentation/dto/register.dto.ts` — `language?` field (find exact path during Task)
- `backend/src/modules/accounting/application/commands/initialize-default-categories/initialize-default-categories.command.ts` — add `language`
- `backend/src/modules/accounting/application/commands/initialize-default-categories/initialize-default-categories.handler.ts` — translate names by `language`
- `backend/src/modules/accounting/presentation/controllers/categories.controller.ts` — pass user's `language` into the command
- `backend/src/app.module.ts` — register `I18nModule.forRootAsync`
- `backend/src/config/data-source.ts` — (no entity change; `language` is a column on existing `ProfileOrmEntity`, no new entity to register)

---

## Task 1: Add `language` to Profile domain entity

**Files:**
- Modify: `backend/src/modules/identity/domain/entities/profile.entity.ts`
- Test: `backend/src/modules/identity/domain/entities/profile.entity.spec.ts`

- [ ] **Step 1: Read the entity to confirm current line anchors**

Run: open `backend/src/modules/identity/domain/entities/profile.entity.ts`. Confirm `ProfileProps` interface, the private fields block, the getters block, `createRegistered`, `createDemo`, `reconstitute`, and `updateProfile` exist (per recon: props ~24-42, fields ~49-64, ctor ~66-84, createRegistered ~89-119, createDemo ~126-150, reconstitute ~155-157, getters ~160-226, updateProfile ~236-303). Line numbers may have drifted — match by code, not line.

- [ ] **Step 2: Write the failing test**

Add to `profile.entity.spec.ts` (follow the existing `createProfile()`/`reconstitute` helper pattern in that file):

```typescript
describe('language', () => {
  it('defaults to "ru" for a registered profile when not provided', () => {
    const profile = Profile.createRegistered(
      'user-1',
      Email.create('u@test.com'),
      'John',
      'hashed',
    );
    expect(profile.language).toBe('ru');
  });

  it('uses the provided language on registration', () => {
    const profile = Profile.createRegistered(
      'user-1',
      Email.create('u@test.com'),
      'John',
      'hashed',
      'USD', // currency (existing 5th positional arg — verify signature in Step 1)
      'en',
    );
    expect(profile.language).toBe('en');
  });

  it('updates language via updateProfile', () => {
    const profile = Profile.createRegistered('user-1', Email.create('u@test.com'), 'John', 'hashed');
    profile.updateProfile({ language: 'en' });
    expect(profile.language).toBe('en');
  });
});
```

> NOTE: verify the exact positional signature of `createRegistered` in Step 1. If `currency` is not the 5th param, adjust the second test to match. The point is: an optional `language` param defaulting to `'ru'`.

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd backend && bun run test -- --testPathPattern=profile.entity.spec`
Expected: FAIL — `profile.language` is undefined / `language` not a known property.

- [ ] **Step 4: Implement the field**

In `ProfileProps` interface add:
```typescript
language: string;
```

In the private fields block add:
```typescript
private _language: string;
```

In the constructor (where other props are assigned) add:
```typescript
this._language = props.language;
```

In `createRegistered` — add an optional param defaulting to `'ru'` and pass it into the props object. Example (align positions with the real signature found in Step 1):
```typescript
static createRegistered(
  id: string,
  email: Email,
  name: string | null,
  passwordHash: string,
  currency: string = 'RUB',
  language: string = 'ru',
): Profile {
  // ...existing props object...
  // add:  language,
}
```

In `createDemo` add to the props object:
```typescript
language: 'ru',
```

Add a getter near the other getters:
```typescript
get language(): string {
  return this._language;
}
```

In `updateProfile(data: {...})` add `language?: string` to the data type, and in the body (following the existing `if (data.x !== undefined)` pattern):
```typescript
if (data.language !== undefined) {
  this._language = data.language;
  changes.language = data.language;
}
```

`reconstitute` already spreads/uses `ProfileProps`, so no change beyond the props interface — confirm.

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd backend && bun run test -- --testPathPattern=profile.entity.spec`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd backend && git add src/modules/identity/domain/entities/profile.entity.ts src/modules/identity/domain/entities/profile.entity.spec.ts
git commit -m "feat(identity): add language field to Profile entity"
```

---

## Task 2: Persist `language` (ORM entity + mapper + migration)

**Files:**
- Modify: `backend/src/modules/identity/infrastructure/persistence/typeorm/profile.orm-entity.ts`
- Modify: `backend/src/modules/identity/infrastructure/persistence/mappers/profile.mapper.ts`
- Create: `backend/src/database/migrations/<TS>-AddLanguageToProfiles.ts`

- [ ] **Step 1: Add the ORM column**

In `profile.orm-entity.ts`, following the `currency` column pattern (`@Column({ default: 'RUB' })`), add:
```typescript
@Column({ type: 'varchar', length: 2, default: 'ru' })
language: string;
```

- [ ] **Step 2: Map the field both ways**

In `profile.mapper.ts`:
- In `toDomain(...)` add to the props object passed to `Profile.reconstitute`:
```typescript
language: ormEntity.language,
```
- In `toOrm(...)` add:
```typescript
ormEntity.language = domainEntity.language;
```

- [ ] **Step 3: Generate the migration**

Run: `cd backend && bun run migration:generate src/database/migrations/AddLanguageToProfiles`
Expected: a new migration file containing `ADD "language"`. If generation produces extra/unrelated diffs, discard it and instead hand-write the file (Step 4).

- [ ] **Step 4: Ensure the migration matches the hand-written pattern**

The migration file must contain exactly (matching the `AddFinancialMonthStartDay` style):
```typescript
import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddLanguageToProfiles<TS> implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "profiles" ADD "language" character varying(2) NOT NULL DEFAULT 'ru'`,
    );
    await queryRunner.query(
      `ALTER TABLE "profiles" ADD CONSTRAINT "chk_profile_language" CHECK ("language" IN ('ru', 'en'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "profiles" DROP CONSTRAINT "chk_profile_language"`);
    await queryRunner.query(`ALTER TABLE "profiles" DROP COLUMN "language"`);
  }
}
```
(`<TS>` is the generator-provided timestamp suffix on the class name.)

- [ ] **Step 5: Run the migration against local DB**

Run: `cd backend && docker compose up -d postgres && bun run migration:run`
Expected: migration applies, log shows `AddLanguageToProfiles` executed.

- [ ] **Step 6: Verify build + type-check**

Run: `cd backend && bun run build`
Expected: success, no TS errors.

- [ ] **Step 7: Commit**

```bash
cd backend && git add src/modules/identity/infrastructure/persistence/typeorm/profile.orm-entity.ts src/modules/identity/infrastructure/persistence/mappers/profile.mapper.ts src/database/migrations/
git commit -m "feat(identity): persist profile language column + migration"
```

---

## Task 3: Expose `language` in API (ProfileResponse + handlers + DTO)

**Files:**
- Modify: `backend/src/modules/identity/application/types/index.ts`
- Modify: `backend/src/modules/identity/application/queries/get-profile/get-profile.handler.ts`
- Modify: `backend/src/modules/identity/application/commands/update-profile/update-profile.handler.ts`
- Modify: `backend/src/modules/identity/presentation/dto/update-profile.dto.ts`
- Test: `backend/src/modules/identity/application/commands/update-profile/update-profile.handler.spec.ts`

- [ ] **Step 1: Write the failing test**

In `update-profile.handler.spec.ts`, extend the existing `createProfile()` helper to include `language: 'ru'` in the `reconstitute` props (the test module already mocks `PROFILE_REPOSITORY` and `DomainEventPublisher`). Add:

```typescript
it('updates language and returns it in the response', async () => {
  const profile = createProfile();
  mockRepository.findById.mockResolvedValue(profile);
  mockRepository.save.mockImplementation((p) => Promise.resolve(p));
  mockEventPublisher.publishEvents.mockResolvedValue(undefined);

  const command = new UpdateProfileCommand('user-1', { language: 'en' });
  const result = await handler.execute(command);

  expect(result.language).toBe('en');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && bun run test -- --testPathPattern=update-profile.handler.spec`
Expected: FAIL — `result.language` is undefined (not in `ProfileResponse` / `toResponse`).

- [ ] **Step 3: Add `language` to ProfileResponse**

In `application/types/index.ts`, in the `ProfileResponse` interface, add after `currency`:
```typescript
language: string;
```

- [ ] **Step 4: Include `language` in both `toResponse` methods**

In `get-profile.handler.ts` and `update-profile.handler.ts`, in the `toResponse(profile)` object, add after `currency: profile.currency,`:
```typescript
language: profile.language,
```

- [ ] **Step 5: Add validation to UpdateProfileDto**

In `update-profile.dto.ts`, add the import `IsIn` from `class-validator` if missing, then add the field (mirroring the `currency` field but constrained):
```typescript
@IsOptional()
@IsIn(['ru', 'en'])
language?: string;
```

Confirm `UpdateProfileCommand.data` type permits `language` — it is typed from the DTO or as a `Partial`; if it has an explicit field list, add `language?: string` there too.

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd backend && bun run test -- --testPathPattern=update-profile.handler.spec`
Expected: PASS.

- [ ] **Step 7: Verify build**

Run: `cd backend && bun run build`
Expected: success.

- [ ] **Step 8: Commit**

```bash
cd backend && git add src/modules/identity/application src/modules/identity/presentation/dto/update-profile.dto.ts
git commit -m "feat(identity): expose and validate profile language in API"
```

---

## Task 4: Accept `language` on registration

**Files:**
- Modify: `backend/src/modules/identity/application/commands/register/register.command.ts`
- Modify: `backend/src/modules/identity/application/commands/register/register.handler.ts`
- Modify: register DTO (find: `backend/src/modules/identity/presentation/dto/register.dto.ts` or the auth controller's DTO)
- Test: `backend/src/modules/identity/application/commands/register/register.handler.spec.ts` (create test block if file exists; if not, add a focused spec)

- [ ] **Step 1: Locate the register DTO and controller**

Run: `cd backend && grep -rl "class RegisterDto\|RegisterCommand(" src/modules/identity`
Confirm the DTO file and where `new RegisterCommand(...)` is constructed (controller).

- [ ] **Step 2: Write the failing test**

In `register.handler.spec.ts` add (mirror existing register test setup — it mocks `PROFILE_REPOSITORY`, token service, event publisher):
```typescript
it('passes language to the created profile', async () => {
  // arrange existing mocks so save echoes the profile
  mockRepository.save.mockImplementation((p) => Promise.resolve(p));
  const command = new RegisterCommand('e@test.com', 'password123', 'Jane', 'en');
  await handler.execute(command);
  const savedProfile = mockRepository.save.mock.calls[0][0];
  expect(savedProfile.language).toBe('en');
});
```
(Align positional args with the real `RegisterCommand` constructor found in Step 1.)

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd backend && bun run test -- --testPathPattern=register.handler.spec`
Expected: FAIL — `RegisterCommand` has no `language` arg / not passed to `createRegistered`.

- [ ] **Step 4: Thread `language` through**

In `register.command.ts`, add a constructor param:
```typescript
constructor(
  public readonly email: string,
  public readonly password: string,
  public readonly name: string | null,
  public readonly language: string = 'ru',
) {}
```

In `register.handler.ts`, pass it into `Profile.createRegistered(...)` as the `language` argument (after `currency` — match the signature from Task 1).

In the register DTO, add:
```typescript
@IsOptional()
@IsIn(['ru', 'en'])
language?: string;
```
and in the controller where `new RegisterCommand(...)` is built, pass `dto.language` (the handler default covers `undefined`).

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd backend && bun run test -- --testPathPattern=register.handler.spec`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd backend && git add src/modules/identity
git commit -m "feat(identity): accept language on registration"
```

---

## Task 5: Install and register nestjs-i18n with dictionaries

**Files:**
- Modify: `backend/package.json` (dependency)
- Create: `backend/src/i18n/{ru,en}/categories.json`, `demo.json`, `notifications.json`, `telegram.json`
- Create: `backend/src/modules/identity/infrastructure/i18n/profile-language.resolver.ts`
- Modify: `backend/src/app.module.ts`

- [ ] **Step 1: Install nestjs-i18n**

Run: `cd backend && bun add nestjs-i18n`
Expected: added to `dependencies`.

- [ ] **Step 2: Create category dictionaries**

`backend/src/i18n/ru/categories.json` — keys are category ids from `default-categories.ts`:
```json
{
  "groceries": "Продукты",
  "transport": "Транспорт",
  "health": "Здоровье",
  "housing": "Жилье",
  "cafe": "Кафе",
  "entertainment": "Досуг",
  "gifts": "Подарки",
  "education": "Образование",
  "family": "Семья",
  "sport": "Спорт",
  "travel": "Путешествия",
  "other_expense": "Другое",
  "salary": "Зарплата",
  "freelance": "Фриланс",
  "investments": "Инвестиции",
  "gifts_income": "Подарки",
  "cashback": "Кэшбек",
  "other_income": "Другое",
  "debt_given": "Дал в долг",
  "debt_taken": "Взял в долг",
  "debt_return_to_me": "Возврат долга (мне)",
  "debt_return_from_me": "Возврат долга (от меня)",
  "transfer": "Перевод",
  "balance_adjustment": "Коррекция баланса"
}
```

`backend/src/i18n/en/categories.json`:
```json
{
  "groceries": "Groceries",
  "transport": "Transport",
  "health": "Health",
  "housing": "Housing",
  "cafe": "Dining out",
  "entertainment": "Entertainment",
  "gifts": "Gifts",
  "education": "Education",
  "family": "Family",
  "sport": "Sport",
  "travel": "Travel",
  "other_expense": "Other",
  "salary": "Salary",
  "freelance": "Freelance",
  "investments": "Investments",
  "gifts_income": "Gifts",
  "cashback": "Cashback",
  "other_income": "Other",
  "debt_given": "Lent",
  "debt_taken": "Borrowed",
  "debt_return_to_me": "Repayment (to me)",
  "debt_return_from_me": "Repayment (from me)",
  "transfer": "Transfer",
  "balance_adjustment": "Balance adjustment"
}
```

- [ ] **Step 3: Create remaining dictionaries (keep keys aligned ru/en)**

Create `demo.json`, `notifications.json`, `telegram.json` in both `ru/` and `en/`. Source the RU strings verbatim from:
- demo: `identity/application/services/demo-initialization.service.ts` (account names «Основной»/«Накопительный», transaction descriptions, contact names, debt descriptions)
- notifications: `recurring-subscription` handlers (`process-notifications`, `process-auto-charges`) + `notification/.../push-subscription.controller.ts` test notification
- telegram: `telegram-import/.../telegram-bot.service.ts`

Use ICU/interpolation placeholders matching nestjs-i18n (`{amount}`, `{currency}`, `{accountName}`, `{count}`). Example `notifications.json` (RU):
```json
{
  "test": { "title": "Тестовое уведомление", "body": "Push-уведомления работают!" },
  "subscriptionUpcoming": { "body": "Списание {amount} {currency} {when}" },
  "subscriptionCharged": { "body": "Списано {amount} {currency} · {accountName}" },
  "subscriptionFailed": { "body": "Не удалось списать {amount} {currency}. {reason}." }
}
```
EN mirror with same keys/placeholders.

> Wiring these dictionaries into the actual push/telegram call sites is Task 7. This step only creates the files.

- [ ] **Step 4: Create the profile-language resolver**

`backend/src/modules/identity/infrastructure/i18n/profile-language.resolver.ts` — a `nestjs-i18n` `I18nResolver` that reads `request.user?.language` (the JWT-populated user) and returns it; return `undefined` to let the next resolver run.
```typescript
import { Injectable } from '@nestjs/common';
import { I18nResolver } from 'nestjs-i18n';
import { ExecutionContext } from '@nestjs/common';

@Injectable()
export class ProfileLanguageResolver implements I18nResolver {
  resolve(context: ExecutionContext): string | undefined {
    const req = context.switchToHttp().getRequest();
    return req?.user?.language;
  }
}
```

- [ ] **Step 5: Register I18nModule**

In `app.module.ts`, add to `imports` (after `TypeOrmModule.forRootAsync`, before the DDD modules), following nestjs-i18n's `forRootAsync` shape:
```typescript
I18nModule.forRoot({
  fallbackLanguage: 'ru',
  loaderOptions: {
    path: join(__dirname, '/i18n/'),
    watch: true,
  },
  resolvers: [
    ProfileLanguageResolver,
    new AcceptLanguageResolver(),
  ],
}),
```
Add imports: `I18nModule, AcceptLanguageResolver` from `nestjs-i18n`, `join` from `path`, and `ProfileLanguageResolver`. Ensure `i18n/**/*.json` is copied to `dist` on build — confirm `nest-cli.json` `compilerOptions.assets` includes `"i18n/**/*"` (add if missing).

- [ ] **Step 6: Verify build**

Run: `cd backend && bun run build`
Expected: success; `dist/i18n/` contains the JSON files.

- [ ] **Step 7: Commit**

```bash
cd backend && git add package.json src/i18n src/modules/identity/infrastructure/i18n src/app.module.ts nest-cli.json
git commit -m "feat(i18n): install nestjs-i18n, add dictionaries and profile resolver"
```

---

## Task 6: Localize default categories on initialization

**Files:**
- Modify: `backend/src/modules/accounting/application/commands/initialize-default-categories/initialize-default-categories.command.ts`
- Modify: `backend/src/modules/accounting/application/commands/initialize-default-categories/initialize-default-categories.handler.ts`
- Modify: `backend/src/modules/accounting/presentation/controllers/categories.controller.ts`
- Test: `backend/src/modules/accounting/application/commands/initialize-default-categories/initialize-default-categories.handler.spec.ts` (create if absent)

- [ ] **Step 1: Write the failing test**

Create/extend the handler spec. Mock `categoryRepository` (`findByUserId` → `[]`, `saveMany` → echo) and `I18nService` (`translate` → returns `'EN:' + key`):
```typescript
it('creates categories with names translated to the given language', async () => {
  mockCategoryRepository.findByUserId.mockResolvedValue([]);
  mockCategoryRepository.saveMany.mockImplementation((cats) => Promise.resolve(cats));
  mockI18n.translate.mockImplementation((key: string) => `EN:${key}`);

  const command = new InitializeDefaultCategoriesCommand('user-1', 'en');
  await handler.execute(command);

  const created = mockCategoryRepository.saveMany.mock.calls[0][0];
  // groceries is the first expense category
  expect(created[0].name).toBe('EN:categories.groceries');
  expect(mockI18n.translate).toHaveBeenCalledWith('categories.groceries', { lang: 'en' });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && bun run test -- --testPathPattern=initialize-default-categories.handler.spec`
Expected: FAIL — command has no `language`; handler uses `cat.name` directly.

- [ ] **Step 3: Add `language` to the command**

In `initialize-default-categories.command.ts`:
```typescript
export class InitializeDefaultCategoriesCommand {
  constructor(
    public readonly userId: string,
    public readonly language: string = 'ru',
  ) {}
}
```

- [ ] **Step 4: Translate names in the handler**

In the handler, inject `I18nService` (constructor: `private readonly i18n: I18nService`). Replace `cat.name` in the `Category.create(...)` mapping with a translation by category id:
```typescript
const name = this.i18n.translate(`categories.${cat.id}`, { lang: command.language });
// Category.create(crypto.randomUUID(), command.userId, name, cat.icon, cat.color, cat.type, index)
```
Keep `cat.name` as the fallback string baked into the dictionaries (RU dictionary holds the same values).

- [ ] **Step 5: Pass language from the controller**

In `categories.controller.ts` `initializeDefaults()`, read the authenticated user's language and pass it:
```typescript
return this.commandBus.execute(
  new InitializeDefaultCategoriesCommand(userId, req.user?.language ?? 'ru'),
);
```
(Use the same mechanism the controller already uses to get `userId` from the request/JWT.)

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd backend && bun run test -- --testPathPattern=initialize-default-categories.handler.spec`
Expected: PASS.

- [ ] **Step 7: Verify build + full identity/accounting tests**

Run: `cd backend && bun run build && bun run test -- --testPathPattern="identity|accounting"`
Expected: build success; tests pass.

- [ ] **Step 8: Commit**

```bash
cd backend && git add src/modules/accounting
git commit -m "feat(accounting): create default categories in user's language"
```

---

## Task 7: Localize push notifications and Telegram bot messages

**Files:**
- Modify: `backend/src/modules/recurring-subscription/application/commands/process-notifications/process-notifications.handler.ts`
- Modify: `backend/src/modules/recurring-subscription/application/commands/process-auto-charges/process-auto-charges.handler.ts`
- Modify: `backend/src/modules/notification/presentation/controllers/push-subscription.controller.ts`
- Modify: `backend/src/modules/telegram-import/infrastructure/telegram/telegram-bot.service.ts`
- Test: relevant existing `*.handler.spec.ts` for the recurring-subscription handlers

- [ ] **Step 1: Confirm where the user's language is available in each call site**

Run: `cd backend && grep -n "profile\|language\|userId" src/modules/recurring-subscription/application/commands/process-notifications/process-notifications.handler.ts`
For background handlers, the profile is loaded (or loadable) per subscription's user. Confirm the handler has access to the profile or load it via the profile repository. The language source for background jobs is `profile.language` (no HTTP scope).

- [ ] **Step 2: Write a failing test (process-notifications)**

In the existing handler spec, mock `I18nService.translate` and assert the push body is built via `i18n.translate('notifications.subscriptionUpcoming.body', { lang, args })`:
```typescript
it('builds the upcoming notification body in the user language', async () => {
  mockI18n.translate.mockReturnValue('charged soon');
  // ...arrange one due subscription with a profile whose language is 'en'...
  await handler.execute(command);
  expect(mockI18n.translate).toHaveBeenCalledWith(
    'notifications.subscriptionUpcoming.body',
    expect.objectContaining({ lang: 'en' }),
  );
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd backend && bun run test -- --testPathPattern=process-notifications.handler.spec`
Expected: FAIL — body is still the hardcoded Russian template.

- [ ] **Step 4: Replace hardcoded strings with i18n**

Inject `I18nService` into each handler/controller. Replace each hardcoded RU string with `this.i18n.translate('notifications.<key>', { lang: profile.language, args: { amount, currency, accountName, reason, when } })`. For the `when`/`reason` sub-phrases (e.g. «сегодня»/«завтра»/«через N дн.»), add keys under `notifications.when.*` and translate them too. For the test-notification controller, language comes from the HTTP request (resolver handles it) — use `I18nContext.current()` or inject and pass `{ lang: req.user?.language }`.

- [ ] **Step 5: Localize Telegram messages**

In `telegram-bot.service.ts`, replace hardcoded RU strings with `i18n.translate('telegram.<key>', { lang })` where `lang` = linked profile's `language`, else Telegram `ctx.from.language_code` normalized to `'ru'|'en'`, else `'ru'`. Add a small helper `resolveTelegramLang(ctx, profile)`.

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd backend && bun run test -- --testPathPattern="process-notifications|process-auto-charges"`
Expected: PASS.

- [ ] **Step 7: Verify build**

Run: `cd backend && bun run build`
Expected: success.

- [ ] **Step 8: Commit**

```bash
cd backend && git add src/modules/recurring-subscription src/modules/notification src/modules/telegram-import
git commit -m "feat(i18n): localize push notifications and telegram bot messages"
```

---

## Task 8: Full backend verification

- [ ] **Step 1: Lint + build + test**

Run: `cd backend && bun run lint && bun run build && bun run test`
Expected: all green.

- [ ] **Step 2: Manual smoke (optional, local)**

Run backend (`bun run start:dev`), register a user with `language: 'en'`, call `POST /api/categories/initialize-defaults`, then `GET /api/categories` — confirm names are English. `GET /api/profiles/me` returns `language: 'en'`. `PATCH /api/profiles/me { "language": "ru" }` returns `language: 'ru'`.

- [ ] **Step 3: Commit any fixups**

```bash
cd backend && git add -A && git commit -m "chore(i18n): backend foundation verification fixups" || echo "nothing to commit"
```

---

## Self-Review Notes (addressed)

- **Spec Section 2 (language field, validation, registration default):** Tasks 1–4. ✓
- **Spec Section 2 (background jobs use profile.language):** Task 7. ✓
- **Spec Section 3 (nestjs-i18n, resolver order profile → Accept-Language → ru):** Task 5. ✓
- **Spec Section 3 (default categories via id keys, name fallback):** Task 6. ✓
- **Spec Section 3 (demo/notifications/telegram dictionaries):** Tasks 5 (files) + 7 (wiring). ✓
- **Deferred (API exceptions):** not touched — correct. ✓
- **Signature consistency:** `language` is the property name everywhere; `createRegistered(..., currency, language)` ordering is verified in Task 1 Step 1 before use in Task 4.
- **Known assumption to verify at execution:** the controller's mechanism to read `req.user.language` (JWT payload). If the JWT does not carry `language`, Task 6 Step 5 / Task 7 must load the profile via the profile repository instead. Flagged in those steps.
