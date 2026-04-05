# Recurring Subscriptions Tracker — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the unused Reminders module with a full Recurring Subscriptions tracker featuring calendar UI, push notifications, and auto-charge.

**Architecture:** Three new backend modules (notification, recurring-subscription) + profile timezone field, replacing the existing reminder infrastructure. Frontend gets a new entity, features, widgets, pages, and Service Worker push handling. The notification module is designed for reuse by other modules.

**Tech Stack:** NestJS 11, TypeORM, @nestjs/schedule, web-push (VAPID), Vue 3, TanStack Vue Query, Tailwind CSS v4, vite-plugin-pwa

---

## File Structure

### Backend — New Files

```
backend/src/modules/notification/
  notification.module.ts
  domain/
    aggregates/push-subscription/push-subscription.aggregate.ts
    repositories/push-subscription.repository.interface.ts
  application/
    commands/
      register-push-subscription/register-push-subscription.command.ts
      register-push-subscription/register-push-subscription.handler.ts
      unregister-push-subscription/unregister-push-subscription.command.ts
      unregister-push-subscription/unregister-push-subscription.handler.ts
      index.ts
    queries/
      get-user-push-subscriptions/get-user-push-subscriptions.query.ts
      get-user-push-subscriptions/get-user-push-subscriptions.handler.ts
      index.ts
    services/push-notification.service.ts
    mappers/push-subscription-response.mapper.ts
  infrastructure/
    persistence/
      typeorm/push-subscription.orm-entity.ts
      mappers/push-subscription.mapper.ts
      repositories/push-subscription.repository.ts
  presentation/
    controllers/push-subscription.controller.ts
    dto/register-push-subscription.dto.ts

backend/src/modules/recurring-subscription/
  recurring-subscription.module.ts
  domain/
    aggregates/recurring-subscription/recurring-subscription.aggregate.ts
    repositories/recurring-subscription.repository.interface.ts
  application/
    commands/
      create-subscription/create-subscription.command.ts
      create-subscription/create-subscription.handler.ts
      update-subscription/update-subscription.command.ts
      update-subscription/update-subscription.handler.ts
      delete-subscription/delete-subscription.command.ts
      delete-subscription/delete-subscription.handler.ts
      pause-subscription/pause-subscription.command.ts
      pause-subscription/pause-subscription.handler.ts
      resume-subscription/resume-subscription.command.ts
      resume-subscription/resume-subscription.handler.ts
      process-auto-charges/process-auto-charges.command.ts
      process-auto-charges/process-auto-charges.handler.ts
      process-notifications/process-notifications.command.ts
      process-notifications/process-notifications.handler.ts
      index.ts
    queries/
      get-subscriptions/get-subscriptions.query.ts
      get-subscriptions/get-subscriptions.handler.ts
      get-subscription-by-id/get-subscription-by-id.query.ts
      get-subscription-by-id/get-subscription-by-id.handler.ts
      get-upcoming-subscriptions/get-upcoming-subscriptions.query.ts
      get-upcoming-subscriptions/get-upcoming-subscriptions.handler.ts
      get-calendar-subscriptions/get-calendar-subscriptions.query.ts
      get-calendar-subscriptions/get-calendar-subscriptions.handler.ts
      index.ts
    services/subscription-cron.service.ts
    mappers/subscription-response.mapper.ts
  infrastructure/
    persistence/
      typeorm/recurring-subscription.orm-entity.ts
      mappers/recurring-subscription.mapper.ts
      repositories/recurring-subscription.repository.ts
  presentation/
    controllers/recurring-subscriptions.controller.ts
    dto/
      create-subscription.dto.ts
      update-subscription.dto.ts
      calendar-query.dto.ts
      upcoming-query.dto.ts

backend/src/database/migrations/TIMESTAMP-AddRecurringSubscriptions.ts
```

### Backend — Modified Files

```
backend/src/app.module.ts                                    — add new ORM entities + modules
backend/src/config/data-source.ts                            — add new ORM entities
backend/src/modules/identity/domain/entities/profile.entity.ts — add timezone field
backend/src/modules/identity/infrastructure/persistence/typeorm/profile.orm-entity.ts — add timezone column
backend/src/modules/identity/infrastructure/persistence/mappers/profile.mapper.ts — add timezone mapping
backend/src/modules/identity/application/commands/update-profile/* — add timezone to DTO/command/handler
backend/src/modules/identity/application/queries/*/          — add timezone to response mappers
backend/src/modules/planning/planning.module.ts              — remove reminder providers
backend/src/modules/planning/application/commands/index.ts   — remove reminder handlers
backend/src/modules/planning/application/queries/index.ts    — remove reminder handlers
backend/src/modules/planning/domain/repositories/index.ts    — remove reminder export
```

### Backend — Deleted Files

```
backend/src/modules/planning/domain/aggregates/reminder/     — entire directory
backend/src/modules/planning/domain/repositories/reminder.repository.interface.ts
backend/src/modules/planning/application/commands/create-reminder/
backend/src/modules/planning/application/commands/update-reminder/
backend/src/modules/planning/application/commands/delete-reminder/
backend/src/modules/planning/application/queries/get-reminders/
backend/src/modules/planning/application/queries/get-reminder-by-id/
backend/src/modules/planning/application/mappers/reminder-response.mapper.ts
backend/src/modules/planning/infrastructure/persistence/typeorm/reminder.orm-entity.ts
backend/src/modules/planning/infrastructure/persistence/mappers/reminder.mapper.ts
backend/src/modules/planning/infrastructure/persistence/repositories/reminder.repository.ts
backend/src/modules/planning/presentation/controllers/reminders.controller.ts
backend/src/modules/planning/presentation/dto/create-reminder.dto.ts
backend/src/modules/planning/presentation/dto/update-reminder.dto.ts
```

### Frontend — New Files

```
frontend/src/entities/recurring-subscription/
  model/types.ts
  model/constants.ts
  model/utils.ts
  api/queryKeys.ts
  api/recurringSubscriptionApi.ts
  api/useRecurringSubscriptions.ts
  api/useSubscriptionCalendar.ts
  api/useUpcomingSubscriptions.ts
  ui/SubscriptionCard.vue
  ui/SubscriptionCalendar.vue
  ui/SubscriptionListItem.vue
  ui/SubscriptionCardSkeleton.vue
  index.ts

frontend/src/entities/push-subscription/
  model/types.ts
  api/queryKeys.ts
  api/pushSubscriptionApi.ts
  api/usePushSubscription.ts
  index.ts

frontend/src/features/create-subscription/
  model/useCreateSubscription.ts
  ui/SubscriptionForm.vue
  ui/ServicePresetPicker.vue
  index.ts

frontend/src/features/edit-subscription/
  model/useEditSubscription.ts
  ui/EditSubscriptionForm.vue
  index.ts

frontend/src/features/manage-push-notifications/
  model/usePushNotificationSettings.ts
  ui/PushNotificationToggle.vue
  index.ts

frontend/src/widgets/upcoming-subscriptions/
  ui/UpcomingSubscriptions.vue
  ui/UpcomingSubscriptionsSkeleton.vue
  index.ts

frontend/src/pages/subscriptions/
  SubscriptionsPage.vue

frontend/src/pages/subscription-detail/
  SubscriptionDetailPage.vue

frontend/src/shared/lib/service-worker/push-handler.ts
```

### Frontend — Modified Files

```
frontend/src/shared/api/database.types.ts          — replace reminder types with recurring subscription types
frontend/src/shared/api/invalidation.ts             — add invalidateSubscriptionRelated
frontend/src/shared/config/routeNames.ts            — replace reminder routes with subscription routes
frontend/src/shared/config/navigation.ts            — update CHILD_ROUTE_MAP
frontend/src/shared/ui/icon/iconMap.ts              — add service preset icon entries
frontend/src/app/router/index.ts                    — replace reminder routes with subscription routes
frontend/src/pages/dashboard/DashboardPage.vue      — replace RemindersSection with UpcomingSubscriptions
frontend/src/pages/dashboard/model/useDashboardData.ts — replace reminders with subscriptions
frontend/src/pages/dashboard/model/useDashboardNavigation.ts — replace reminder nav with subscription nav
frontend/src/pages/dashboard/ui/DashboardActivityColumn.vue — replace reminder rendering
frontend/src/pages/dashboard/ui/DashboardSidePanel.vue — replace reminder section
frontend/vite.config.ts                             — add custom SW for push handling
```

### Frontend — Deleted Files

```
frontend/src/entities/reminder/                      — entire directory
frontend/src/features/create-reminder/               — entire directory
frontend/src/features/edit-reminder/                 — entire directory
```

---

## Task 1: Database Migration — Drop Reminders, Create New Tables, Add Profile Timezone

**Files:**
- Create: `backend/src/database/migrations/{TIMESTAMP}-AddRecurringSubscriptions.ts`

- [ ] **Step 1: Generate migration timestamp**

Run: `date +%s000` to get a timestamp. Use this for the migration filename.

- [ ] **Step 2: Create the migration file**

Create `backend/src/database/migrations/{TIMESTAMP}-AddRecurringSubscriptions.ts`:

```typescript
import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddRecurringSubscriptions{TIMESTAMP} implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop reminders table
    await queryRunner.query(`DROP TABLE IF EXISTS "reminders"`);

    // Add timezone to profiles
    await queryRunner.query(
      `ALTER TABLE "profiles" ADD "timezone" varchar NOT NULL DEFAULT 'Asia/Tashkent'`,
    );

    // Create push_subscriptions table
    await queryRunner.query(`
      CREATE TABLE "push_subscriptions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "endpoint" text NOT NULL,
        "p256dh" text NOT NULL,
        "auth" text NOT NULL,
        "user_agent" varchar,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_push_subscriptions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_push_subscriptions_user" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE
      )
    `);

    // Create recurring_subscriptions table
    await queryRunner.query(`
      CREATE TABLE "recurring_subscriptions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "name" varchar NOT NULL,
        "description" text,
        "amount" decimal(18,2) NOT NULL,
        "currency" varchar NOT NULL,
        "account_id" uuid,
        "icon" varchar NOT NULL,
        "color" varchar NOT NULL,
        "frequency" varchar NOT NULL,
        "frequency_days" integer,
        "billing_date" date NOT NULL,
        "notify_days_before" integer NOT NULL DEFAULT 2,
        "category_id" varchar NOT NULL DEFAULT 'entertainment',
        "auto_charge" boolean NOT NULL DEFAULT false,
        "status" varchar NOT NULL DEFAULT 'active',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_recurring_subscriptions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_recurring_subscriptions_user" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_recurring_subscriptions_account" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE SET NULL
      )
    `);

    // Indexes
    await queryRunner.query(
      `CREATE INDEX "IDX_recurring_subscriptions_user_id" ON "recurring_subscriptions" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_recurring_subscriptions_billing_date" ON "recurring_subscriptions" ("billing_date")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_push_subscriptions_user_id" ON "push_subscriptions" ("user_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "recurring_subscriptions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "push_subscriptions"`);
    await queryRunner.query(`ALTER TABLE "profiles" DROP COLUMN "timezone"`);

    // Recreate reminders table
    await queryRunner.query(`
      CREATE TABLE "reminders" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "name" varchar NOT NULL,
        "amount" decimal(18,2) NOT NULL,
        "frequency" varchar NOT NULL,
        "next_date" date NOT NULL,
        "icon" varchar NOT NULL,
        "color" varchar NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_reminders" PRIMARY KEY ("id")
      )
    `);
  }
}
```

- [ ] **Step 3: Run migration**

Run: `cd backend && bun run migration:run`
Expected: Migration applied successfully.

- [ ] **Step 4: Verify tables exist**

Run: `cd backend && bun run migration:run` (should show no pending migrations)

---

## Task 2: Backend — Remove Reminder Module Code

**Files:**
- Delete: All reminder-related files listed in "Backend — Deleted Files" section above
- Modify: `backend/src/modules/planning/planning.module.ts`
- Modify: `backend/src/modules/planning/application/commands/index.ts`
- Modify: `backend/src/modules/planning/application/queries/index.ts`
- Modify: `backend/src/modules/planning/domain/repositories/index.ts`
- Modify: `backend/src/app.module.ts` — remove `ReminderOrmEntity` from entities array
- Modify: `backend/src/config/data-source.ts` — remove `ReminderOrmEntity` from entities array

- [ ] **Step 1: Delete all reminder files**

Delete these directories/files:
```
backend/src/modules/planning/domain/aggregates/reminder/
backend/src/modules/planning/domain/repositories/reminder.repository.interface.ts
backend/src/modules/planning/application/commands/create-reminder/
backend/src/modules/planning/application/commands/update-reminder/
backend/src/modules/planning/application/commands/delete-reminder/
backend/src/modules/planning/application/queries/get-reminders/
backend/src/modules/planning/application/queries/get-reminder-by-id/
backend/src/modules/planning/application/mappers/reminder-response.mapper.ts
backend/src/modules/planning/infrastructure/persistence/typeorm/reminder.orm-entity.ts
backend/src/modules/planning/infrastructure/persistence/mappers/reminder.mapper.ts
backend/src/modules/planning/infrastructure/persistence/repositories/reminder.repository.ts
backend/src/modules/planning/presentation/controllers/reminders.controller.ts
backend/src/modules/planning/presentation/dto/create-reminder.dto.ts
backend/src/modules/planning/presentation/dto/update-reminder.dto.ts
```

- [ ] **Step 2: Update planning module registrations**

In `backend/src/modules/planning/planning.module.ts`:
- Remove `REMINDER_REPOSITORY` from imports, providers, and exports
- Remove `ReminderOrmEntity` from `TypeOrmModule.forFeature([...])`
- Remove `ReminderRepository` from imports
- Remove `RemindersController` from controllers

In `backend/src/modules/planning/application/commands/index.ts`:
- Remove all `create-reminder`, `update-reminder`, `delete-reminder` exports
- Remove `CreateReminderHandler`, `UpdateReminderHandler`, `DeleteReminderHandler` from `CommandHandlers` array

In `backend/src/modules/planning/application/queries/index.ts`:
- Remove all `get-reminders`, `get-reminder-by-id` exports
- Remove `GetRemindersHandler`, `GetReminderByIdHandler` from `QueryHandlers` array

In `backend/src/modules/planning/domain/repositories/index.ts`:
- Remove `export * from './reminder.repository.interface'`

- [ ] **Step 3: Remove ReminderOrmEntity from global registrations**

In `backend/src/app.module.ts`: remove `ReminderOrmEntity` from the `entities: [...]` array inside `TypeOrmModule.forRootAsync`.

In `backend/src/config/data-source.ts`: remove `ReminderOrmEntity` from the `entities: [...]` array and remove its import.

- [ ] **Step 4: Verify backend builds**

Run: `cd backend && bun run build`
Expected: Compiles with zero errors.

- [ ] **Step 5: Run tests**

Run: `cd backend && bun run test`
Expected: All tests pass (reminder tests are deleted, no other tests should break).

---

## Task 3: Backend — Add Timezone to Profile

**Files:**
- Modify: `backend/src/modules/identity/domain/entities/profile.entity.ts`
- Modify: `backend/src/modules/identity/infrastructure/persistence/typeorm/profile.orm-entity.ts`
- Modify: `backend/src/modules/identity/infrastructure/persistence/mappers/profile.mapper.ts`
- Modify: `backend/src/modules/identity/application/commands/update-profile/update-profile.command.ts`
- Modify: `backend/src/modules/identity/application/commands/update-profile/update-profile.handler.ts`
- Modify: `backend/src/modules/identity/presentation/dto/update-profile.dto.ts`
- Modify: All profile response mappers that return profile data

- [ ] **Step 1: Add timezone to Profile entity**

In `profile.entity.ts`, add to `ProfileProps`:
```typescript
timezone: string;
```

Add private field and getter:
```typescript
private _timezone: string;

get timezone(): string {
  return this._timezone;
}
```

In constructor, assign: `this._timezone = props.timezone;`

In `static createRegistered()` and `static createDemo()`, pass `timezone: 'Asia/Tashkent'`.

In `updateProfile()` data parameter type, add `timezone?: string;` and in the body:
```typescript
if (data.timezone !== undefined) {
  this._timezone = data.timezone;
  hasChanges = true;
}
```

- [ ] **Step 2: Add timezone to ORM entity**

In `profile.orm-entity.ts`, add:
```typescript
@Column({ type: 'varchar', default: 'Asia/Tashkent' })
timezone: string;
```

- [ ] **Step 3: Update Profile mapper**

In `profile.mapper.ts`, add `timezone: ormEntity.timezone` in `toDomain()` and `ormEntity.timezone = profile.timezone` in `toOrm()`.

- [ ] **Step 4: Update update-profile command and handler**

In `update-profile.command.ts`, add `timezone?: string` to the data type.

In `update-profile.dto.ts`, add:
```typescript
@IsOptional()
@IsString()
timezone?: string;
```

- [ ] **Step 5: Update all profile response mappers to include timezone**

Find all places where profile data is returned (get-profile handler, update-profile handler, auth/me response) and add `timezone: profile.timezone` to the response object.

- [ ] **Step 6: Verify build**

Run: `cd backend && bun run build`
Expected: Zero errors.

---

## Task 4: Backend — Notification Module (Push Subscriptions)

**Files:**
- Create: All files under `backend/src/modules/notification/`
- Modify: `backend/src/app.module.ts` — add `NotificationModule` + `PushSubscriptionOrmEntity`
- Modify: `backend/src/config/data-source.ts` — add `PushSubscriptionOrmEntity`

- [ ] **Step 1: Install web-push**

Run: `cd backend && bun add web-push && bun add -D @types/web-push`

- [ ] **Step 2: Create PushSubscription aggregate**

Create `backend/src/modules/notification/domain/aggregates/push-subscription/push-subscription.aggregate.ts`:

```typescript
import { AggregateRoot } from '../../../../../shared/domain/base';

export interface PushSubscriptionProps {
  id: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string | null;
  createdAt: Date;
}

export class PushSubscription extends AggregateRoot<string> {
  private _userId: string;
  private _endpoint: string;
  private _p256dh: string;
  private _auth: string;
  private _userAgent: string | null;
  private _createdAt: Date;

  private constructor(props: PushSubscriptionProps) {
    super(props.id);
    this._userId = props.userId;
    this._endpoint = props.endpoint;
    this._p256dh = props.p256dh;
    this._auth = props.auth;
    this._userAgent = props.userAgent;
    this._createdAt = props.createdAt;
  }

  static create(
    id: string,
    userId: string,
    endpoint: string,
    p256dh: string,
    auth: string,
    userAgent: string | null,
  ): PushSubscription {
    return new PushSubscription({
      id, userId, endpoint, p256dh, auth, userAgent, createdAt: new Date(),
    });
  }

  static reconstitute(props: PushSubscriptionProps): PushSubscription {
    return new PushSubscription(props);
  }

  get userId(): string { return this._userId; }
  get endpoint(): string { return this._endpoint; }
  get p256dh(): string { return this._p256dh; }
  get auth(): string { return this._auth; }
  get userAgent(): string | null { return this._userAgent; }
  get createdAt(): Date { return this._createdAt; }
}
```

- [ ] **Step 3: Create repository interface**

Create `backend/src/modules/notification/domain/repositories/push-subscription.repository.interface.ts`:

```typescript
import type { PushSubscription } from '../aggregates/push-subscription/push-subscription.aggregate';

export const PUSH_SUBSCRIPTION_REPOSITORY = Symbol('PUSH_SUBSCRIPTION_REPOSITORY');

export interface IPushSubscriptionRepository {
  findById(id: string): Promise<PushSubscription | null>;
  findByUserId(userId: string): Promise<PushSubscription[]>;
  findByEndpoint(endpoint: string): Promise<PushSubscription | null>;
  save(pushSubscription: PushSubscription): Promise<PushSubscription>;
  delete(id: string): Promise<void>;
  deleteByEndpoint(endpoint: string): Promise<void>;
}
```

- [ ] **Step 4: Create ORM entity**

Create `backend/src/modules/notification/infrastructure/persistence/typeorm/push-subscription.orm-entity.ts`:

```typescript
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('push_subscriptions')
export class PushSubscriptionOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'text' })
  endpoint: string;

  @Column({ type: 'text' })
  p256dh: string;

  @Column({ type: 'text' })
  auth: string;

  @Column({ name: 'user_agent', type: 'varchar', nullable: true })
  userAgent: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
```

- [ ] **Step 5: Create mapper**

Create `backend/src/modules/notification/infrastructure/persistence/mappers/push-subscription.mapper.ts`:

```typescript
import { PushSubscription } from '../../../domain/aggregates/push-subscription/push-subscription.aggregate';
import { PushSubscriptionOrmEntity } from '../typeorm/push-subscription.orm-entity';

export class PushSubscriptionMapper {
  static toDomain(orm: PushSubscriptionOrmEntity): PushSubscription {
    return PushSubscription.reconstitute({
      id: orm.id,
      userId: orm.userId,
      endpoint: orm.endpoint,
      p256dh: orm.p256dh,
      auth: orm.auth,
      userAgent: orm.userAgent,
      createdAt: orm.createdAt,
    });
  }

  static toOrm(domain: PushSubscription): PushSubscriptionOrmEntity {
    const orm = new PushSubscriptionOrmEntity();
    orm.id = domain.id;
    orm.userId = domain.userId;
    orm.endpoint = domain.endpoint;
    orm.p256dh = domain.p256dh;
    orm.auth = domain.auth;
    orm.userAgent = domain.userAgent;
    orm.createdAt = domain.createdAt;
    return orm;
  }
}
```

- [ ] **Step 6: Create repository implementation**

Create `backend/src/modules/notification/infrastructure/persistence/repositories/push-subscription.repository.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PushSubscription } from '../../../domain/aggregates/push-subscription/push-subscription.aggregate';
import type { IPushSubscriptionRepository } from '../../../domain/repositories/push-subscription.repository.interface';
import { PushSubscriptionOrmEntity } from '../typeorm/push-subscription.orm-entity';
import { PushSubscriptionMapper } from '../mappers/push-subscription.mapper';

@Injectable()
export class PushSubscriptionRepository implements IPushSubscriptionRepository {
  constructor(
    @InjectRepository(PushSubscriptionOrmEntity)
    private readonly ormRepository: Repository<PushSubscriptionOrmEntity>,
  ) {}

  async findById(id: string): Promise<PushSubscription | null> {
    const orm = await this.ormRepository.findOne({ where: { id } });
    return orm ? PushSubscriptionMapper.toDomain(orm) : null;
  }

  async findByUserId(userId: string): Promise<PushSubscription[]> {
    const orms = await this.ormRepository.find({ where: { userId } });
    return orms.map(PushSubscriptionMapper.toDomain);
  }

  async findByEndpoint(endpoint: string): Promise<PushSubscription | null> {
    const orm = await this.ormRepository.findOne({ where: { endpoint } });
    return orm ? PushSubscriptionMapper.toDomain(orm) : null;
  }

  async save(pushSubscription: PushSubscription): Promise<PushSubscription> {
    const orm = PushSubscriptionMapper.toOrm(pushSubscription);
    const saved = await this.ormRepository.save(orm);
    return PushSubscriptionMapper.toDomain(saved);
  }

  async delete(id: string): Promise<void> {
    await this.ormRepository.delete(id);
  }

  async deleteByEndpoint(endpoint: string): Promise<void> {
    await this.ormRepository.delete({ endpoint });
  }
}
```

- [ ] **Step 7: Create PushNotificationService**

Create `backend/src/modules/notification/application/services/push-notification.service.ts`:

```typescript
import { Inject, Injectable, Logger } from '@nestjs/common';
import * as webPush from 'web-push';
import { ConfigService } from '@nestjs/config';
import {
  IPushSubscriptionRepository,
  PUSH_SUBSCRIPTION_REPOSITORY,
} from '../../domain/repositories/push-subscription.repository.interface';

export const PUSH_NOTIFICATION_SERVICE = Symbol('PUSH_NOTIFICATION_SERVICE');

export interface IPushNotificationService {
  sendToUser(
    userId: string,
    payload: { title: string; body: string; icon?: string; url?: string; tag?: string },
  ): Promise<void>;
}

@Injectable()
export class PushNotificationService implements IPushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);

  constructor(
    @Inject(PUSH_SUBSCRIPTION_REPOSITORY)
    private readonly pushSubscriptionRepo: IPushSubscriptionRepository,
    private readonly configService: ConfigService,
  ) {
    const publicKey = this.configService.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = this.configService.get<string>('VAPID_PRIVATE_KEY');
    const subject = this.configService.get<string>('VAPID_SUBJECT');

    if (publicKey && privateKey && subject) {
      webPush.setVapidDetails(subject, publicKey, privateKey);
    } else {
      this.logger.warn('VAPID keys not configured — push notifications disabled');
    }
  }

  async sendToUser(
    userId: string,
    payload: { title: string; body: string; icon?: string; url?: string; tag?: string },
  ): Promise<void> {
    const subscriptions = await this.pushSubscriptionRepo.findByUserId(userId);
    if (subscriptions.length === 0) return;

    const jsonPayload = JSON.stringify(payload);

    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          await webPush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            jsonPayload,
          );
        } catch (error: any) {
          if (error.statusCode === 410 || error.statusCode === 404) {
            this.logger.log(`Removing expired push subscription: ${sub.id}`);
            await this.pushSubscriptionRepo.delete(sub.id);
          } else {
            throw error;
          }
        }
      }),
    );

    const failed = results.filter((r) => r.status === 'rejected');
    if (failed.length > 0) {
      this.logger.warn(`Failed to send ${failed.length}/${subscriptions.length} push notifications for user ${userId}`);
    }
  }
}
```

- [ ] **Step 8: Create commands and handlers**

Create `register-push-subscription.command.ts`:
```typescript
export class RegisterPushSubscriptionCommand {
  constructor(
    public readonly userId: string,
    public readonly endpoint: string,
    public readonly p256dh: string,
    public readonly auth: string,
    public readonly userAgent: string | null,
  ) {}
}
```

Create `register-push-subscription.handler.ts`:
```typescript
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { RegisterPushSubscriptionCommand } from './register-push-subscription.command';
import { PushSubscription } from '../../../domain/aggregates/push-subscription/push-subscription.aggregate';
import {
  IPushSubscriptionRepository,
  PUSH_SUBSCRIPTION_REPOSITORY,
} from '../../../domain/repositories/push-subscription.repository.interface';

@CommandHandler(RegisterPushSubscriptionCommand)
export class RegisterPushSubscriptionHandler
  implements ICommandHandler<RegisterPushSubscriptionCommand>
{
  constructor(
    @Inject(PUSH_SUBSCRIPTION_REPOSITORY)
    private readonly repo: IPushSubscriptionRepository,
  ) {}

  async execute(command: RegisterPushSubscriptionCommand) {
    // Upsert: if endpoint already exists, replace it
    const existing = await this.repo.findByEndpoint(command.endpoint);
    if (existing) {
      await this.repo.delete(existing.id);
    }

    const sub = PushSubscription.create(
      crypto.randomUUID(),
      command.userId,
      command.endpoint,
      command.p256dh,
      command.auth,
      command.userAgent,
    );

    const saved = await this.repo.save(sub);
    return { id: saved.id };
  }
}
```

Create `unregister-push-subscription.command.ts`:
```typescript
export class UnregisterPushSubscriptionCommand {
  constructor(
    public readonly id: string,
    public readonly userId: string,
  ) {}
}
```

Create `unregister-push-subscription.handler.ts`:
```typescript
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { UnregisterPushSubscriptionCommand } from './unregister-push-subscription.command';
import {
  IPushSubscriptionRepository,
  PUSH_SUBSCRIPTION_REPOSITORY,
} from '../../../domain/repositories/push-subscription.repository.interface';

@CommandHandler(UnregisterPushSubscriptionCommand)
export class UnregisterPushSubscriptionHandler
  implements ICommandHandler<UnregisterPushSubscriptionCommand>
{
  constructor(
    @Inject(PUSH_SUBSCRIPTION_REPOSITORY)
    private readonly repo: IPushSubscriptionRepository,
  ) {}

  async execute(command: UnregisterPushSubscriptionCommand): Promise<void> {
    const sub = await this.repo.findById(command.id);
    if (!sub || sub.userId !== command.userId) {
      throw new NotFoundException('Push subscription not found');
    }
    await this.repo.delete(command.id);
  }
}
```

Create `backend/src/modules/notification/application/commands/index.ts`:
```typescript
export * from './register-push-subscription/register-push-subscription.command';
export * from './register-push-subscription/register-push-subscription.handler';
export * from './unregister-push-subscription/unregister-push-subscription.command';
export * from './unregister-push-subscription/unregister-push-subscription.handler';

import { RegisterPushSubscriptionHandler } from './register-push-subscription/register-push-subscription.handler';
import { UnregisterPushSubscriptionHandler } from './unregister-push-subscription/unregister-push-subscription.handler';

export const CommandHandlers = [
  RegisterPushSubscriptionHandler,
  UnregisterPushSubscriptionHandler,
];
```

- [ ] **Step 9: Create DTO and Controller**

Create `backend/src/modules/notification/presentation/dto/register-push-subscription.dto.ts`:
```typescript
import { IsString, IsOptional } from 'class-validator';

export class RegisterPushSubscriptionDto {
  @IsString()
  endpoint: string;

  @IsString()
  p256dh: string;

  @IsString()
  auth: string;

  @IsOptional()
  @IsString()
  userAgent?: string;
}
```

Create `backend/src/modules/notification/presentation/controllers/push-subscription.controller.ts`:
```typescript
import {
  Controller, Post, Delete, Body, Param, HttpCode, HttpStatus,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { CurrentUser } from '../../../../common';
import { RegisterPushSubscriptionDto } from '../dto/register-push-subscription.dto';
import {
  RegisterPushSubscriptionCommand,
  UnregisterPushSubscriptionCommand,
} from '../../application/commands';

@Controller('push-subscriptions')
export class PushSubscriptionController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post()
  async register(
    @CurrentUser('sub') userId: string,
    @Body() dto: RegisterPushSubscriptionDto,
  ) {
    return this.commandBus.execute(
      new RegisterPushSubscriptionCommand(
        userId,
        dto.endpoint,
        dto.p256dh,
        dto.auth,
        dto.userAgent ?? null,
      ),
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unregister(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    await this.commandBus.execute(
      new UnregisterPushSubscriptionCommand(id, userId),
    );
  }
}
```

- [ ] **Step 10: Create NotificationModule**

Create `backend/src/modules/notification/notification.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { PUSH_SUBSCRIPTION_REPOSITORY } from './domain/repositories/push-subscription.repository.interface';
import { PushSubscriptionOrmEntity } from './infrastructure/persistence/typeorm/push-subscription.orm-entity';
import { PushSubscriptionRepository } from './infrastructure/persistence/repositories/push-subscription.repository';
import { PushSubscriptionController } from './presentation/controllers/push-subscription.controller';
import { CommandHandlers } from './application/commands';
import {
  PUSH_NOTIFICATION_SERVICE,
  PushNotificationService,
} from './application/services/push-notification.service';

@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([PushSubscriptionOrmEntity]),
  ],
  controllers: [PushSubscriptionController],
  providers: [
    { provide: PUSH_SUBSCRIPTION_REPOSITORY, useClass: PushSubscriptionRepository },
    { provide: PUSH_NOTIFICATION_SERVICE, useClass: PushNotificationService },
    ...CommandHandlers,
  ],
  exports: [PUSH_NOTIFICATION_SERVICE],
})
export class NotificationModule {}
```

- [ ] **Step 11: Register in app.module.ts and data-source.ts**

In `app.module.ts`:
- Add `PushSubscriptionOrmEntity` to the `entities` array
- Add `NotificationModule` to the `imports` array

In `data-source.ts`:
- Add `PushSubscriptionOrmEntity` to the `entities` array with its import

- [ ] **Step 12: Verify build**

Run: `cd backend && bun run build`
Expected: Zero errors.

---

## Task 5: Backend — Recurring Subscription Module (Domain + CRUD)

**Files:**
- Create: All files under `backend/src/modules/recurring-subscription/` (domain, application, infrastructure, presentation)
- Modify: `backend/src/app.module.ts` — add `RecurringSubscriptionModule` + `RecurringSubscriptionOrmEntity`
- Modify: `backend/src/config/data-source.ts` — add `RecurringSubscriptionOrmEntity`

- [ ] **Step 1: Create RecurringSubscription aggregate**

Create `backend/src/modules/recurring-subscription/domain/aggregates/recurring-subscription/recurring-subscription.aggregate.ts`:

```typescript
import { AggregateRoot } from '../../../../../shared/domain/base';

export type SubscriptionFrequency = 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';
export type SubscriptionStatus = 'active' | 'paused';

export interface RecurringSubscriptionProps {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  amount: number;
  currency: string;
  accountId: string | null;
  icon: string;
  color: string;
  frequency: SubscriptionFrequency;
  frequencyDays: number | null;
  billingDate: Date;
  notifyDaysBefore: number;
  categoryId: string;
  autoCharge: boolean;
  status: SubscriptionStatus;
  createdAt: Date;
  updatedAt: Date;
}

export class RecurringSubscription extends AggregateRoot<string> {
  private _userId: string;
  private _name: string;
  private _description: string | null;
  private _amount: number;
  private _currency: string;
  private _accountId: string | null;
  private _icon: string;
  private _color: string;
  private _frequency: SubscriptionFrequency;
  private _frequencyDays: number | null;
  private _billingDate: Date;
  private _notifyDaysBefore: number;
  private _categoryId: string;
  private _autoCharge: boolean;
  private _status: SubscriptionStatus;
  private _createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: RecurringSubscriptionProps) {
    super(props.id);
    this._userId = props.userId;
    this._name = props.name;
    this._description = props.description;
    this._amount = props.amount;
    this._currency = props.currency;
    this._accountId = props.accountId;
    this._icon = props.icon;
    this._color = props.color;
    this._frequency = props.frequency;
    this._frequencyDays = props.frequencyDays;
    this._billingDate = props.billingDate;
    this._notifyDaysBefore = props.notifyDaysBefore;
    this._categoryId = props.categoryId;
    this._autoCharge = props.autoCharge;
    this._status = props.status;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  static create(
    id: string, userId: string, name: string, description: string | null,
    amount: number, currency: string, accountId: string | null,
    icon: string, color: string, frequency: SubscriptionFrequency,
    frequencyDays: number | null, billingDate: Date, notifyDaysBefore: number,
    categoryId: string, autoCharge: boolean,
  ): RecurringSubscription {
    return new RecurringSubscription({
      id, userId, name, description, amount, currency, accountId,
      icon, color, frequency, frequencyDays, billingDate, notifyDaysBefore,
      categoryId, autoCharge, status: 'active',
      createdAt: new Date(), updatedAt: new Date(),
    });
  }

  static reconstitute(props: RecurringSubscriptionProps): RecurringSubscription {
    return new RecurringSubscription(props);
  }

  // Getters
  get userId(): string { return this._userId; }
  get name(): string { return this._name; }
  get description(): string | null { return this._description; }
  get amount(): number { return this._amount; }
  get currency(): string { return this._currency; }
  get accountId(): string | null { return this._accountId; }
  get icon(): string { return this._icon; }
  get color(): string { return this._color; }
  get frequency(): SubscriptionFrequency { return this._frequency; }
  get frequencyDays(): number | null { return this._frequencyDays; }
  get billingDate(): Date { return this._billingDate; }
  get notifyDaysBefore(): number { return this._notifyDaysBefore; }
  get categoryId(): string { return this._categoryId; }
  get autoCharge(): boolean { return this._autoCharge; }
  get status(): SubscriptionStatus { return this._status; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }

  update(data: Partial<Omit<RecurringSubscriptionProps, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>): void {
    if (data.name !== undefined) this._name = data.name;
    if (data.description !== undefined) this._description = data.description;
    if (data.amount !== undefined) this._amount = data.amount;
    if (data.currency !== undefined) this._currency = data.currency;
    if (data.accountId !== undefined) this._accountId = data.accountId;
    if (data.icon !== undefined) this._icon = data.icon;
    if (data.color !== undefined) this._color = data.color;
    if (data.frequency !== undefined) this._frequency = data.frequency;
    if (data.frequencyDays !== undefined) this._frequencyDays = data.frequencyDays;
    if (data.billingDate !== undefined) this._billingDate = data.billingDate;
    if (data.notifyDaysBefore !== undefined) this._notifyDaysBefore = data.notifyDaysBefore;
    if (data.categoryId !== undefined) this._categoryId = data.categoryId;
    if (data.autoCharge !== undefined) this._autoCharge = data.autoCharge;
    this._updatedAt = new Date();
  }

  pause(): void {
    this._status = 'paused';
    this._updatedAt = new Date();
  }

  resume(): void {
    this._status = 'active';
    this._updatedAt = new Date();
  }

  advanceBillingDate(): void {
    const date = new Date(this._billingDate);
    switch (this._frequency) {
      case 'weekly':
        date.setDate(date.getDate() + 7);
        break;
      case 'monthly':
        date.setMonth(date.getMonth() + 1);
        break;
      case 'quarterly':
        date.setMonth(date.getMonth() + 3);
        break;
      case 'yearly':
        date.setFullYear(date.getFullYear() + 1);
        break;
      case 'custom':
        date.setDate(date.getDate() + (this._frequencyDays ?? 30));
        break;
    }
    this._billingDate = date;
    this._updatedAt = new Date();
  }
}
```

- [ ] **Step 2: Create repository interface**

Create `backend/src/modules/recurring-subscription/domain/repositories/recurring-subscription.repository.interface.ts`:

```typescript
import type { RecurringSubscription } from '../aggregates/recurring-subscription/recurring-subscription.aggregate';

export const RECURRING_SUBSCRIPTION_REPOSITORY = Symbol('RECURRING_SUBSCRIPTION_REPOSITORY');

export interface IRecurringSubscriptionRepository {
  findById(id: string): Promise<RecurringSubscription | null>;
  findByUserId(userId: string): Promise<RecurringSubscription[]>;
  findActiveByUserId(userId: string): Promise<RecurringSubscription[]>;
  findByBillingDateAndStatus(billingDate: Date, status: 'active'): Promise<RecurringSubscription[]>;
  findUpcoming(userId: string, days: number): Promise<RecurringSubscription[]>;
  findByMonthAndUserId(userId: string, year: number, month: number): Promise<RecurringSubscription[]>;
  save(subscription: RecurringSubscription): Promise<RecurringSubscription>;
  delete(id: string): Promise<void>;
}
```

- [ ] **Step 3: Create ORM entity, mapper, repository implementation**

Follow the exact same patterns as Task 4 steps 4-6, but for `RecurringSubscription`. The ORM entity maps all columns from the `recurring_subscriptions` table. The mapper converts `decimal` amount with `Number()`. The repository implements all interface methods.

Key repository methods to implement:
- `findByBillingDateAndStatus`: uses `where: { billingDate, status }` — needed by cron
- `findUpcoming`: finds active subscriptions where `billingDate` is between today and today + N days, ordered by `billingDate ASC`
- `findByMonthAndUserId`: for calendar view — finds subscriptions that have a billing date within the given month, considering recurring patterns. For simplicity in v1, return all active subscriptions for the user and let the query handler compute which dates fall in the month.

- [ ] **Step 4: Create response mapper**

Create `backend/src/modules/recurring-subscription/application/mappers/subscription-response.mapper.ts`:

```typescript
import type { RecurringSubscription } from '../../domain/aggregates/recurring-subscription/recurring-subscription.aggregate';

export class SubscriptionResponseMapper {
  static toResponse(sub: RecurringSubscription) {
    return {
      id: sub.id,
      userId: sub.userId,
      name: sub.name,
      description: sub.description,
      amount: sub.amount,
      currency: sub.currency,
      accountId: sub.accountId,
      icon: sub.icon,
      color: sub.color,
      frequency: sub.frequency,
      frequencyDays: sub.frequencyDays,
      billingDate: sub.billingDate,
      notifyDaysBefore: sub.notifyDaysBefore,
      categoryId: sub.categoryId,
      autoCharge: sub.autoCharge,
      status: sub.status,
      createdAt: sub.createdAt,
      updatedAt: sub.updatedAt,
    };
  }

  static toResponseList(subs: RecurringSubscription[]) {
    return subs.map(SubscriptionResponseMapper.toResponse);
  }
}
```

- [ ] **Step 5: Create CRUD commands and handlers**

Create commands following the exact pattern from the Reminder module:
- `CreateSubscriptionCommand` + `CreateSubscriptionHandler` — creates via `RecurringSubscription.create()`, saves, returns response
- `UpdateSubscriptionCommand` + `UpdateSubscriptionHandler` — loads, verifies userId, calls `.update()`, saves
- `DeleteSubscriptionCommand` + `DeleteSubscriptionHandler` — loads, verifies userId, deletes
- `PauseSubscriptionCommand` + `PauseSubscriptionHandler` — loads, calls `.pause()`, saves
- `ResumeSubscriptionCommand` + `ResumeSubscriptionHandler` — loads, calls `.resume()`, saves

Create `index.ts` with all handlers exported in a `CommandHandlers` array.

- [ ] **Step 6: Create queries and handlers**

- `GetSubscriptionsQuery(userId)` + handler — returns all subscriptions for user
- `GetSubscriptionByIdQuery(id, userId)` + handler — returns single subscription
- `GetUpcomingSubscriptionsQuery(userId, days)` + handler — returns upcoming within N days
- `GetCalendarSubscriptionsQuery(userId, year, month)` + handler — returns subscriptions with computed billing dates for the given month. For each active subscription, compute all billing dates that fall within the month based on frequency and return as `{ subscription, dates: Date[] }`.

Create `index.ts` with all handlers exported in a `QueryHandlers` array.

- [ ] **Step 7: Create DTOs**

Create `create-subscription.dto.ts`:
```typescript
import {
  IsString, IsNumber, IsOptional, IsBoolean, IsIn, IsDateString, Min, Max, IsInt,
} from 'class-validator';

export class CreateSubscriptionDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsString()
  currency: string;

  @IsOptional()
  @IsString()
  accountId?: string;

  @IsString()
  icon: string;

  @IsString()
  color: string;

  @IsIn(['weekly', 'monthly', 'quarterly', 'yearly', 'custom'])
  frequency: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  frequencyDays?: number;

  @IsDateString()
  billingDate: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  notifyDaysBefore?: number;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsBoolean()
  autoCharge?: boolean;
}
```

Create `update-subscription.dto.ts` — same fields, all `@IsOptional()`.

Create `calendar-query.dto.ts`:
```typescript
import { IsString, Matches } from 'class-validator';

export class CalendarQueryDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}$/)
  month: string; // "2026-04"
}
```

Create `upcoming-query.dto.ts`:
```typescript
import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class UpcomingQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(90)
  days?: number = 7;
}
```

- [ ] **Step 8: Create controller**

Create `backend/src/modules/recurring-subscription/presentation/controllers/recurring-subscriptions.controller.ts`:

```typescript
import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, HttpCode, HttpStatus,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { CurrentUser } from '../../../../common';
import { CreateSubscriptionDto } from '../dto/create-subscription.dto';
import { UpdateSubscriptionDto } from '../dto/update-subscription.dto';
import { CalendarQueryDto } from '../dto/calendar-query.dto';
import { UpcomingQueryDto } from '../dto/upcoming-query.dto';
import {
  CreateSubscriptionCommand, UpdateSubscriptionCommand,
  DeleteSubscriptionCommand, PauseSubscriptionCommand, ResumeSubscriptionCommand,
} from '../../application/commands';
import {
  GetSubscriptionsQuery, GetSubscriptionByIdQuery,
  GetUpcomingSubscriptionsQuery, GetCalendarSubscriptionsQuery,
} from '../../application/queries';

@Controller('recurring-subscriptions')
export class RecurringSubscriptionsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  async findAll(@CurrentUser('sub') userId: string) {
    return this.queryBus.execute(new GetSubscriptionsQuery(userId));
  }

  @Get('calendar')
  async getCalendar(
    @CurrentUser('sub') userId: string,
    @Query() query: CalendarQueryDto,
  ) {
    const [year, month] = query.month.split('-').map(Number);
    return this.queryBus.execute(new GetCalendarSubscriptionsQuery(userId, year, month));
  }

  @Get('upcoming')
  async getUpcoming(
    @CurrentUser('sub') userId: string,
    @Query() query: UpcomingQueryDto,
  ) {
    return this.queryBus.execute(new GetUpcomingSubscriptionsQuery(userId, query.days ?? 7));
  }

  @Get(':id')
  async findOne(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    return this.queryBus.execute(new GetSubscriptionByIdQuery(id, userId));
  }

  @Post()
  async create(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateSubscriptionDto,
  ) {
    return this.commandBus.execute(
      new CreateSubscriptionCommand(
        userId, dto.name, dto.description ?? null,
        dto.amount, dto.currency, dto.accountId ?? null,
        dto.icon, dto.color, dto.frequency as any,
        dto.frequencyDays ?? null, new Date(dto.billingDate),
        dto.notifyDaysBefore ?? 2, dto.categoryId ?? 'entertainment',
        dto.autoCharge ?? false,
      ),
    );
  }

  @Patch(':id')
  async update(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSubscriptionDto,
  ) {
    return this.commandBus.execute(
      new UpdateSubscriptionCommand(id, userId, {
        ...dto,
        billingDate: dto.billingDate ? new Date(dto.billingDate) : undefined,
      }),
    );
  }

  @Patch(':id/pause')
  async pause(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.commandBus.execute(new PauseSubscriptionCommand(id, userId));
  }

  @Patch(':id/resume')
  async resume(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.commandBus.execute(new ResumeSubscriptionCommand(id, userId));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    await this.commandBus.execute(new DeleteSubscriptionCommand(id, userId));
  }
}
```

- [ ] **Step 9: Create RecurringSubscriptionModule**

Create `backend/src/modules/recurring-subscription/recurring-subscription.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { RECURRING_SUBSCRIPTION_REPOSITORY } from './domain/repositories/recurring-subscription.repository.interface';
import { RecurringSubscriptionOrmEntity } from './infrastructure/persistence/typeorm/recurring-subscription.orm-entity';
import { RecurringSubscriptionRepository } from './infrastructure/persistence/repositories/recurring-subscription.repository';
import { RecurringSubscriptionsController } from './presentation/controllers/recurring-subscriptions.controller';
import { CommandHandlers } from './application/commands';
import { QueryHandlers } from './application/queries';
import { SubscriptionCronService } from './application/services/subscription-cron.service';
import { NotificationModule } from '../notification/notification.module';
import { AccountingModule } from '../accounting/accounting.module';

@Module({
  imports: [
    CqrsModule,
    NotificationModule,
    AccountingModule,
    TypeOrmModule.forFeature([RecurringSubscriptionOrmEntity]),
  ],
  controllers: [RecurringSubscriptionsController],
  providers: [
    { provide: RECURRING_SUBSCRIPTION_REPOSITORY, useClass: RecurringSubscriptionRepository },
    ...CommandHandlers,
    ...QueryHandlers,
    SubscriptionCronService,
  ],
})
export class RecurringSubscriptionModule {}
```

- [ ] **Step 10: Register in app.module.ts and data-source.ts**

Add `RecurringSubscriptionOrmEntity` to entities arrays in both files.
Add `RecurringSubscriptionModule` to imports in `app.module.ts`.

- [ ] **Step 11: Verify build**

Run: `cd backend && bun run build`
Expected: Zero errors.

---

## Task 6: Backend — Subscription Cron Service (Auto-charge + Notifications)

**Files:**
- Create: `backend/src/modules/recurring-subscription/application/services/subscription-cron.service.ts`
- Create: `backend/src/modules/recurring-subscription/application/commands/process-auto-charges/`
- Create: `backend/src/modules/recurring-subscription/application/commands/process-notifications/`

- [ ] **Step 1: Create ProcessNotifications command + handler**

Create `process-notifications.command.ts`:
```typescript
export class ProcessNotificationsCommand {
  constructor(public readonly targetHour: number = 12) {}
}
```

Create `process-notifications.handler.ts` — queries profiles where current local time is `targetHour` (using timezone field), then for each user finds active subscriptions where `billingDate - notifyDaysBefore = today`. Sends push notification via `PUSH_NOTIFICATION_SERVICE` for each match.

- [ ] **Step 2: Create ProcessAutoCharges command + handler**

Create `process-auto-charges.command.ts`:
```typescript
export class ProcessAutoChargesCommand {
  constructor(public readonly targetHour: number = 12) {}
}
```

Create `process-auto-charges.handler.ts` — queries profiles where current local time is `targetHour`, then for each user finds active subscriptions where `autoCharge=true` AND `billingDate = today`. For each:
1. Create expense transaction via `CommandBus.execute(new CreateTransactionCommand(...))` — look up how `CreateTransactionCommand` is structured in the accounting module and use it
2. Call `subscription.advanceBillingDate()` and save
3. Send push notification via `PUSH_NOTIFICATION_SERVICE`

- [ ] **Step 3: Create SubscriptionCronService**

Create `backend/src/modules/recurring-subscription/application/services/subscription-cron.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CommandBus } from '@nestjs/cqrs';
import { ProcessNotificationsCommand } from '../commands';
import { ProcessAutoChargesCommand } from '../commands';

@Injectable()
export class SubscriptionCronService {
  private readonly logger = new Logger(SubscriptionCronService.name);

  constructor(private readonly commandBus: CommandBus) {}

  @Cron('0 * * * *') // Every hour at :00
  async handleHourlyCron(): Promise<void> {
    this.logger.log('Running hourly subscription processing...');
    try {
      await this.commandBus.execute(new ProcessNotificationsCommand(12));
      await this.commandBus.execute(new ProcessAutoChargesCommand(12));
      this.logger.log('Hourly subscription processing completed');
    } catch (error) {
      this.logger.error(
        `Subscription processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
```

- [ ] **Step 4: Update commands/index.ts**

Add `ProcessNotificationsHandler` and `ProcessAutoChargesHandler` to the `CommandHandlers` array and exports.

- [ ] **Step 5: Verify build**

Run: `cd backend && bun run build`
Expected: Zero errors.

---

## Task 7: Frontend — Remove Reminder Entity, Features, and Routes

**Files:**
- Delete: `frontend/src/entities/reminder/` (entire directory)
- Delete: `frontend/src/features/create-reminder/` (entire directory)
- Delete: `frontend/src/features/edit-reminder/` (entire directory)
- Modify: `frontend/src/shared/api/database.types.ts` — remove reminder types
- Modify: `frontend/src/shared/config/routeNames.ts` — remove reminder route names
- Modify: `frontend/src/shared/config/navigation.ts` — remove `/reminders` from CHILD_ROUTE_MAP
- Modify: `frontend/src/app/router/index.ts` — remove reminder routes
- Modify: `frontend/src/pages/dashboard/DashboardPage.vue` — remove reminder references
- Modify: `frontend/src/pages/dashboard/model/useDashboardData.ts` — remove reminders
- Modify: `frontend/src/pages/dashboard/model/useDashboardNavigation.ts` — remove reminder nav
- Modify: `frontend/src/pages/dashboard/ui/DashboardActivityColumn.vue` — remove reminder rendering
- Modify: `frontend/src/pages/dashboard/ui/DashboardSidePanel.vue` — remove reminder section
- Modify: `frontend/src/shared/api/invalidation.ts` — remove reminder invalidation if present

- [ ] **Step 1: Delete reminder directories**

Delete the three directories entirely.

- [ ] **Step 2: Clean up shared types and config**

In `database.types.ts`: remove `reminders` table type, `Reminder`, `ReminderInsert` exports.

In `routeNames.ts`: remove `NEW_REMINDER`, `REMINDER_DETAIL`, `REMINDERS_LIST`.

In `navigation.ts`: remove `'/reminders': 'home'` from `CHILD_ROUTE_MAP`.

- [ ] **Step 3: Remove reminder routes from router**

In `app/router/index.ts`: remove the three reminder routes (`reminders/new`, `reminders/:id`, `reminders`).

- [ ] **Step 4: Clean up dashboard**

In all dashboard files, remove all imports and references to `useReminders`, `ReminderCard`, `ReminderCardSkeleton`, `reminderQueryKeys`, and any rendering of reminders. Leave placeholder comments `// TODO: replace with subscriptions widget` where reminders were rendered.

- [ ] **Step 5: Verify frontend builds**

Run: `cd frontend && bun run build`
Expected: Zero errors. Some warnings about unused imports are OK at this stage; they'll be resolved in the next tasks.

---

## Task 8: Frontend — Recurring Subscription Entity (Types, API, Composables)

**Files:**
- Create: All files under `frontend/src/entities/recurring-subscription/`

- [ ] **Step 1: Create types**

Create `frontend/src/entities/recurring-subscription/model/types.ts`:

```typescript
export type SubscriptionFrequency = 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';
export type SubscriptionStatus = 'active' | 'paused';

export interface RecurringSubscription {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  amount: number;
  currency: string;
  account_id: string | null;
  icon: string;
  color: string;
  frequency: SubscriptionFrequency;
  frequency_days: number | null;
  billing_date: string;
  notify_days_before: number;
  category_id: string;
  auto_charge: boolean;
  status: SubscriptionStatus;
  created_at: string;
  updated_at: string;
}

export interface RecurringSubscriptionInsert {
  name: string;
  description?: string;
  amount: number;
  currency: string;
  account_id?: string;
  icon: string;
  color: string;
  frequency: SubscriptionFrequency;
  frequency_days?: number;
  billing_date: string;
  notify_days_before?: number;
  category_id?: string;
  auto_charge?: boolean;
}

export interface CalendarEntry {
  subscription: RecurringSubscription;
  dates: string[];
}
```

- [ ] **Step 2: Create constants**

Create `frontend/src/entities/recurring-subscription/model/constants.ts`:

```typescript
export interface ServicePreset {
  name: string;
  icon: string;
  color: string;
}

export const SERVICE_PRESETS: Record<string, ServicePreset> = {
  netflix: { name: 'Netflix', icon: 'netflix', color: '#e50914' },
  spotify: { name: 'Spotify', icon: 'spotify', color: '#1DB954' },
  youtube: { name: 'YouTube Premium', icon: 'youtube', color: '#FF0000' },
  apple_music: { name: 'Apple Music', icon: 'apple_music', color: '#FA2D48' },
  icloud: { name: 'iCloud', icon: 'icloud', color: '#3498db' },
  telegram: { name: 'Telegram Premium', icon: 'telegram', color: '#2AABEE' },
  yandex_plus: { name: 'Яндекс Плюс', icon: 'yandex_plus', color: '#FFCC00' },
  chatgpt: { name: 'ChatGPT Plus', icon: 'chatgpt', color: '#10A37F' },
};

export const FREQUENCY_LABELS: Record<string, string> = {
  weekly: 'Еженедельно',
  monthly: 'Ежемесячно',
  quarterly: 'Раз в квартал',
  yearly: 'Ежегодно',
  custom: 'Другое',
};

export const SUBSCRIPTION_ICONS = [
  'subscriptions', 'fitness_center', 'school', 'medical_services',
  'music_note', 'tv', 'sports_esports', 'movie', 'cloud',
  'laptop_mac', 'phone_android', 'wifi', 'electric_bolt',
] as const;
```

- [ ] **Step 3: Create utils**

Create `frontend/src/entities/recurring-subscription/model/utils.ts`:

```typescript
import type { RecurringSubscription, SubscriptionFrequency } from './types';

export function daysUntilBilling(billingDate: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const billing = new Date(billingDate);
  billing.setHours(0, 0, 0, 0);
  return Math.ceil((billing.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function formatFrequencyShort(frequency: SubscriptionFrequency, days?: number | null): string {
  switch (frequency) {
    case 'weekly': return '/нед';
    case 'monthly': return '/мес';
    case 'quarterly': return '/квартал';
    case 'yearly': return '/год';
    case 'custom': return `/${days ?? 30} дн`;
  }
}

export function isSubscriptionDueSoon(sub: RecurringSubscription, withinDays = 3): boolean {
  if (sub.status !== 'active') return false;
  const days = daysUntilBilling(sub.billing_date);
  return days >= 0 && days <= withinDays;
}

export function getNextBillingDate(
  currentDate: Date,
  frequency: SubscriptionFrequency,
  frequencyDays: number | null,
): Date {
  const next = new Date(currentDate);
  switch (frequency) {
    case 'weekly': next.setDate(next.getDate() + 7); break;
    case 'monthly': next.setMonth(next.getMonth() + 1); break;
    case 'quarterly': next.setMonth(next.getMonth() + 3); break;
    case 'yearly': next.setFullYear(next.getFullYear() + 1); break;
    case 'custom': next.setDate(next.getDate() + (frequencyDays ?? 30)); break;
  }
  return next;
}

export function computeBillingDatesForMonth(
  sub: RecurringSubscription,
  year: number,
  month: number,
): string[] {
  if (sub.status !== 'active') return [];

  const dates: string[] = [];
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);

  let current = new Date(sub.billing_date);
  // Rewind to before monthStart if needed
  while (current > monthEnd) {
    current = rewindDate(current, sub.frequency, sub.frequency_days);
  }
  // Advance to first date in or after monthStart
  while (current < monthStart) {
    current = getNextBillingDate(current, sub.frequency, sub.frequency_days);
  }
  // Collect all dates within the month
  while (current <= monthEnd) {
    dates.push(current.toISOString().split('T')[0]);
    current = getNextBillingDate(current, sub.frequency, sub.frequency_days);
  }

  return dates;
}

function rewindDate(
  date: Date,
  frequency: SubscriptionFrequency,
  frequencyDays: number | null,
): Date {
  const prev = new Date(date);
  switch (frequency) {
    case 'weekly': prev.setDate(prev.getDate() - 7); break;
    case 'monthly': prev.setMonth(prev.getMonth() - 1); break;
    case 'quarterly': prev.setMonth(prev.getMonth() - 3); break;
    case 'yearly': prev.setFullYear(prev.getFullYear() - 1); break;
    case 'custom': prev.setDate(prev.getDate() - (frequencyDays ?? 30)); break;
  }
  return prev;
}
```

- [ ] **Step 4: Create API layer**

Create `queryKeys.ts`, `recurringSubscriptionApi.ts`, `useRecurringSubscriptions.ts`, `useSubscriptionCalendar.ts`, `useUpcomingSubscriptions.ts` following the exact same patterns as the reminder entity API layer, but adapted for the new types and endpoints (`/recurring-subscriptions`). Include camelCase→snake_case transformations. Include optimistic updates for CRUD mutations + `pause`/`resume` mutations.

- [ ] **Step 5: Create index.ts**

Create `frontend/src/entities/recurring-subscription/index.ts` exporting all types, constants, utils, API, and UI components (UI components will be added in next task).

- [ ] **Step 6: Update database.types.ts**

Add `RecurringSubscription` and `RecurringSubscriptionInsert` type aliases or keep them in the entity-local types file (prefer entity-local since we're moving away from the centralized database.types pattern).

- [ ] **Step 7: Verify frontend builds**

Run: `cd frontend && bun run build`
Expected: Zero errors.

---

## Task 9: Frontend — Push Subscription Entity

**Files:**
- Create: All files under `frontend/src/entities/push-subscription/`

- [ ] **Step 1: Create types**

Create `frontend/src/entities/push-subscription/model/types.ts`:
```typescript
export interface PushSubscriptionData {
  id: string;
  endpoint: string;
  user_agent: string | null;
  created_at: string;
}
```

- [ ] **Step 2: Create API and composable**

Create `pushSubscriptionApi.ts` — register (POST) and unregister (DELETE) endpoints.

Create `usePushSubscription.ts` — composable that:
1. Checks `'Notification' in window` and `'PushManager' in window`
2. Exposes `permission` ref (computed from `Notification.permission`)
3. `requestPermission()` — calls `Notification.requestPermission()`, then subscribes via `pushManager.subscribe()` with VAPID public key (from `import.meta.env.VITE_VAPID_PUBLIC_KEY`), then registers on backend
4. `unsubscribe()` — unregisters on backend, unsubscribes from push manager
5. `isSupported` computed

- [ ] **Step 3: Create index.ts**

Export all from the entity.

- [ ] **Step 4: Add VITE_VAPID_PUBLIC_KEY to .env**

Add to `frontend/.env`: `VITE_VAPID_PUBLIC_KEY=` (to be filled with actual key).

---

## Task 10: Frontend — Subscription UI Components

**Files:**
- Create: `frontend/src/entities/recurring-subscription/ui/SubscriptionCard.vue`
- Create: `frontend/src/entities/recurring-subscription/ui/SubscriptionListItem.vue`
- Create: `frontend/src/entities/recurring-subscription/ui/SubscriptionCalendar.vue`
- Create: `frontend/src/entities/recurring-subscription/ui/SubscriptionCardSkeleton.vue`
- Modify: `frontend/src/shared/ui/icon/iconMap.ts` — add service preset icons

Use the `frontend-design` skill for this task to ensure high-quality, polished UI that matches the existing app design system. The components should follow the app's design tokens (semantic colors, spacing, typography from `frontend/DESIGN_SYSTEM.md`).

- [ ] **Step 1: Add service preset icons to iconMap**

In `iconMap.ts`, add entries for service presets that map to appropriate Lucide icons:
```typescript
// Service presets for subscriptions
netflix: Clapperboard,
spotify: Music,
youtube: Play,
apple_music: Music2,
icloud: Cloud,
telegram: Send,
yandex_plus: Star,
chatgpt: Bot,
```

- [ ] **Step 2: Create SubscriptionCard.vue**

Compact card showing subscription icon (with color bg), name, amount with frequency label, billing date countdown, status badge, auto-charge indicator. Follow `ReminderCard.vue` pattern for structure but with richer data display.

- [ ] **Step 3: Create SubscriptionListItem.vue**

List item for the calendar page — icon, name, date/countdown, account name, amount, "auto" badge. Used in the list below the calendar.

- [ ] **Step 4: Create SubscriptionCalendar.vue**

Mini month calendar component:
- Props: `subscriptions: RecurringSubscription[]`, `currentMonth: Date`
- Emits: `update:currentMonth`, `dayClick: [date: string]`
- Renders 7-column grid for the month
- Day cells show small subscription icons (from presets or iconMap)
- Days with subscriptions have colored background tint
- Max 2-3 icons per cell, "+N" if overflow
- Month navigation arrows in header
- Total monthly amount displayed

- [ ] **Step 5: Create SubscriptionCardSkeleton.vue**

Skeleton loading state matching SubscriptionCard layout.

- [ ] **Step 6: Update entity index.ts with UI exports**

- [ ] **Step 7: Verify build**

Run: `cd frontend && bun run build`

---

## Task 11: Frontend — Create/Edit Subscription Features

**Files:**
- Create: All files under `frontend/src/features/create-subscription/`
- Create: All files under `frontend/src/features/edit-subscription/`

- [ ] **Step 1: Create ServicePresetPicker.vue**

Grid of preset service cards (Netflix, Spotify, etc.) + "Custom" option. On selecting a preset, auto-fills name, icon, color. On "Custom", shows empty form. Follow the app's card/chip UI patterns.

- [ ] **Step 2: Create SubscriptionForm.vue**

Form with fields:
- Name (text input)
- Amount + Currency (side-by-side, currency selector)
- Account (AccountSelector from existing entity)
- Frequency (UTabs: weekly/monthly/quarterly/yearly/custom + frequency_days input for custom)
- Billing date (date input)
- Notify days before (number input, 1-30)
- Category (CategoryChips from existing entity, filtered to expense)
- Auto-charge toggle (UToggle)
- Description (optional text area)
- Icon + Color pickers (UIconSelector + UColorPicker, pre-filled if preset)

Follow the exact v-model pattern from `ReminderForm.vue`.

- [ ] **Step 3: Create useCreateSubscription composable**

Follow `useCreateReminder` pattern — form state, validation, submit via API, cache invalidation.

- [ ] **Step 4: Create useEditSubscription composable**

Load existing subscription, populate form, submit updates.

- [ ] **Step 5: Create EditSubscriptionForm.vue**

Reuse SubscriptionForm with pre-populated data + delete/pause/resume actions.

- [ ] **Step 6: Create index.ts for both features**

- [ ] **Step 7: Verify build**

Run: `cd frontend && bun run build`

---

## Task 12: Frontend — Pages and Routing

**Files:**
- Create: `frontend/src/pages/subscriptions/SubscriptionsPage.vue`
- Create: `frontend/src/pages/subscription-detail/SubscriptionDetailPage.vue`
- Modify: `frontend/src/shared/config/routeNames.ts` — add subscription route names
- Modify: `frontend/src/shared/config/navigation.ts` — add subscription child routes
- Modify: `frontend/src/app/router/index.ts` — add subscription routes

- [ ] **Step 1: Add route names**

In `routeNames.ts`:
```typescript
SUBSCRIPTIONS_LIST: 'subscriptions-list',
SUBSCRIPTION_DETAIL: 'subscription-detail',
NEW_SUBSCRIPTION: 'new-subscription',
```

- [ ] **Step 2: Add to CHILD_ROUTE_MAP**

In `navigation.ts`: add `'/subscriptions': 'home'`

- [ ] **Step 3: Create SubscriptionsPage.vue**

Page layout: `min-h-screen bg-background-light dark:bg-background-dark pb-28`
- Header with title "Подписки" + total monthly amount
- SubscriptionCalendar component
- Chronological list of SubscriptionListItems below
- FAB button to add new subscription
- Empty state if no subscriptions

- [ ] **Step 4: Create SubscriptionDetailPage.vue**

Detail view:
- Subscription card with full info
- Edit form (inline or separate route)
- Pause/Resume button
- Delete button with ConfirmDeleteModal
- History section (optional in v1)

- [ ] **Step 5: Add routes**

In `app/router/index.ts`, add under the authenticated routes:
```typescript
{
  path: 'subscriptions',
  name: ROUTE_NAMES.SUBSCRIPTIONS_LIST,
  component: () => import('@/pages/subscriptions/SubscriptionsPage.vue'),
},
{
  path: 'subscriptions/new',
  name: ROUTE_NAMES.NEW_SUBSCRIPTION,
  component: () => import('@/pages/subscription-detail/SubscriptionDetailPage.vue'),
  meta: { isNew: true },
},
{
  path: 'subscriptions/:id',
  name: ROUTE_NAMES.SUBSCRIPTION_DETAIL,
  component: () => import('@/pages/subscription-detail/SubscriptionDetailPage.vue'),
},
```

- [ ] **Step 6: Verify build and test navigation**

Run: `cd frontend && bun run build`

---

## Task 13: Frontend — Dashboard Widget + Integration

**Files:**
- Create: `frontend/src/widgets/upcoming-subscriptions/ui/UpcomingSubscriptions.vue`
- Create: `frontend/src/widgets/upcoming-subscriptions/ui/UpcomingSubscriptionsSkeleton.vue`
- Create: `frontend/src/widgets/upcoming-subscriptions/index.ts`
- Modify: `frontend/src/pages/dashboard/DashboardPage.vue`
- Modify: `frontend/src/pages/dashboard/model/useDashboardData.ts`
- Modify: `frontend/src/pages/dashboard/model/useDashboardNavigation.ts`
- Modify: `frontend/src/pages/dashboard/ui/DashboardActivityColumn.vue`
- Modify: `frontend/src/pages/dashboard/ui/DashboardSidePanel.vue`
- Modify: `frontend/src/shared/api/invalidation.ts`

- [ ] **Step 1: Create invalidateSubscriptionRelated helper**

In `invalidation.ts`, add:
```typescript
export async function invalidateSubscriptionRelated(queryClient: QueryClient, userId: string) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: recurringSubscriptionQueryKeys.all }),
  ]);
}
```

- [ ] **Step 2: Create UpcomingSubscriptions widget**

Shows up to 3 nearest upcoming subscriptions as `SubscriptionCard` items + "Все подписки" ViewAllButton linking to `/subscriptions`. Use `useUpcomingSubscriptions(userId, 7)`.

- [ ] **Step 3: Create UpcomingSubscriptionsSkeleton**

3x SubscriptionCardSkeleton items.

- [ ] **Step 4: Integrate into dashboard**

Replace the reminder-related TODO comments with the new UpcomingSubscriptions widget. Wire up `useDashboardData` to use `useUpcomingSubscriptions` instead of `useReminders`. Update navigation helpers to use subscription routes.

- [ ] **Step 5: Verify build**

Run: `cd frontend && bun run build`

---

## Task 14: Frontend — Push Notification Feature + Service Worker

**Files:**
- Create: `frontend/src/features/manage-push-notifications/`
- Create: `frontend/src/shared/lib/service-worker/push-handler.ts`
- Modify: `frontend/vite.config.ts` — add custom SW injection for push

- [ ] **Step 1: Create PushNotificationToggle component**

Toggle switch that:
- Shows current permission state
- On enable: requests permission → subscribes → registers on backend
- On disable: unsubscribes → unregisters on backend
- Disabled state if browser doesn't support push

- [ ] **Step 2: Create usePushNotificationSettings composable**

Wraps `usePushSubscription` with profile-level toggle state.

- [ ] **Step 3: Add push handler to Service Worker**

In `vite.config.ts`, add to `VitePWA` config:
```typescript
injectManifest: {
  // If using injectManifest strategy
}
```

Or add custom SW code via `workbox` config. The push handler code:

```typescript
// In custom SW or via workbox injection
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Ouro Finance', {
      body: data.body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-192x192.png',
      data: { url: data.url ?? '/' },
      tag: data.tag,
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/';
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow(url);
    }),
  );
});
```

- [ ] **Step 4: Add toggle to profile page**

Find the profile/settings page and add `PushNotificationToggle` component in an appropriate section.

- [ ] **Step 5: Verify build**

Run: `cd frontend && bun run build`

---

## Task 15: Full Integration Testing

- [ ] **Step 1: Backend build verification**

Run: `cd backend && bun run build`
Expected: Zero errors.

- [ ] **Step 2: Backend test suite**

Run: `cd backend && bun run test`
Expected: All existing tests pass.

- [ ] **Step 3: Frontend build verification**

Run: `cd frontend && bun run build`
Expected: Zero errors and zero TypeScript errors.

- [ ] **Step 4: Backend lint**

Run: `cd backend && bun run lint`
Expected: No lint errors.

- [ ] **Step 5: Manual smoke test**

Start dev environment: `bun run dev`
Test:
1. Create a subscription (Netflix, $15, monthly)
2. View calendar page — verify icon appears on correct date
3. Edit subscription — change amount
4. Pause/resume subscription
5. Check dashboard widget shows upcoming subscriptions
6. Delete subscription

---

## Task 16: Post-Implementation Review

- [ ] **Step 1: Run /simplify (first pass)**

Invoke the `simplify` skill to review all changed code for reuse, quality, and efficiency.

- [ ] **Step 2: Fix any issues found by simplify**

- [ ] **Step 3: Run /simplify (second pass)**

Invoke `simplify` skill again on the updated code.

- [ ] **Step 4: Fix any remaining issues**

- [ ] **Step 5: Run /crq**

Invoke the `crq` skill for code review quality check.

- [ ] **Step 6: Fix any issues found by crq**
