# Monetization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a soft paywall with LemonSqueezy-powered Premium subscription to the Ouro finance app.

**Architecture:** New `subscription` bounded context in backend (DDD + CQRS), new `subscription` entity + `upgrade-to-premium` and `manage-subscription` features on frontend (FSD). LemonSqueezy handles payments as Merchant of Record. Webhook-driven subscription lifecycle.

**Tech Stack:** NestJS, TypeORM, LemonSqueezy API + webhooks, Vue 3, TanStack Query, Tailwind CSS v4, Reka UI

**Design doc:** `docs/plans/2026-02-22-monetization-design.md`

---

## Task 1: Backend — Database Migration

**Files:**
- Create: `backend/src/modules/subscription/infrastructure/persistence/typeorm/user-subscription.orm-entity.ts`
- Modify: `backend/src/config/data-source.ts` (add entity to entities array)
- Migration: auto-generated

**Step 1: Create the ORM entity**

```typescript
// backend/src/modules/subscription/infrastructure/persistence/typeorm/user-subscription.orm-entity.ts
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('user_subscriptions')
export class UserSubscriptionOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid', unique: true })
  userId: string;

  @Column({ name: 'lemon_customer_id', type: 'varchar', nullable: true })
  lemonCustomerId: string | null;

  @Column({ name: 'lemon_subscription_id', type: 'varchar', nullable: true })
  lemonSubscriptionId: string | null;

  @Column({ name: 'variant_id', type: 'varchar', nullable: true })
  variantId: string | null;

  @Column({ type: 'varchar', default: 'free' })
  plan: string;

  @Column({ type: 'varchar', default: 'active' })
  status: string;

  @Column({ name: 'trial_start', type: 'timestamp', nullable: true })
  trialStart: Date | null;

  @Column({ name: 'trial_end', type: 'timestamp', nullable: true })
  trialEnd: Date | null;

  @Column({ name: 'current_period_start', type: 'timestamp', nullable: true })
  currentPeriodStart: Date | null;

  @Column({ name: 'current_period_end', type: 'timestamp', nullable: true })
  currentPeriodEnd: Date | null;

  @Column({ name: 'cancel_at_period_end', type: 'boolean', default: false })
  cancelAtPeriodEnd: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

**Step 2: Create barrel exports**

```typescript
// backend/src/modules/subscription/infrastructure/persistence/typeorm/index.ts
export * from './user-subscription.orm-entity';

// backend/src/modules/subscription/infrastructure/persistence/index.ts
export * from './typeorm';
export * from './mappers';
export * from './repositories';

// backend/src/modules/subscription/infrastructure/index.ts
export * from './persistence';
```

**Step 3: Register in data-source.ts**

Add `UserSubscriptionOrmEntity` to the entities array in `backend/src/config/data-source.ts`.

**Step 4: Generate migration**

Run: `cd backend && bun run migration:generate src/database/migrations/CreateUserSubscriptions`

**Step 5: Verify migration SQL**

Read the generated migration file. Expected: `CREATE TABLE user_subscriptions (...)` with all columns.

**Step 6: Run migration**

Run: `cd backend && bun run migration:run`

**Step 7: Commit**

```bash
git add backend/src/modules/subscription/infrastructure/persistence/typeorm/
git add backend/src/config/data-source.ts
git add backend/src/database/migrations/
git commit -m "feat(subscription): add user_subscriptions table and ORM entity"
```

---

## Task 2: Backend — Domain Layer

**Files:**
- Create: `backend/src/modules/subscription/domain/aggregates/user-subscription/user-subscription.aggregate.ts`
- Create: `backend/src/modules/subscription/domain/value-objects/subscription-plan.vo.ts`
- Create: `backend/src/modules/subscription/domain/value-objects/subscription-status.vo.ts`
- Create: `backend/src/modules/subscription/domain/repositories/user-subscription.repository.interface.ts`
- Create: barrel `index.ts` files for each directory

**Step 1: Create SubscriptionPlan value object**

```typescript
// backend/src/modules/subscription/domain/value-objects/subscription-plan.vo.ts
import { ValueObject } from '../../../../shared/domain/base';

type SubscriptionPlanValue = 'free' | 'premium_monthly' | 'premium_yearly';

interface SubscriptionPlanProps {
  value: SubscriptionPlanValue;
}

export class SubscriptionPlan extends ValueObject<SubscriptionPlanProps> {
  static readonly FREE = new SubscriptionPlan({ value: 'free' });
  static readonly PREMIUM_MONTHLY = new SubscriptionPlan({ value: 'premium_monthly' });
  static readonly PREMIUM_YEARLY = new SubscriptionPlan({ value: 'premium_yearly' });

  private constructor(props: SubscriptionPlanProps) {
    super(props);
  }

  static create(value: string): SubscriptionPlan {
    if (!['free', 'premium_monthly', 'premium_yearly'].includes(value)) {
      throw new Error(`Invalid subscription plan: ${value}`);
    }
    return new SubscriptionPlan({ value: value as SubscriptionPlanValue });
  }

  get value(): SubscriptionPlanValue { return this.props.value; }
  isFree(): boolean { return this.props.value === 'free'; }
  isPremium(): boolean { return this.props.value !== 'free'; }
  toString(): string { return this.props.value; }
}
```

**Step 2: Create SubscriptionStatus value object**

```typescript
// backend/src/modules/subscription/domain/value-objects/subscription-status.vo.ts
import { ValueObject } from '../../../../shared/domain/base';

type SubscriptionStatusValue = 'active' | 'trialing' | 'canceled' | 'past_due' | 'expired';

interface SubscriptionStatusProps {
  value: SubscriptionStatusValue;
}

export class SubscriptionStatus extends ValueObject<SubscriptionStatusProps> {
  static readonly ACTIVE = new SubscriptionStatus({ value: 'active' });
  static readonly TRIALING = new SubscriptionStatus({ value: 'trialing' });
  static readonly CANCELED = new SubscriptionStatus({ value: 'canceled' });
  static readonly PAST_DUE = new SubscriptionStatus({ value: 'past_due' });
  static readonly EXPIRED = new SubscriptionStatus({ value: 'expired' });

  private constructor(props: SubscriptionStatusProps) {
    super(props);
  }

  static create(value: string): SubscriptionStatus {
    if (!['active', 'trialing', 'canceled', 'past_due', 'expired'].includes(value)) {
      throw new Error(`Invalid subscription status: ${value}`);
    }
    return new SubscriptionStatus({ value: value as SubscriptionStatusValue });
  }

  get value(): SubscriptionStatusValue { return this.props.value; }
  isAccessGranted(): boolean { return ['active', 'trialing'].includes(this.props.value); }
  toString(): string { return this.props.value; }
}
```

**Step 3: Create UserSubscription aggregate**

```typescript
// backend/src/modules/subscription/domain/aggregates/user-subscription/user-subscription.aggregate.ts
import { AggregateRoot } from '../../../../../shared/domain/base';
import { SubscriptionPlan } from '../../value-objects/subscription-plan.vo';
import { SubscriptionStatus } from '../../value-objects/subscription-status.vo';

export interface UserSubscriptionProps {
  id: string;
  userId: string;
  lemonCustomerId: string | null;
  lemonSubscriptionId: string | null;
  variantId: string | null;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  trialStart: Date | null;
  trialEnd: Date | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class UserSubscription extends AggregateRoot<string> {
  private _userId: string;
  private _lemonCustomerId: string | null;
  private _lemonSubscriptionId: string | null;
  private _variantId: string | null;
  private _plan: SubscriptionPlan;
  private _status: SubscriptionStatus;
  private _trialStart: Date | null;
  private _trialEnd: Date | null;
  private _currentPeriodStart: Date | null;
  private _currentPeriodEnd: Date | null;
  private _cancelAtPeriodEnd: boolean;
  private _createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: UserSubscriptionProps) {
    super(props.id);
    this._userId = props.userId;
    this._lemonCustomerId = props.lemonCustomerId;
    this._lemonSubscriptionId = props.lemonSubscriptionId;
    this._variantId = props.variantId;
    this._plan = props.plan;
    this._status = props.status;
    this._trialStart = props.trialStart;
    this._trialEnd = props.trialEnd;
    this._currentPeriodStart = props.currentPeriodStart;
    this._currentPeriodEnd = props.currentPeriodEnd;
    this._cancelAtPeriodEnd = props.cancelAtPeriodEnd;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  static createFree(id: string, userId: string): UserSubscription {
    return new UserSubscription({
      id,
      userId,
      lemonCustomerId: null,
      lemonSubscriptionId: null,
      variantId: null,
      plan: SubscriptionPlan.FREE,
      status: SubscriptionStatus.ACTIVE,
      trialStart: null,
      trialEnd: null,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  static reconstitute(props: UserSubscriptionProps): UserSubscription {
    return new UserSubscription(props);
  }

  // Getters
  get userId(): string { return this._userId; }
  get lemonCustomerId(): string | null { return this._lemonCustomerId; }
  get lemonSubscriptionId(): string | null { return this._lemonSubscriptionId; }
  get variantId(): string | null { return this._variantId; }
  get planValue(): string { return this._plan.value; }
  get statusValue(): string { return this._status.value; }
  get trialStart(): Date | null { return this._trialStart; }
  get trialEnd(): Date | null { return this._trialEnd; }
  get currentPeriodStart(): Date | null { return this._currentPeriodStart; }
  get currentPeriodEnd(): Date | null { return this._currentPeriodEnd; }
  get cancelAtPeriodEnd(): boolean { return this._cancelAtPeriodEnd; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }

  isPremium(): boolean { return this._plan.isPremium() && this._status.isAccessGranted(); }

  activate(data: {
    lemonCustomerId: string;
    lemonSubscriptionId: string;
    variantId: string;
    plan: string;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    trialStart?: Date | null;
    trialEnd?: Date | null;
    status?: string;
  }): void {
    this._lemonCustomerId = data.lemonCustomerId;
    this._lemonSubscriptionId = data.lemonSubscriptionId;
    this._variantId = data.variantId;
    this._plan = SubscriptionPlan.create(data.plan);
    this._status = SubscriptionStatus.create(data.status ?? 'active');
    this._currentPeriodStart = data.currentPeriodStart;
    this._currentPeriodEnd = data.currentPeriodEnd;
    this._trialStart = data.trialStart ?? null;
    this._trialEnd = data.trialEnd ?? null;
    this._cancelAtPeriodEnd = false;
    this._updatedAt = new Date();
  }

  updateStatus(status: string): void {
    this._status = SubscriptionStatus.create(status);
    this._updatedAt = new Date();
  }

  updatePeriod(start: Date, end: Date): void {
    this._currentPeriodStart = start;
    this._currentPeriodEnd = end;
    this._updatedAt = new Date();
  }

  markCancelAtPeriodEnd(): void {
    this._cancelAtPeriodEnd = true;
    this._updatedAt = new Date();
  }

  deactivate(): void {
    this._plan = SubscriptionPlan.FREE;
    this._status = SubscriptionStatus.EXPIRED;
    this._lemonSubscriptionId = null;
    this._variantId = null;
    this._cancelAtPeriodEnd = false;
    this._updatedAt = new Date();
  }
}
```

**Step 4: Create repository interface**

```typescript
// backend/src/modules/subscription/domain/repositories/user-subscription.repository.interface.ts
import type { UserSubscription } from '../aggregates/user-subscription/user-subscription.aggregate';

export const USER_SUBSCRIPTION_REPOSITORY = Symbol('USER_SUBSCRIPTION_REPOSITORY');

export interface IUserSubscriptionRepository {
  findById(id: string): Promise<UserSubscription | null>;
  findByUserId(userId: string): Promise<UserSubscription | null>;
  findByLemonSubscriptionId(lemonSubscriptionId: string): Promise<UserSubscription | null>;
  save(subscription: UserSubscription): Promise<UserSubscription>;
}
```

**Step 5: Create all barrel index.ts files**

Create `index.ts` files for: `domain/aggregates/user-subscription/`, `domain/aggregates/`, `domain/value-objects/`, `domain/repositories/`, `domain/`.

**Step 6: Commit**

```bash
git add backend/src/modules/subscription/domain/
git commit -m "feat(subscription): add domain layer — aggregate, value objects, repository interface"
```

---

## Task 3: Backend — Infrastructure Layer (Mapper + Repository)

**Files:**
- Create: `backend/src/modules/subscription/infrastructure/persistence/mappers/user-subscription.mapper.ts`
- Create: `backend/src/modules/subscription/infrastructure/persistence/repositories/user-subscription.repository.ts`

**Step 1: Create mapper**

```typescript
// backend/src/modules/subscription/infrastructure/persistence/mappers/user-subscription.mapper.ts
import { UserSubscription } from '../../../domain/aggregates/user-subscription/user-subscription.aggregate';
import { SubscriptionPlan } from '../../../domain/value-objects/subscription-plan.vo';
import { SubscriptionStatus } from '../../../domain/value-objects/subscription-status.vo';
import { UserSubscriptionOrmEntity } from '../typeorm/user-subscription.orm-entity';

export class UserSubscriptionMapper {
  static toDomain(orm: UserSubscriptionOrmEntity): UserSubscription {
    return UserSubscription.reconstitute({
      id: orm.id,
      userId: orm.userId,
      lemonCustomerId: orm.lemonCustomerId,
      lemonSubscriptionId: orm.lemonSubscriptionId,
      variantId: orm.variantId,
      plan: SubscriptionPlan.create(orm.plan),
      status: SubscriptionStatus.create(orm.status),
      trialStart: orm.trialStart,
      trialEnd: orm.trialEnd,
      currentPeriodStart: orm.currentPeriodStart,
      currentPeriodEnd: orm.currentPeriodEnd,
      cancelAtPeriodEnd: orm.cancelAtPeriodEnd,
      createdAt: orm.createdAt,
      updatedAt: orm.updatedAt,
    });
  }

  static toOrm(sub: UserSubscription): UserSubscriptionOrmEntity {
    const orm = new UserSubscriptionOrmEntity();
    orm.id = sub.id;
    orm.userId = sub.userId;
    orm.lemonCustomerId = sub.lemonCustomerId;
    orm.lemonSubscriptionId = sub.lemonSubscriptionId;
    orm.variantId = sub.variantId;
    orm.plan = sub.planValue;
    orm.status = sub.statusValue;
    orm.trialStart = sub.trialStart;
    orm.trialEnd = sub.trialEnd;
    orm.currentPeriodStart = sub.currentPeriodStart;
    orm.currentPeriodEnd = sub.currentPeriodEnd;
    orm.cancelAtPeriodEnd = sub.cancelAtPeriodEnd;
    orm.createdAt = sub.createdAt;
    orm.updatedAt = sub.updatedAt;
    return orm;
  }
}
```

**Step 2: Create repository implementation**

```typescript
// backend/src/modules/subscription/infrastructure/persistence/repositories/user-subscription.repository.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserSubscription } from '../../../domain/aggregates/user-subscription/user-subscription.aggregate';
import { IUserSubscriptionRepository } from '../../../domain/repositories/user-subscription.repository.interface';
import { UserSubscriptionOrmEntity } from '../typeorm/user-subscription.orm-entity';
import { UserSubscriptionMapper } from '../mappers/user-subscription.mapper';

@Injectable()
export class UserSubscriptionRepository implements IUserSubscriptionRepository {
  constructor(
    @InjectRepository(UserSubscriptionOrmEntity)
    private readonly ormRepository: Repository<UserSubscriptionOrmEntity>,
  ) {}

  async findById(id: string): Promise<UserSubscription | null> {
    const orm = await this.ormRepository.findOne({ where: { id } });
    return orm ? UserSubscriptionMapper.toDomain(orm) : null;
  }

  async findByUserId(userId: string): Promise<UserSubscription | null> {
    const orm = await this.ormRepository.findOne({ where: { userId } });
    return orm ? UserSubscriptionMapper.toDomain(orm) : null;
  }

  async findByLemonSubscriptionId(lemonSubscriptionId: string): Promise<UserSubscription | null> {
    const orm = await this.ormRepository.findOne({ where: { lemonSubscriptionId } });
    return orm ? UserSubscriptionMapper.toDomain(orm) : null;
  }

  async save(subscription: UserSubscription): Promise<UserSubscription> {
    const orm = UserSubscriptionMapper.toOrm(subscription);
    const saved = await this.ormRepository.save(orm);
    return UserSubscriptionMapper.toDomain(saved);
  }
}
```

**Step 3: Create barrel index.ts files for mappers/ and repositories/**

**Step 4: Commit**

```bash
git add backend/src/modules/subscription/infrastructure/
git commit -m "feat(subscription): add infrastructure layer — mapper and repository"
```

---

## Task 4: Backend — LemonSqueezy Service

**Files:**
- Create: `backend/src/modules/subscription/infrastructure/lemonsqueezy/lemonsqueezy.service.ts`
- Create: `backend/src/modules/subscription/infrastructure/lemonsqueezy/lemonsqueezy-webhook.service.ts`
- Create: `backend/src/modules/subscription/infrastructure/lemonsqueezy/index.ts`

**Step 1: Install @lemonsqueezy/lemonsqueezy.js**

Run: `cd backend && bun add @lemonsqueezy/lemonsqueezy.js`

**Step 2: Create LemonSqueezy service**

```typescript
// backend/src/modules/subscription/infrastructure/lemonsqueezy/lemonsqueezy.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  lemonSqueezySetup,
  createCheckout,
  getSubscription,
  cancelSubscription,
  type Checkout,
} from '@lemonsqueezy/lemonsqueezy.js';

@Injectable()
export class LemonSqueezyService {
  private readonly storeId: string;
  private readonly monthlyVariantId: string;
  private readonly yearlyVariantId: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.getOrThrow<string>('LEMONSQUEEZY_API_KEY');
    this.storeId = this.configService.getOrThrow<string>('LEMONSQUEEZY_STORE_ID');
    this.monthlyVariantId = this.configService.getOrThrow<string>('LEMONSQUEEZY_PREMIUM_MONTHLY_VARIANT_ID');
    this.yearlyVariantId = this.configService.getOrThrow<string>('LEMONSQUEEZY_PREMIUM_YEARLY_VARIANT_ID');

    lemonSqueezySetup({ apiKey });
  }

  async createCheckoutUrl(params: {
    userId: string;
    userEmail: string;
    userName: string;
    plan: 'premium_monthly' | 'premium_yearly';
  }): Promise<string> {
    const variantId = params.plan === 'premium_monthly'
      ? this.monthlyVariantId
      : this.yearlyVariantId;

    const { data, error } = await createCheckout(this.storeId, variantId, {
      checkoutData: {
        email: params.userEmail,
        name: params.userName,
        custom: {
          user_id: params.userId,
        },
      },
      productOptions: {
        enabledVariants: [Number(variantId)],
      },
    });

    if (error) throw new Error(`LemonSqueezy checkout error: ${error.message}`);
    return data.data.attributes.url;
  }

  async getSubscriptionDetails(subscriptionId: string) {
    const { data, error } = await getSubscription(subscriptionId);
    if (error) throw new Error(`LemonSqueezy subscription error: ${error.message}`);
    return data.data;
  }

  async cancelLemonSubscription(subscriptionId: string) {
    const { data, error } = await cancelSubscription(subscriptionId);
    if (error) throw new Error(`LemonSqueezy cancel error: ${error.message}`);
    return data.data;
  }
}
```

**Step 3: Create webhook verification service**

```typescript
// backend/src/modules/subscription/infrastructure/lemonsqueezy/lemonsqueezy-webhook.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

export interface LemonSqueezyWebhookEvent {
  meta: {
    event_name: string;
    custom_data?: { user_id?: string };
  };
  data: {
    id: string;
    type: string;
    attributes: {
      store_id: number;
      customer_id: number;
      variant_id: number;
      status: string;
      trial_ends_at: string | null;
      renews_at: string | null;
      ends_at: string | null;
      created_at: string;
      updated_at: string;
    };
  };
}

@Injectable()
export class LemonSqueezyWebhookService {
  private readonly webhookSecret: string;

  constructor(private readonly configService: ConfigService) {
    this.webhookSecret = this.configService.getOrThrow<string>('LEMONSQUEEZY_WEBHOOK_SECRET');
  }

  verifySignature(rawBody: Buffer, signature: string): boolean {
    const hmac = crypto.createHmac('sha256', this.webhookSecret);
    const digest = hmac.update(rawBody).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
  }

  parseEvent(rawBody: Buffer): LemonSqueezyWebhookEvent {
    return JSON.parse(rawBody.toString());
  }
}
```

**Step 4: Create barrel, commit**

```bash
git add backend/src/modules/subscription/infrastructure/lemonsqueezy/
git add backend/package.json backend/bun.lockb
git commit -m "feat(subscription): add LemonSqueezy service and webhook verification"
```

---

## Task 5: Backend — Application Layer (Commands + Queries)

**Files:**
- Create: `backend/src/modules/subscription/application/commands/create-checkout/create-checkout.command.ts`
- Create: `backend/src/modules/subscription/application/commands/create-checkout/create-checkout.handler.ts`
- Create: `backend/src/modules/subscription/application/commands/handle-webhook/handle-webhook.command.ts`
- Create: `backend/src/modules/subscription/application/commands/handle-webhook/handle-webhook.handler.ts`
- Create: `backend/src/modules/subscription/application/queries/get-subscription-status/get-subscription-status.query.ts`
- Create: `backend/src/modules/subscription/application/queries/get-subscription-status/get-subscription-status.handler.ts`
- Create: barrel `index.ts` files

**Step 1: Create checkout command + handler**

```typescript
// create-checkout.command.ts
export class CreateCheckoutCommand {
  constructor(
    public readonly userId: string,
    public readonly userEmail: string,
    public readonly userName: string,
    public readonly plan: 'premium_monthly' | 'premium_yearly',
  ) {}
}

// create-checkout.handler.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { CreateCheckoutCommand } from './create-checkout.command';
import { IUserSubscriptionRepository, USER_SUBSCRIPTION_REPOSITORY } from '../../../domain/repositories';
import { LemonSqueezyService } from '../../../infrastructure/lemonsqueezy/lemonsqueezy.service';
import { UserSubscription } from '../../../domain/aggregates/user-subscription/user-subscription.aggregate';

@CommandHandler(CreateCheckoutCommand)
export class CreateCheckoutHandler implements ICommandHandler<CreateCheckoutCommand> {
  constructor(
    @Inject(USER_SUBSCRIPTION_REPOSITORY)
    private readonly subscriptionRepository: IUserSubscriptionRepository,
    private readonly lemonSqueezyService: LemonSqueezyService,
  ) {}

  async execute(command: CreateCheckoutCommand): Promise<{ checkoutUrl: string }> {
    // Ensure user has a subscription record (create free if not exists)
    let subscription = await this.subscriptionRepository.findByUserId(command.userId);
    if (!subscription) {
      subscription = UserSubscription.createFree(crypto.randomUUID(), command.userId);
      await this.subscriptionRepository.save(subscription);
    }

    const checkoutUrl = await this.lemonSqueezyService.createCheckoutUrl({
      userId: command.userId,
      userEmail: command.userEmail,
      userName: command.userName,
      plan: command.plan,
    });

    return { checkoutUrl };
  }
}
```

**Step 2: Create webhook handler command + handler**

```typescript
// handle-webhook.command.ts
export class HandleWebhookCommand {
  constructor(
    public readonly rawBody: Buffer,
    public readonly signature: string,
  ) {}
}

// handle-webhook.handler.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, UnauthorizedException, Logger } from '@nestjs/common';
import { HandleWebhookCommand } from './handle-webhook.command';
import { IUserSubscriptionRepository, USER_SUBSCRIPTION_REPOSITORY } from '../../../domain/repositories';
import { LemonSqueezyWebhookService } from '../../../infrastructure/lemonsqueezy/lemonsqueezy-webhook.service';
import { UserSubscription } from '../../../domain/aggregates/user-subscription/user-subscription.aggregate';

@CommandHandler(HandleWebhookCommand)
export class HandleWebhookHandler implements ICommandHandler<HandleWebhookCommand> {
  private readonly logger = new Logger(HandleWebhookHandler.name);

  constructor(
    @Inject(USER_SUBSCRIPTION_REPOSITORY)
    private readonly subscriptionRepository: IUserSubscriptionRepository,
    private readonly webhookService: LemonSqueezyWebhookService,
  ) {}

  async execute(command: HandleWebhookCommand): Promise<void> {
    if (!this.webhookService.verifySignature(command.rawBody, command.signature)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    const event = this.webhookService.parseEvent(command.rawBody);
    const eventName = event.meta.event_name;
    const attrs = event.data.attributes;
    const userId = event.meta.custom_data?.user_id;

    this.logger.log(`Webhook received: ${eventName} for user ${userId}`);

    switch (eventName) {
      case 'subscription_created':
      case 'subscription_updated': {
        if (!userId) {
          this.logger.warn('No user_id in webhook custom_data');
          return;
        }

        let subscription = await this.subscriptionRepository.findByUserId(userId);
        if (!subscription) {
          subscription = UserSubscription.createFree(crypto.randomUUID(), userId);
        }

        const plan = this.variantToPlan(attrs.variant_id);
        const status = this.mapLemonStatus(attrs.status);

        subscription.activate({
          lemonCustomerId: String(attrs.customer_id),
          lemonSubscriptionId: event.data.id,
          variantId: String(attrs.variant_id),
          plan,
          status,
          currentPeriodStart: new Date(attrs.created_at),
          currentPeriodEnd: attrs.renews_at ? new Date(attrs.renews_at) : new Date(attrs.ends_at ?? attrs.created_at),
          trialStart: attrs.trial_ends_at ? new Date(attrs.created_at) : null,
          trialEnd: attrs.trial_ends_at ? new Date(attrs.trial_ends_at) : null,
        });

        await this.subscriptionRepository.save(subscription);
        break;
      }

      case 'subscription_cancelled': {
        const subscription = await this.findSubscription(event.data.id, userId);
        if (subscription) {
          subscription.markCancelAtPeriodEnd();
          await this.subscriptionRepository.save(subscription);
        }
        break;
      }

      case 'subscription_expired': {
        const subscription = await this.findSubscription(event.data.id, userId);
        if (subscription) {
          subscription.deactivate();
          await this.subscriptionRepository.save(subscription);
        }
        break;
      }

      case 'subscription_payment_failed': {
        const subscription = await this.findSubscription(event.data.id, userId);
        if (subscription) {
          subscription.updateStatus('past_due');
          await this.subscriptionRepository.save(subscription);
        }
        break;
      }

      default:
        this.logger.log(`Unhandled webhook event: ${eventName}`);
    }
  }

  private async findSubscription(lemonSubId: string, userId?: string) {
    let sub = await this.subscriptionRepository.findByLemonSubscriptionId(lemonSubId);
    if (!sub && userId) {
      sub = await this.subscriptionRepository.findByUserId(userId);
    }
    return sub;
  }

  private variantToPlan(variantId: number): string {
    // Will be configured via env vars; for now check against known IDs
    const monthlyId = process.env.LEMONSQUEEZY_PREMIUM_MONTHLY_VARIANT_ID;
    const yearlyId = process.env.LEMONSQUEEZY_PREMIUM_YEARLY_VARIANT_ID;
    if (String(variantId) === monthlyId) return 'premium_monthly';
    if (String(variantId) === yearlyId) return 'premium_yearly';
    return 'premium_monthly'; // fallback
  }

  private mapLemonStatus(lemonStatus: string): string {
    const statusMap: Record<string, string> = {
      active: 'active',
      on_trial: 'trialing',
      cancelled: 'canceled',
      past_due: 'past_due',
      expired: 'expired',
      paused: 'canceled',
    };
    return statusMap[lemonStatus] ?? 'active';
  }
}
```

**Step 3: Create subscription status query + handler**

```typescript
// get-subscription-status.query.ts
export class GetSubscriptionStatusQuery {
  constructor(public readonly userId: string) {}
}

// get-subscription-status.handler.ts
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetSubscriptionStatusQuery } from './get-subscription-status.query';
import { IUserSubscriptionRepository, USER_SUBSCRIPTION_REPOSITORY } from '../../../domain/repositories';

@QueryHandler(GetSubscriptionStatusQuery)
export class GetSubscriptionStatusHandler implements IQueryHandler<GetSubscriptionStatusQuery> {
  constructor(
    @Inject(USER_SUBSCRIPTION_REPOSITORY)
    private readonly subscriptionRepository: IUserSubscriptionRepository,
  ) {}

  async execute(query: GetSubscriptionStatusQuery) {
    const subscription = await this.subscriptionRepository.findByUserId(query.userId);

    if (!subscription) {
      return {
        plan: 'free',
        status: 'active',
        isPremium: false,
        trialEnd: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      };
    }

    return {
      plan: subscription.planValue,
      status: subscription.statusValue,
      isPremium: subscription.isPremium(),
      trialEnd: subscription.trialEnd?.toISOString() ?? null,
      currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    };
  }
}
```

**Step 4: Create barrel index.ts files with CommandHandlers and QueryHandlers arrays**

```typescript
// application/commands/index.ts
export * from './create-checkout/create-checkout.command';
export * from './create-checkout/create-checkout.handler';
export * from './handle-webhook/handle-webhook.command';
export * from './handle-webhook/handle-webhook.handler';

import { CreateCheckoutHandler } from './create-checkout/create-checkout.handler';
import { HandleWebhookHandler } from './handle-webhook/handle-webhook.handler';

export const CommandHandlers = [CreateCheckoutHandler, HandleWebhookHandler];

// application/queries/index.ts
export * from './get-subscription-status/get-subscription-status.query';
export * from './get-subscription-status/get-subscription-status.handler';

import { GetSubscriptionStatusHandler } from './get-subscription-status/get-subscription-status.handler';

export const QueryHandlers = [GetSubscriptionStatusHandler];
```

**Step 5: Commit**

```bash
git add backend/src/modules/subscription/application/
git commit -m "feat(subscription): add application layer — checkout, webhook, and status query"
```

---

## Task 6: Backend — Presentation Layer (Controller + DTOs) + Premium Guard

**Files:**
- Create: `backend/src/modules/subscription/presentation/controllers/subscription.controller.ts`
- Create: `backend/src/modules/subscription/presentation/dto/create-checkout.dto.ts`
- Create: `backend/src/modules/subscription/guards/premium.guard.ts`

**Step 1: Create DTO**

```typescript
// create-checkout.dto.ts
import { IsIn } from 'class-validator';

export class CreateCheckoutDto {
  @IsIn(['premium_monthly', 'premium_yearly'])
  plan: 'premium_monthly' | 'premium_yearly';
}
```

**Step 2: Create controller**

```typescript
// subscription.controller.ts
import { Controller, Get, Post, Body, Req, Res, RawBodyRequest, HttpCode, HttpStatus } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { Request, Response } from 'express';
import { CurrentUser } from '../../../../common';
import { Public } from '../../../../common/decorators/public.decorator';
import { CreateCheckoutDto } from '../dto/create-checkout.dto';
import { CreateCheckoutCommand } from '../../application/commands';
import { HandleWebhookCommand } from '../../application/commands';
import { GetSubscriptionStatusQuery } from '../../application/queries';

@Controller('subscription')
export class SubscriptionController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get('status')
  async getStatus(@CurrentUser('sub') userId: string) {
    return this.queryBus.execute(new GetSubscriptionStatusQuery(userId));
  }

  @Post('checkout')
  async createCheckout(
    @CurrentUser() user: { sub: string; email?: string },
    @Body() dto: CreateCheckoutDto,
  ) {
    return this.commandBus.execute(
      new CreateCheckoutCommand(user.sub, user.email ?? '', '', dto.plan),
    );
  }

  @Public()
  @Post('webhooks/lemonsqueezy')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Req() req: RawBodyRequest<Request>) {
    const signature = req.headers['x-signature'] as string;
    if (!signature) return { received: false };

    await this.commandBus.execute(
      new HandleWebhookCommand(req.rawBody!, signature),
    );

    return { received: true };
  }
}
```

**Step 3: Create Premium Guard**

```typescript
// backend/src/modules/subscription/guards/premium.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { IUserSubscriptionRepository, USER_SUBSCRIPTION_REPOSITORY } from '../domain/repositories';

@Injectable()
export class PremiumGuard implements CanActivate {
  constructor(
    @Inject(USER_SUBSCRIPTION_REPOSITORY)
    private readonly subscriptionRepository: IUserSubscriptionRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.sub;
    if (!userId) throw new ForbiddenException('Authentication required');

    const subscription = await this.subscriptionRepository.findByUserId(userId);
    if (!subscription || !subscription.isPremium()) {
      throw new ForbiddenException('Premium subscription required');
    }

    return true;
  }
}
```

**Step 4: Create barrel files, commit**

```bash
git add backend/src/modules/subscription/presentation/ backend/src/modules/subscription/guards/
git commit -m "feat(subscription): add controller, DTOs, and PremiumGuard"
```

---

## Task 7: Backend — Module Wiring + Raw Body Config

**Files:**
- Create: `backend/src/modules/subscription/subscription.module.ts`
- Create: `backend/src/modules/subscription/index.ts`
- Modify: `backend/src/app.module.ts` (add SubscriptionModule + entity)
- Modify: `backend/src/main.ts` (enable rawBody for webhooks)

**Step 1: Create SubscriptionModule**

```typescript
// backend/src/modules/subscription/subscription.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigModule } from '@nestjs/config';

import { USER_SUBSCRIPTION_REPOSITORY } from './domain/repositories';
import { CommandHandlers } from './application/commands';
import { QueryHandlers } from './application/queries';
import { UserSubscriptionOrmEntity } from './infrastructure/persistence/typeorm';
import { UserSubscriptionRepository } from './infrastructure/persistence/repositories';
import { LemonSqueezyService } from './infrastructure/lemonsqueezy/lemonsqueezy.service';
import { LemonSqueezyWebhookService } from './infrastructure/lemonsqueezy/lemonsqueezy-webhook.service';
import { SubscriptionController } from './presentation/controllers/subscription.controller';
import { PremiumGuard } from './guards/premium.guard';

@Module({
  imports: [
    CqrsModule,
    ConfigModule,
    TypeOrmModule.forFeature([UserSubscriptionOrmEntity]),
  ],
  controllers: [SubscriptionController],
  providers: [
    { provide: USER_SUBSCRIPTION_REPOSITORY, useClass: UserSubscriptionRepository },
    ...CommandHandlers,
    ...QueryHandlers,
    LemonSqueezyService,
    LemonSqueezyWebhookService,
    PremiumGuard,
  ],
  exports: [USER_SUBSCRIPTION_REPOSITORY, PremiumGuard],
})
export class SubscriptionModule {}
```

**Step 2: Register in app.module.ts**

Add `SubscriptionModule` to imports and `UserSubscriptionOrmEntity` to entities array.

**Step 3: Enable rawBody in main.ts**

In `NestFactory.create()`, add `{ rawBody: true }` option so webhook controller can access `req.rawBody`.

**Step 4: Add env vars to .env.example**

```
LEMONSQUEEZY_API_KEY=
LEMONSQUEEZY_WEBHOOK_SECRET=
LEMONSQUEEZY_STORE_ID=
LEMONSQUEEZY_PREMIUM_MONTHLY_VARIANT_ID=
LEMONSQUEEZY_PREMIUM_YEARLY_VARIANT_ID=
```

**Step 5: Build and verify**

Run: `cd backend && bun run build`
Expected: Successful compilation.

**Step 6: Commit**

```bash
git add backend/src/modules/subscription/ backend/src/app.module.ts backend/src/config/data-source.ts backend/src/main.ts backend/.env.example
git commit -m "feat(subscription): wire SubscriptionModule into app with raw body support"
```

---

## Task 8: Frontend — Subscription Entity (Types + API + Composable)

**Files:**
- Create: `frontend/src/entities/subscription/model/types.ts`
- Create: `frontend/src/entities/subscription/model/constants.ts`
- Create: `frontend/src/entities/subscription/api/queryKeys.ts`
- Create: `frontend/src/entities/subscription/api/subscriptionApi.ts`
- Create: `frontend/src/entities/subscription/api/useSubscription.ts`
- Create: `frontend/src/entities/subscription/api/index.ts`
- Create: `frontend/src/entities/subscription/index.ts`

**Step 1: Create types**

```typescript
// frontend/src/entities/subscription/model/types.ts
export type SubscriptionPlan = 'free' | 'premium_monthly' | 'premium_yearly';
export type SubscriptionStatusValue = 'active' | 'trialing' | 'canceled' | 'past_due' | 'expired';

export interface SubscriptionStatus {
  plan: SubscriptionPlan;
  status: SubscriptionStatusValue;
  is_premium: boolean;
  trial_end: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}
```

**Step 2: Create constants**

```typescript
// frontend/src/entities/subscription/model/constants.ts
export const PLAN_LABELS: Record<string, string> = {
  free: 'Бесплатный',
  premium_monthly: 'Premium (месяц)',
  premium_yearly: 'Premium (год)',
};

export const PLAN_PRICES: Record<string, string> = {
  premium_monthly: '$2.99/мес',
  premium_yearly: '$16.99/год',
};

export const PREMIUM_FEATURES = [
  { icon: 'trending_up', label: 'Расширенная аналитика', description: 'Тренды, сравнение месяцев, прогнозы' },
  { icon: 'download', label: 'Экспорт данных', description: 'PDF и Excel отчёты' },
  { icon: 'repeat', label: 'Рекуррентные транзакции', description: 'Автоматическое создание повторяющихся транзакций' },
  { icon: 'account_balance_wallet', label: 'Бюджеты по категориям', description: 'Лимиты с уведомлениями' },
  { icon: 'palette', label: 'Темы оформления', description: 'Дополнительные варианты внешнего вида' },
  { icon: 'new_releases', label: 'Ранний доступ', description: 'Новые функции раньше всех' },
];
```

**Step 3: Create query keys**

```typescript
// frontend/src/entities/subscription/api/queryKeys.ts
export const subscriptionQueryKeys = {
  all: ['subscription'] as const,
  status: (userId: string) => [...subscriptionQueryKeys.all, 'status', userId] as const,
};
```

**Step 4: Create API layer**

```typescript
// frontend/src/entities/subscription/api/subscriptionApi.ts
import { http } from '@/shared/api/http';
import type { SubscriptionStatus } from '../model/types';

interface SubscriptionStatusResponse {
  plan: string;
  status: string;
  isPremium: boolean;
  trialEnd: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

function transformStatus(s: SubscriptionStatusResponse): SubscriptionStatus {
  return {
    plan: s.plan as SubscriptionStatus['plan'],
    status: s.status as SubscriptionStatus['status'],
    is_premium: s.isPremium,
    trial_end: s.trialEnd,
    current_period_end: s.currentPeriodEnd,
    cancel_at_period_end: s.cancelAtPeriodEnd,
  };
}

export const subscriptionApi = {
  async getStatus(): Promise<SubscriptionStatus> {
    const data = await http.get<SubscriptionStatusResponse>('/subscription/status');
    return transformStatus(data);
  },

  async createCheckout(plan: 'premium_monthly' | 'premium_yearly'): Promise<{ checkout_url: string }> {
    const data = await http.post<{ checkoutUrl: string }>('/subscription/checkout', { plan });
    return { checkout_url: data.checkoutUrl };
  },
};
```

**Step 5: Create Vue Query composable**

```typescript
// frontend/src/entities/subscription/api/useSubscription.ts
import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { subscriptionQueryKeys } from './queryKeys';
import { subscriptionApi } from './subscriptionApi';
import type { SubscriptionStatus } from '../model/types';

export function useSubscription(userId: MaybeRefOrGetter<string | null>) {
  const queryClient = useQueryClient();

  const queryKey = computed(() => {
    const uid = toValue(userId);
    return uid ? subscriptionQueryKeys.status(uid) : subscriptionQueryKeys.all;
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: () => subscriptionApi.getStatus(),
    enabled: computed(() => !!toValue(userId)),
    staleTime: 5 * 60 * 1000, // 5 min
  });

  const subscription = computed<SubscriptionStatus>(() => data.value ?? {
    plan: 'free',
    status: 'active',
    is_premium: false,
    trial_end: null,
    current_period_end: null,
    cancel_at_period_end: false,
  });

  const isPremium = computed(() => subscription.value.is_premium);

  async function refreshSubscription() {
    await queryClient.invalidateQueries({ queryKey: queryKey.value });
  }

  return {
    subscription,
    isPremium,
    isLoading,
    error,
    refetch,
    refreshSubscription,
  };
}
```

**Step 6: Create barrel files**

```typescript
// frontend/src/entities/subscription/api/index.ts
export * from './queryKeys';
export * from './subscriptionApi';
export * from './useSubscription';

// frontend/src/entities/subscription/index.ts
export * from './api';
export * from './model/types';
export * from './model/constants';
```

**Step 7: Commit**

```bash
git add frontend/src/entities/subscription/
git commit -m "feat(subscription): add frontend subscription entity — types, API, Vue Query composable"
```

---

## Task 9: Frontend — Premium Feature Composable

**Files:**
- Create: `frontend/src/shared/lib/composables/usePremiumFeature.ts`
- Modify: `frontend/src/shared/lib/composables/index.ts` (add export)

**Step 1: Create usePremiumFeature composable**

```typescript
// frontend/src/shared/lib/composables/usePremiumFeature.ts
import { ref } from 'vue';
import { useSubscription } from '@/entities/subscription';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';

const showUpgradeModal = ref(false);
const upgradeFeatureName = ref('');

export function usePremiumFeature() {
  const { userId } = useCurrentUser();
  const { isPremium, subscription } = useSubscription(userId);

  function requirePremium(featureName: string): boolean {
    if (isPremium.value) return true;
    upgradeFeatureName.value = featureName;
    showUpgradeModal.value = true;
    return false;
  }

  return {
    isPremium,
    subscription,
    showUpgradeModal,
    upgradeFeatureName,
    requirePremium,
  };
}
```

**Step 2: Export from composables barrel**

**Step 3: Commit**

```bash
git add frontend/src/shared/lib/composables/
git commit -m "feat(subscription): add usePremiumFeature composable for soft paywall"
```

---

## Task 10: Frontend — Upgrade to Premium Feature

**Files:**
- Create: `frontend/src/features/upgrade-to-premium/ui/PremiumBadge.vue`
- Create: `frontend/src/features/upgrade-to-premium/ui/PremiumUpgradeModal.vue`
- Create: `frontend/src/features/upgrade-to-premium/model/useUpgrade.ts`
- Create: `frontend/src/features/upgrade-to-premium/index.ts`

**Step 1: Create PremiumBadge component**

```vue
<!-- frontend/src/features/upgrade-to-premium/ui/PremiumBadge.vue -->
<script setup lang="ts">
import { UBadge } from '@/shared/ui';
</script>

<template>
  <UBadge variant="warning" size="xs" shape="pill">Premium</UBadge>
</template>
```

**Step 2: Create useUpgrade composable**

```typescript
// frontend/src/features/upgrade-to-premium/model/useUpgrade.ts
import { ref } from 'vue';
import { subscriptionApi } from '@/entities/subscription';
import { useToast } from '@/shared/ui';

export function useUpgrade() {
  const { toast } = useToast();
  const isLoading = ref(false);

  async function startCheckout(plan: 'premium_monthly' | 'premium_yearly') {
    isLoading.value = true;
    try {
      const { checkout_url } = await subscriptionApi.createCheckout(plan);
      // Open LemonSqueezy checkout overlay
      if (window.LemonSqueezy) {
        window.LemonSqueezy.Url.Open(checkout_url);
      } else {
        // Fallback: open in new tab
        window.open(checkout_url, '_blank');
      }
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось открыть страницу оплаты', variant: 'error' });
    } finally {
      isLoading.value = false;
    }
  }

  return { isLoading, startCheckout };
}
```

**Step 3: Create PremiumUpgradeModal**

```vue
<!-- frontend/src/features/upgrade-to-premium/ui/PremiumUpgradeModal.vue -->
<script setup lang="ts">
import { UModal, UButton, UIcon } from '@/shared/ui';
import { PREMIUM_FEATURES, PLAN_PRICES } from '@/entities/subscription';
import { useUpgrade } from '../model/useUpgrade';

defineProps<{
  modelValue: boolean;
  featureName?: string;
}>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>();

const { isLoading, startCheckout } = useUpgrade();

function handlePurchase(plan: 'premium_monthly' | 'premium_yearly') {
  startCheckout(plan);
  emit('update:modelValue', false);
}
</script>

<template>
  <UModal
    :model-value="modelValue"
    title="Ouro Premium"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="space-y-5">
      <p v-if="featureName" class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
        Функция «{{ featureName }}» доступна с Premium-подпиской.
      </p>

      <div class="space-y-3">
        <div
          v-for="feature in PREMIUM_FEATURES"
          :key="feature.label"
          class="flex items-start gap-3"
        >
          <UIcon :name="feature.icon" size="sm" class="text-brand-primary mt-0.5" />
          <div>
            <p class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
              {{ feature.label }}
            </p>
            <p class="text-xs text-text-secondary-light dark:text-text-secondary-dark">
              {{ feature.description }}
            </p>
          </div>
        </div>
      </div>

      <p class="text-xs text-center text-text-tertiary-light dark:text-text-tertiary-dark">
        7 дней бесплатно, затем от {{ PLAN_PRICES.premium_monthly }}
      </p>
    </div>

    <template #actions>
      <UButton
        variant="primary"
        full-width
        :loading="isLoading"
        @click="handlePurchase('premium_yearly')"
      >
        {{ PLAN_PRICES.premium_yearly }} — выгоднее
      </UButton>
      <UButton
        variant="secondary"
        full-width
        :loading="isLoading"
        @click="handlePurchase('premium_monthly')"
      >
        {{ PLAN_PRICES.premium_monthly }}
      </UButton>
    </template>
  </UModal>
</template>
```

**Step 4: Create barrel, add LemonSqueezy types + script tag**

```typescript
// frontend/src/features/upgrade-to-premium/index.ts
export { default as PremiumBadge } from './ui/PremiumBadge.vue';
export { default as PremiumUpgradeModal } from './ui/PremiumUpgradeModal.vue';
export { useUpgrade } from './model/useUpgrade';
```

Add to `frontend/index.html` before `</body>`:
```html
<script src="https://app.lemonsqueezy.com/js/lemon.js" defer></script>
```

Add LemonSqueezy type declaration in `frontend/src/env.d.ts` or a new `.d.ts`:
```typescript
interface Window {
  LemonSqueezy?: {
    Url: { Open: (url: string) => void };
  };
  createLemonSqueezy?: () => void;
}
```

**Step 5: Commit**

```bash
git add frontend/src/features/upgrade-to-premium/ frontend/index.html frontend/src/env.d.ts
git commit -m "feat(subscription): add PremiumUpgradeModal, PremiumBadge, and LemonSqueezy JS SDK"
```

---

## Task 11: Frontend — Manage Subscription Feature (Profile Section)

**Files:**
- Create: `frontend/src/features/manage-subscription/ui/SubscriptionSection.vue`
- Create: `frontend/src/features/manage-subscription/index.ts`
- Modify: `frontend/src/pages/profile/ProfilePage.vue` (add subscription section)

**Step 1: Create SubscriptionSection**

```vue
<!-- frontend/src/features/manage-subscription/ui/SubscriptionSection.vue -->
<script setup lang="ts">
import { computed, ref } from 'vue';
import { UCard, UButton, UBadge, UIcon } from '@/shared/ui';
import { useSubscription, PLAN_LABELS } from '@/entities/subscription';
import { PremiumUpgradeModal } from '@/features/upgrade-to-premium';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import { formatDate } from '@/shared/lib/format/date';

const { userId } = useCurrentUser();
const { subscription, isPremium } = useSubscription(userId);

const showUpgrade = ref(false);

const statusBadgeVariant = computed(() => {
  if (isPremium.value) return 'success';
  return 'neutral';
});

const statusLabel = computed(() => {
  if (subscription.value.status === 'trialing') return 'Пробный период';
  if (subscription.value.cancel_at_period_end) return 'Отменена';
  return isPremium.value ? 'Активна' : 'Бесплатный';
});
</script>

<template>
  <div>
    <h2 class="text-sm font-semibold text-text-secondary-light dark:text-text-secondary-dark px-2 mb-2 uppercase tracking-wider">
      Подписка
    </h2>
    <UCard class="p-4 space-y-3">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <UIcon name="workspace_premium" size="sm" class="text-brand-primary" />
          <span class="font-medium text-text-primary-light dark:text-text-primary-dark">
            {{ PLAN_LABELS[subscription.plan] || 'Бесплатный' }}
          </span>
        </div>
        <UBadge :variant="statusBadgeVariant" size="sm" shape="pill">
          {{ statusLabel }}
        </UBadge>
      </div>

      <p
        v-if="isPremium && subscription.current_period_end"
        class="text-xs text-text-secondary-light dark:text-text-secondary-dark"
      >
        {{ subscription.cancel_at_period_end ? 'Действует до' : 'Следующая оплата' }}:
        {{ formatDate(subscription.current_period_end) }}
      </p>

      <UButton
        v-if="!isPremium"
        variant="primary"
        full-width
        @click="showUpgrade = true"
      >
        Перейти на Premium
      </UButton>
    </UCard>

    <PremiumUpgradeModal v-model="showUpgrade" />
  </div>
</template>
```

**Step 2: Add to profile page**

In `ProfilePage.vue`, import `SubscriptionSection` from `@/features/manage-subscription` and add it as a section between existing groups.

**Step 3: Create barrel, commit**

```bash
git add frontend/src/features/manage-subscription/ frontend/src/pages/profile/
git commit -m "feat(subscription): add subscription management section to profile page"
```

---

## Task 12: Frontend — Wire PremiumUpgradeModal into App + Add Icon Mappings

**Files:**
- Modify: `frontend/src/app/App.vue` or layout — add global PremiumUpgradeModal
- Modify: `frontend/src/shared/ui/icon/iconMap.ts` — add new icon mappings

**Step 1: Add new icon mappings**

Add to `iconMap.ts`: `workspace_premium`, `trending_up`, `download`, `repeat`, `account_balance_wallet`, `palette`, `new_releases` → appropriate Lucide icons.

**Step 2: Add global PremiumUpgradeModal**

In the main layout (where `<Toaster />` is), add:
```vue
<PremiumUpgradeModal
  v-model="showUpgradeModal"
  :feature-name="upgradeFeatureName"
/>
```

Wire it with the `usePremiumFeature()` composable's reactive state.

**Step 3: Verify build**

Run: `cd frontend && bun run build`
Expected: Successful build.

**Step 4: Commit**

```bash
git add frontend/src/app/ frontend/src/shared/ui/icon/iconMap.ts
git commit -m "feat(subscription): wire global upgrade modal and add icon mappings"
```

---

## Task 13: Update Changelog

**Files:**
- Modify: `frontend/src/features/changelog/model/changelogData.ts`

**Step 1: Add changelog entry**

Bump patch version and add entry at top of `CHANGELOG_ENTRIES`:

```typescript
{
  version: '1.0.19',
  date: '2026-02-22',
  entries: [
    {
      type: 'feature',
      description: 'Добавлена подписка Premium с расширенной аналитикой, экспортом данных и другими возможностями',
    },
  ],
},
```

**Step 2: Commit**

```bash
git add frontend/src/features/changelog/
git commit -m "docs: add Premium subscription to changelog"
```

---

## Task 14: Backend Tests

**Files:**
- Create: `backend/src/modules/subscription/application/commands/create-checkout/create-checkout.handler.spec.ts`
- Create: `backend/src/modules/subscription/application/commands/handle-webhook/handle-webhook.handler.spec.ts`
- Create: `backend/src/modules/subscription/application/queries/get-subscription-status/get-subscription-status.handler.spec.ts`

**Step 1: Write tests for GetSubscriptionStatusHandler**

Test cases:
- Returns free plan when no subscription exists
- Returns premium status when subscription is active
- Returns trial info when subscription is trialing

**Step 2: Write tests for CreateCheckoutHandler**

Test cases:
- Creates free subscription if none exists and returns checkout URL
- Returns checkout URL for existing user

**Step 3: Write tests for HandleWebhookHandler**

Test cases:
- Rejects invalid signature
- Handles `subscription_created` event correctly
- Handles `subscription_cancelled` event correctly
- Handles `subscription_expired` event correctly

**Step 4: Run tests**

Run: `cd backend && bun run test -- --testPathPattern=subscription`
Expected: All tests pass.

**Step 5: Commit**

```bash
git add backend/src/modules/subscription/
git commit -m "test(subscription): add unit tests for commands and queries"
```

---

## Task 15: Final Verification + Env Setup

**Step 1: Verify backend builds**

Run: `cd backend && bun run build`

**Step 2: Verify frontend builds**

Run: `cd frontend && bun run build`

**Step 3: Verify backend lint**

Run: `cd backend && bun run lint`

**Step 4: Document LemonSqueezy setup steps**

Update `backend/.env.example` with all new env vars and add a comment about manual LemonSqueezy setup.

**Step 5: Final commit if any remaining changes**

```bash
git add -A && git commit -m "chore(subscription): finalize build verification and env setup"
```
