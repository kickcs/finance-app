# Quick Actions Server-Side Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move quick actions from localStorage to server-side storage with database table + CRUD API, sync hidden/hintDismissed via profile fields, and migrate existing localStorage data.

**Architecture:** New `quick_actions` table in accounting module with full DDD structure (domain entity, repository, commands/queries, controller). Profile entity extended with two boolean fields. Frontend replaces localStorage composable with Vue Query composable.

**Tech Stack:** NestJS, TypeORM, PostgreSQL, Vue 3, TanStack Vue Query, class-validator

**IMPORTANT:** Do NOT commit or push. After all tasks complete, run `/crq` twice.

---

### Task 1: Database Migration — quick_actions table + profile fields

**Files:**
- Create: `backend/src/database/migrations/1740787200000-AddQuickActions.ts`

**Step 1: Create migration file**

```typescript
import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddQuickActions1740787200000 implements MigrationInterface {
  name = 'AddQuickActions1740787200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "quick_actions" (
        "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
        "user_id" uuid NOT NULL,
        "category_id" uuid NOT NULL,
        "account_id" uuid NOT NULL,
        "label" varchar NOT NULL,
        "position" smallint NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_quick_actions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_quick_actions_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_quick_actions_category" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_quick_actions_account" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_quick_actions_user_id" ON "quick_actions" ("user_id")`);
    await queryRunner.query(`ALTER TABLE "profiles" ADD COLUMN "quick_actions_hidden" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "profiles" ADD COLUMN "quick_actions_hint_dismissed" boolean NOT NULL DEFAULT false`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "profiles" DROP COLUMN "quick_actions_hint_dismissed"`);
    await queryRunner.query(`ALTER TABLE "profiles" DROP COLUMN "quick_actions_hidden"`);
    await queryRunner.query(`DROP INDEX "IDX_quick_actions_user_id"`);
    await queryRunner.query(`DROP TABLE "quick_actions"`);
  }
}
```

**Step 2: Run migration**

Run: `cd backend && bun run migration:run`
Expected: Migration applies successfully

---

### Task 2: Backend — QuickAction domain entity + repository

**Files:**
- Create: `backend/src/modules/accounting/domain/aggregates/quick-action/quick-action.aggregate.ts`
- Create: `backend/src/modules/accounting/domain/aggregates/quick-action/index.ts`
- Create: `backend/src/modules/accounting/domain/repositories/quick-action.repository.interface.ts`
- Modify: `backend/src/modules/accounting/domain/repositories/index.ts`

**Step 1: Create domain entity**

File: `backend/src/modules/accounting/domain/aggregates/quick-action/quick-action.aggregate.ts`

```typescript
import { AggregateRoot } from '../../../../../shared/domain/base/aggregate-root.base';

export interface QuickActionProps {
  id: string;
  userId: string;
  categoryId: string;
  accountId: string;
  label: string;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

export class QuickAction extends AggregateRoot<string> {
  private _userId: string;
  private _categoryId: string;
  private _accountId: string;
  private _label: string;
  private _position: number;
  private _createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: QuickActionProps) {
    super(props.id);
    this._userId = props.userId;
    this._categoryId = props.categoryId;
    this._accountId = props.accountId;
    this._label = props.label;
    this._position = props.position;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  static create(
    id: string,
    userId: string,
    categoryId: string,
    accountId: string,
    label: string,
    position: number,
  ): QuickAction {
    return new QuickAction({
      id,
      userId,
      categoryId,
      accountId,
      label,
      position,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  static reconstitute(props: QuickActionProps): QuickAction {
    return new QuickAction(props);
  }

  get userId(): string { return this._userId; }
  get categoryId(): string { return this._categoryId; }
  get accountId(): string { return this._accountId; }
  get label(): string { return this._label; }
  get position(): number { return this._position; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }

  update(data: { categoryId?: string; accountId?: string; label?: string }): void {
    if (data.categoryId !== undefined) this._categoryId = data.categoryId;
    if (data.accountId !== undefined) this._accountId = data.accountId;
    if (data.label !== undefined) this._label = data.label;
    this._updatedAt = new Date();
  }

  setPosition(position: number): void {
    this._position = position;
    this._updatedAt = new Date();
  }
}
```

File: `backend/src/modules/accounting/domain/aggregates/quick-action/index.ts`
```typescript
export { QuickAction } from './quick-action.aggregate';
export type { QuickActionProps } from './quick-action.aggregate';
```

**Step 2: Create repository interface**

File: `backend/src/modules/accounting/domain/repositories/quick-action.repository.interface.ts`

```typescript
import type { QuickAction } from '../aggregates/quick-action';

export const QUICK_ACTION_REPOSITORY = Symbol('QUICK_ACTION_REPOSITORY');

export interface IQuickActionRepository {
  findByUserId(userId: string): Promise<QuickAction[]>;
  findById(id: string): Promise<QuickAction | null>;
  save(quickAction: QuickAction): Promise<QuickAction>;
  saveMany(quickActions: QuickAction[]): Promise<QuickAction[]>;
  delete(id: string): Promise<void>;
  countByUserId(userId: string): Promise<number>;
}
```

**Step 3: Export from repositories index**

Add to `backend/src/modules/accounting/domain/repositories/index.ts`:
```typescript
export { QUICK_ACTION_REPOSITORY, type IQuickActionRepository } from './quick-action.repository.interface';
```

---

### Task 3: Backend — ORM entity, mapper, repository implementation

**Files:**
- Create: `backend/src/modules/accounting/infrastructure/persistence/typeorm/quick-action.orm-entity.ts`
- Modify: `backend/src/modules/accounting/infrastructure/persistence/typeorm/index.ts`
- Create: `backend/src/modules/accounting/infrastructure/persistence/mappers/quick-action.mapper.ts`
- Create: `backend/src/modules/accounting/infrastructure/persistence/repositories/quick-action.repository.ts`
- Modify: `backend/src/modules/accounting/infrastructure/persistence/repositories/index.ts`
- Modify: `backend/src/config/data-source.ts`

**Step 1: Create ORM entity**

File: `backend/src/modules/accounting/infrastructure/persistence/typeorm/quick-action.orm-entity.ts`

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('quick_actions')
export class QuickActionOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'category_id', type: 'uuid' })
  categoryId: string;

  @Column({ name: 'account_id', type: 'uuid' })
  accountId: string;

  @Column({ type: 'varchar' })
  label: string;

  @Column({ type: 'smallint', default: 0 })
  position: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;
}
```

Export from `backend/src/modules/accounting/infrastructure/persistence/typeorm/index.ts` — add:
```typescript
export { QuickActionOrmEntity } from './quick-action.orm-entity';
```

**Step 2: Create mapper**

File: `backend/src/modules/accounting/infrastructure/persistence/mappers/quick-action.mapper.ts`

```typescript
import { QuickAction } from '../../../domain/aggregates/quick-action';
import { QuickActionOrmEntity } from '../typeorm/quick-action.orm-entity';

export class QuickActionMapper {
  static toDomain(orm: QuickActionOrmEntity): QuickAction {
    return QuickAction.reconstitute({
      id: orm.id,
      userId: orm.userId,
      categoryId: orm.categoryId,
      accountId: orm.accountId,
      label: orm.label,
      position: orm.position,
      createdAt: orm.createdAt,
      updatedAt: orm.updatedAt,
    });
  }

  static toOrm(domain: QuickAction): QuickActionOrmEntity {
    const orm = new QuickActionOrmEntity();
    orm.id = domain.id;
    orm.userId = domain.userId;
    orm.categoryId = domain.categoryId;
    orm.accountId = domain.accountId;
    orm.label = domain.label;
    orm.position = domain.position;
    orm.createdAt = domain.createdAt;
    orm.updatedAt = domain.updatedAt;
    return orm;
  }
}
```

**Step 3: Create repository implementation**

File: `backend/src/modules/accounting/infrastructure/persistence/repositories/quick-action.repository.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { IQuickActionRepository } from '../../../domain/repositories/quick-action.repository.interface';
import { QuickAction } from '../../../domain/aggregates/quick-action';
import { QuickActionOrmEntity } from '../typeorm/quick-action.orm-entity';
import { QuickActionMapper } from '../mappers/quick-action.mapper';

@Injectable()
export class QuickActionRepository implements IQuickActionRepository {
  constructor(
    @InjectRepository(QuickActionOrmEntity)
    private readonly ormRepository: Repository<QuickActionOrmEntity>,
  ) {}

  async findByUserId(userId: string): Promise<QuickAction[]> {
    const entities = await this.ormRepository.find({
      where: { userId },
      order: { position: 'ASC', createdAt: 'ASC' },
    });
    return entities.map(QuickActionMapper.toDomain);
  }

  async findById(id: string): Promise<QuickAction | null> {
    const entity = await this.ormRepository.findOne({ where: { id } });
    return entity ? QuickActionMapper.toDomain(entity) : null;
  }

  async save(quickAction: QuickAction): Promise<QuickAction> {
    const orm = QuickActionMapper.toOrm(quickAction);
    const saved = await this.ormRepository.save(orm);
    return QuickActionMapper.toDomain(saved);
  }

  async saveMany(quickActions: QuickAction[]): Promise<QuickAction[]> {
    const orms = quickActions.map(QuickActionMapper.toOrm);
    const saved = await this.ormRepository.save(orms);
    return saved.map(QuickActionMapper.toDomain);
  }

  async delete(id: string): Promise<void> {
    await this.ormRepository.delete(id);
  }

  async countByUserId(userId: string): Promise<number> {
    return this.ormRepository.count({ where: { userId } });
  }
}
```

Export from `backend/src/modules/accounting/infrastructure/persistence/repositories/index.ts` — add:
```typescript
export { QuickActionRepository } from './quick-action.repository';
```

**Step 4: Register in data-source.ts**

Add import and entity to `backend/src/config/data-source.ts`:
```typescript
import { QuickActionOrmEntity } from '../modules/accounting/infrastructure/persistence/typeorm';
// Add to entities array
```

---

### Task 4: Backend — Commands (create, update, delete, reorder)

**Files:**
- Create: `backend/src/modules/accounting/application/commands/create-quick-action/create-quick-action.command.ts`
- Create: `backend/src/modules/accounting/application/commands/create-quick-action/create-quick-action.handler.ts`
- Create: `backend/src/modules/accounting/application/commands/update-quick-action/update-quick-action.command.ts`
- Create: `backend/src/modules/accounting/application/commands/update-quick-action/update-quick-action.handler.ts`
- Create: `backend/src/modules/accounting/application/commands/delete-quick-action/delete-quick-action.command.ts`
- Create: `backend/src/modules/accounting/application/commands/delete-quick-action/delete-quick-action.handler.ts`
- Create: `backend/src/modules/accounting/application/commands/reorder-quick-actions/reorder-quick-actions.command.ts`
- Create: `backend/src/modules/accounting/application/commands/reorder-quick-actions/reorder-quick-actions.handler.ts`
- Modify: `backend/src/modules/accounting/application/commands/index.ts`

**Step 1: Create command**

File: `create-quick-action.command.ts`
```typescript
export class CreateQuickActionCommand {
  constructor(
    public readonly userId: string,
    public readonly categoryId: string,
    public readonly accountId: string,
    public readonly label: string,
  ) {}
}
```

**Step 2: Create handler**

File: `create-quick-action.handler.ts`
```typescript
import * as crypto from 'crypto';
import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException } from '@nestjs/common';
import { CreateQuickActionCommand } from './create-quick-action.command';
import {
  QUICK_ACTION_REPOSITORY,
  type IQuickActionRepository,
} from '../../../domain/repositories/quick-action.repository.interface';
import { QuickAction } from '../../../domain/aggregates/quick-action';

const MAX_QUICK_ACTIONS = 4;

@CommandHandler(CreateQuickActionCommand)
export class CreateQuickActionHandler implements ICommandHandler<CreateQuickActionCommand> {
  constructor(
    @Inject(QUICK_ACTION_REPOSITORY)
    private readonly quickActionRepository: IQuickActionRepository,
  ) {}

  async execute(command: CreateQuickActionCommand) {
    const count = await this.quickActionRepository.countByUserId(command.userId);
    if (count >= MAX_QUICK_ACTIONS) {
      throw new BadRequestException('Maximum of 4 quick actions allowed');
    }

    const quickAction = QuickAction.create(
      crypto.randomUUID(),
      command.userId,
      command.categoryId,
      command.accountId,
      command.label,
      count, // next position
    );

    const saved = await this.quickActionRepository.save(quickAction);

    return {
      id: saved.id,
      userId: saved.userId,
      categoryId: saved.categoryId,
      accountId: saved.accountId,
      label: saved.label,
      position: saved.position,
      createdAt: saved.createdAt.toISOString(),
      updatedAt: saved.updatedAt.toISOString(),
    };
  }
}
```

**Step 3: Update command + handler**

File: `update-quick-action.command.ts`
```typescript
export class UpdateQuickActionCommand {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly data: {
      categoryId?: string;
      accountId?: string;
      label?: string;
    },
  ) {}
}
```

File: `update-quick-action.handler.ts`
```typescript
import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { NotFoundException } from '@nestjs/common';
import { UpdateQuickActionCommand } from './update-quick-action.command';
import {
  QUICK_ACTION_REPOSITORY,
  type IQuickActionRepository,
} from '../../../domain/repositories/quick-action.repository.interface';

@CommandHandler(UpdateQuickActionCommand)
export class UpdateQuickActionHandler implements ICommandHandler<UpdateQuickActionCommand> {
  constructor(
    @Inject(QUICK_ACTION_REPOSITORY)
    private readonly quickActionRepository: IQuickActionRepository,
  ) {}

  async execute(command: UpdateQuickActionCommand) {
    const quickAction = await this.quickActionRepository.findById(command.id);
    if (!quickAction || quickAction.userId !== command.userId) {
      throw new NotFoundException('Quick action not found');
    }

    quickAction.update(command.data);
    const saved = await this.quickActionRepository.save(quickAction);

    return {
      id: saved.id,
      userId: saved.userId,
      categoryId: saved.categoryId,
      accountId: saved.accountId,
      label: saved.label,
      position: saved.position,
      createdAt: saved.createdAt.toISOString(),
      updatedAt: saved.updatedAt.toISOString(),
    };
  }
}
```

**Step 4: Delete command + handler**

File: `delete-quick-action.command.ts`
```typescript
export class DeleteQuickActionCommand {
  constructor(
    public readonly id: string,
    public readonly userId: string,
  ) {}
}
```

File: `delete-quick-action.handler.ts`
```typescript
import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { NotFoundException } from '@nestjs/common';
import { DeleteQuickActionCommand } from './delete-quick-action.command';
import {
  QUICK_ACTION_REPOSITORY,
  type IQuickActionRepository,
} from '../../../domain/repositories/quick-action.repository.interface';

@CommandHandler(DeleteQuickActionCommand)
export class DeleteQuickActionHandler implements ICommandHandler<DeleteQuickActionCommand> {
  constructor(
    @Inject(QUICK_ACTION_REPOSITORY)
    private readonly quickActionRepository: IQuickActionRepository,
  ) {}

  async execute(command: DeleteQuickActionCommand): Promise<void> {
    const quickAction = await this.quickActionRepository.findById(command.id);
    if (!quickAction || quickAction.userId !== command.userId) {
      throw new NotFoundException('Quick action not found');
    }

    await this.quickActionRepository.delete(command.id);

    // Reposition remaining actions
    const remaining = await this.quickActionRepository.findByUserId(command.userId);
    for (let i = 0; i < remaining.length; i++) {
      if (remaining[i].position !== i) {
        remaining[i].setPosition(i);
        await this.quickActionRepository.save(remaining[i]);
      }
    }
  }
}
```

**Step 5: Reorder command + handler**

File: `reorder-quick-actions.command.ts`
```typescript
export class ReorderQuickActionsCommand {
  constructor(
    public readonly userId: string,
    public readonly ids: string[],
  ) {}
}
```

File: `reorder-quick-actions.handler.ts`
```typescript
import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { ReorderQuickActionsCommand } from './reorder-quick-actions.command';
import {
  QUICK_ACTION_REPOSITORY,
  type IQuickActionRepository,
} from '../../../domain/repositories/quick-action.repository.interface';

@CommandHandler(ReorderQuickActionsCommand)
export class ReorderQuickActionsHandler implements ICommandHandler<ReorderQuickActionsCommand> {
  constructor(
    @Inject(QUICK_ACTION_REPOSITORY)
    private readonly quickActionRepository: IQuickActionRepository,
  ) {}

  async execute(command: ReorderQuickActionsCommand) {
    const actions = await this.quickActionRepository.findByUserId(command.userId);
    for (const action of actions) {
      const newPosition = command.ids.indexOf(action.id);
      if (newPosition !== -1 && action.position !== newPosition) {
        action.setPosition(newPosition);
        await this.quickActionRepository.save(action);
      }
    }
    return { success: true };
  }
}
```

**Step 6: Update commands index**

Add to `backend/src/modules/accounting/application/commands/index.ts`:
```typescript
export * from './create-quick-action/create-quick-action.command';
export * from './create-quick-action/create-quick-action.handler';
export * from './update-quick-action/update-quick-action.command';
export * from './update-quick-action/update-quick-action.handler';
export * from './delete-quick-action/delete-quick-action.command';
export * from './delete-quick-action/delete-quick-action.handler';
export * from './reorder-quick-actions/reorder-quick-actions.command';
export * from './reorder-quick-actions/reorder-quick-actions.handler';

// Add to CommandHandlers array:
import { CreateQuickActionHandler } from './create-quick-action/create-quick-action.handler';
import { UpdateQuickActionHandler } from './update-quick-action/update-quick-action.handler';
import { DeleteQuickActionHandler } from './delete-quick-action/delete-quick-action.handler';
import { ReorderQuickActionsHandler } from './reorder-quick-actions/reorder-quick-actions.handler';
// Append to existing CommandHandlers array
```

---

### Task 5: Backend — Query (get user quick actions)

**Files:**
- Create: `backend/src/modules/accounting/application/queries/get-quick-actions/get-quick-actions.query.ts`
- Create: `backend/src/modules/accounting/application/queries/get-quick-actions/get-quick-actions.handler.ts`
- Modify: `backend/src/modules/accounting/application/queries/index.ts`

**Step 1: Create query + handler**

File: `get-quick-actions.query.ts`
```typescript
export class GetQuickActionsQuery {
  constructor(public readonly userId: string) {}
}
```

File: `get-quick-actions.handler.ts`
```typescript
import { Inject } from '@nestjs/common';
import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import { GetQuickActionsQuery } from './get-quick-actions.query';
import {
  QUICK_ACTION_REPOSITORY,
  type IQuickActionRepository,
} from '../../../domain/repositories/quick-action.repository.interface';

@QueryHandler(GetQuickActionsQuery)
export class GetQuickActionsHandler implements IQueryHandler<GetQuickActionsQuery> {
  constructor(
    @Inject(QUICK_ACTION_REPOSITORY)
    private readonly quickActionRepository: IQuickActionRepository,
  ) {}

  async execute(query: GetQuickActionsQuery) {
    const actions = await this.quickActionRepository.findByUserId(query.userId);
    return actions.map((a) => ({
      id: a.id,
      userId: a.userId,
      categoryId: a.categoryId,
      accountId: a.accountId,
      label: a.label,
      position: a.position,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    }));
  }
}
```

**Step 2: Update queries index**

Add to `backend/src/modules/accounting/application/queries/index.ts`:
```typescript
export * from './get-quick-actions/get-quick-actions.query';
export * from './get-quick-actions/get-quick-actions.handler';

import { GetQuickActionsHandler } from './get-quick-actions/get-quick-actions.handler';
// Append to QueryHandlers array
```

---

### Task 6: Backend — Controller + DTOs

**Files:**
- Create: `backend/src/modules/accounting/presentation/dto/create-quick-action.dto.ts`
- Create: `backend/src/modules/accounting/presentation/dto/update-quick-action.dto.ts`
- Create: `backend/src/modules/accounting/presentation/controllers/quick-actions.controller.ts`
- Modify: `backend/src/modules/accounting/presentation/controllers/index.ts`

**Step 1: Create DTOs**

File: `create-quick-action.dto.ts`
```typescript
import { IsString, IsUUID } from 'class-validator';

export class CreateQuickActionDto {
  @IsUUID()
  categoryId: string;

  @IsUUID()
  accountId: string;

  @IsString()
  label: string;
}
```

File: `update-quick-action.dto.ts`
```typescript
import { IsString, IsOptional, IsUUID } from 'class-validator';

export class UpdateQuickActionDto {
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  accountId?: string;

  @IsOptional()
  @IsString()
  label?: string;
}
```

**Step 2: Create controller**

File: `quick-actions.controller.ts`
```typescript
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { CurrentUser } from '../../../../shared/decorators/current-user.decorator';
import { CreateQuickActionDto } from '../dto/create-quick-action.dto';
import { UpdateQuickActionDto } from '../dto/update-quick-action.dto';
import { CreateQuickActionCommand } from '../../application/commands/create-quick-action/create-quick-action.command';
import { UpdateQuickActionCommand } from '../../application/commands/update-quick-action/update-quick-action.command';
import { DeleteQuickActionCommand } from '../../application/commands/delete-quick-action/delete-quick-action.command';
import { ReorderQuickActionsCommand } from '../../application/commands/reorder-quick-actions/reorder-quick-actions.command';
import { GetQuickActionsQuery } from '../../application/queries/get-quick-actions/get-quick-actions.query';

@Controller('quick-actions')
export class QuickActionsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  async findAll(@CurrentUser('sub') userId: string) {
    return this.queryBus.execute(new GetQuickActionsQuery(userId));
  }

  @Post()
  async create(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateQuickActionDto,
  ) {
    return this.commandBus.execute(
      new CreateQuickActionCommand(userId, dto.categoryId, dto.accountId, dto.label),
    );
  }

  @Patch('reorder')
  @HttpCode(HttpStatus.OK)
  async reorder(
    @CurrentUser('sub') userId: string,
    @Body() body: { ids: string[] },
  ) {
    return this.commandBus.execute(new ReorderQuickActionsCommand(userId, body.ids));
  }

  @Patch(':id')
  async update(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateQuickActionDto,
  ) {
    return this.commandBus.execute(new UpdateQuickActionCommand(id, userId, dto));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    await this.commandBus.execute(new DeleteQuickActionCommand(id, userId));
  }
}
```

**Step 3: Export from controllers index and register in module**

Add to `backend/src/modules/accounting/presentation/controllers/index.ts`:
```typescript
export { QuickActionsController } from './quick-actions.controller';
```

---

### Task 7: Backend — Register in accounting module

**Files:**
- Modify: `backend/src/modules/accounting/accounting.module.ts`

**Step 1: Add ORM entity, repository, controller**

Add imports and register:
- `QuickActionOrmEntity` to `TypeOrmModule.forFeature([])`
- `QuickActionsController` to `controllers`
- `{ provide: QUICK_ACTION_REPOSITORY, useClass: QuickActionRepository }` to `providers`
- `QUICK_ACTION_REPOSITORY` to `exports`

---

### Task 8: Backend — Profile fields (hidden, hintDismissed)

**Files:**
- Modify: `backend/src/modules/identity/domain/entities/profile.entity.ts` — add fields to interface, constructor, getters, updateProfile()
- Modify: `backend/src/modules/identity/infrastructure/persistence/typeorm/profile.orm-entity.ts` — add 2 columns
- Modify: `backend/src/modules/identity/infrastructure/persistence/mappers/profile.mapper.ts` — map both directions
- Modify: `backend/src/modules/identity/application/types/index.ts` — add to ProfileResponse
- Modify: `backend/src/modules/identity/presentation/dto/update-profile.dto.ts` — add optional booleans
- Modify: all profile handlers that return ProfileResponse (get-profile, update-profile, create-demo-user, get-or-create-profile) — include new fields in response mapping

**Step 1: Add to each file**

For each file, add `quickActionsHidden: boolean` and `quickActionsHintDismissed: boolean` following the exact existing pattern for other fields (e.g. how `dashboardSettings` was added). Default to `false`.

---

### Task 9: Backend — Build and verify

**Step 1: Build backend**

Run: `cd backend && bun run build`
Expected: No errors

**Step 2: Run tests**

Run: `cd backend && bun run test`
Expected: All tests pass

---

### Task 10: Frontend — QuickAction entity API layer

**Files:**
- Create: `frontend/src/entities/quick-action/api/quickActionApi.ts`
- Create: `frontend/src/entities/quick-action/api/queryKeys.ts`
- Create: `frontend/src/entities/quick-action/api/useQuickActions.ts`
- Create: `frontend/src/entities/quick-action/api/index.ts`
- Create: `frontend/src/entities/quick-action/model/types.ts`
- Create: `frontend/src/entities/quick-action/model/index.ts`
- Create: `frontend/src/entities/quick-action/index.ts`
- Modify: `frontend/src/shared/api/database.types.ts` — add quick_actions table types

**Step 1: Add types to database.types.ts**

Add `quick_actions` table definition in the `Tables` section:

```typescript
quick_actions: {
  Row: {
    id: string;
    user_id: string;
    category_id: string;
    account_id: string;
    label: string;
    position: number;
    created_at: string;
    updated_at: string;
  };
  Insert: {
    id?: string;
    user_id: string;
    category_id: string;
    account_id: string;
    label: string;
    position?: number;
    created_at?: string;
    updated_at?: string;
  };
  Update: {
    id?: string;
    user_id?: string;
    category_id?: string;
    account_id?: string;
    label?: string;
    position?: number;
    created_at?: string;
    updated_at?: string;
  };
  Relationships: [];
};
```

Add helper types at bottom:
```typescript
export type QuickAction = Database['public']['Tables']['quick_actions']['Row'];
export type QuickActionInsert = Database['public']['Tables']['quick_actions']['Insert'];
```

Also add `quick_actions_hidden` and `quick_actions_hint_dismissed` to profiles Row/Insert/Update types.

**Step 2: Create API files**

File: `frontend/src/entities/quick-action/model/types.ts`
```typescript
export type { QuickAction, QuickActionInsert } from '@/shared/api/database.types';
```

File: `frontend/src/entities/quick-action/api/queryKeys.ts`
```typescript
export const quickActionQueryKeys = {
  all: ['quick-actions'] as const,
  list: (userId: string) => [...quickActionQueryKeys.all, 'list', userId] as const,
};
```

File: `frontend/src/entities/quick-action/api/quickActionApi.ts`
```typescript
import { http } from '@/shared/api/http';
import type { QuickAction } from '@/shared/api/database.types';

interface QuickActionResponse {
  id: string;
  userId: string;
  categoryId: string;
  accountId: string;
  label: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

function transformQuickAction(qa: QuickActionResponse): QuickAction {
  return {
    id: qa.id,
    user_id: qa.userId,
    category_id: qa.categoryId,
    account_id: qa.accountId,
    label: qa.label,
    position: qa.position,
    created_at: qa.createdAt,
    updated_at: qa.updatedAt,
  };
}

export const quickActionApi = {
  async getAll(): Promise<QuickAction[]> {
    const data = await http.get<QuickActionResponse[]>('/quick-actions');
    return data.map(transformQuickAction);
  },

  async create(params: { categoryId: string; accountId: string; label: string }): Promise<QuickAction> {
    const data = await http.post<QuickActionResponse>('/quick-actions', params);
    return transformQuickAction(data);
  },

  async update(id: string, params: { categoryId?: string; accountId?: string; label?: string }): Promise<QuickAction> {
    const data = await http.patch<QuickActionResponse>(`/quick-actions/${id}`, params);
    return transformQuickAction(data);
  },

  async delete(id: string): Promise<void> {
    await http.delete(`/quick-actions/${id}`);
  },

  async reorder(ids: string[]): Promise<void> {
    await http.patch('/quick-actions/reorder', { ids });
  },
};
```

**Step 3: Create Vue Query composable**

File: `frontend/src/entities/quick-action/api/useQuickActions.ts`

```typescript
import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query';
import { quickActionQueryKeys } from './queryKeys';
import { quickActionApi } from './quickActionApi';
import type { QuickAction } from '@/shared/api/database.types';
import { useProfile } from '@/shared/api/composables/useProfile';
import { STORAGE_KEYS } from '@/shared/config/storageKeys';

const MAX_SLOTS = 4;

export function useQuickActions(userId: MaybeRefOrGetter<string | null>) {
  const queryClient = useQueryClient();
  const { profile, updateProfile } = useProfile(userId);

  const queryKey = computed(() => {
    const uid = toValue(userId);
    return uid ? quickActionQueryKeys.list(uid) : quickActionQueryKeys.all;
  });

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => quickActionApi.getAll(),
    enabled: computed(() => !!toValue(userId)),
  });

  const actions = computed(() => data.value ?? []);

  const slots = computed(() => {
    const sorted = [...actions.value].sort((a, b) => a.position - b.position);
    const result: (QuickAction | null)[] = [];
    for (let i = 0; i < MAX_SLOTS; i++) {
      result.push(sorted[i] ?? null);
    }
    return result;
  });

  const hidden = computed(() => profile.value?.quick_actions_hidden ?? false);
  const hintDismissed = computed(() => profile.value?.quick_actions_hint_dismissed ?? false);

  // --- Mutations ---

  const createMutation = useMutation({
    mutationFn: (params: { categoryId: string; accountId: string; label: string }) =>
      quickActionApi.create(params),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKey.value }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...params }: { id: string; categoryId?: string; accountId?: string; label?: string }) =>
      quickActionApi.update(id, params),
    onMutate: async ({ id, ...updates }) => {
      await queryClient.cancelQueries({ queryKey: queryKey.value });
      const previous = queryClient.getQueryData<QuickAction[]>(queryKey.value);
      queryClient.setQueryData<QuickAction[]>(queryKey.value, (old) =>
        old?.map((a) => (a.id === id ? { ...a, ...snakeCaseUpdates(updates) } : a)) ?? [],
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey.value, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKey.value }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => quickActionApi.delete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKey.value });
      const previous = queryClient.getQueryData<QuickAction[]>(queryKey.value);
      queryClient.setQueryData<QuickAction[]>(queryKey.value, (old) =>
        old?.filter((a) => a.id !== id) ?? [],
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey.value, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKey.value }),
  });

  // --- Helper functions ---

  async function addAction(params: { label: string; categoryId: string; accountId: string }) {
    if (actions.value.length >= MAX_SLOTS) return;
    return createMutation.mutateAsync(params);
  }

  async function updateAction(id: string, updates: { categoryId?: string; accountId?: string; label?: string }) {
    return updateMutation.mutateAsync({ id, ...updates });
  }

  async function removeAction(id: string) {
    return deleteMutation.mutateAsync(id);
  }

  async function toggleHidden() {
    await updateProfile({ quick_actions_hidden: !hidden.value });
  }

  async function dismissHint() {
    await updateProfile({ quick_actions_hint_dismissed: true });
  }

  // --- Migration from localStorage ---

  async function migrateFromLocalStorage() {
    const raw = localStorage.getItem(STORAGE_KEYS.QUICK_ACTIONS);
    if (!raw) return;

    try {
      const localActions = JSON.parse(raw) as Array<{ categoryId: string; accountId: string; label: string }>;
      if (localActions.length === 0) {
        cleanupLocalStorage();
        return;
      }

      // Only migrate if server has no actions
      const serverActions = await quickActionApi.getAll();
      if (serverActions.length > 0) {
        cleanupLocalStorage();
        return;
      }

      for (const action of localActions) {
        await quickActionApi.create({
          categoryId: action.categoryId,
          accountId: action.accountId,
          label: action.label,
        });
      }

      // Migrate UI state to profile
      const hiddenRaw = localStorage.getItem(STORAGE_KEYS.QUICK_ACTIONS_HIDDEN);
      const hintRaw = localStorage.getItem(STORAGE_KEYS.QUICK_ACTIONS_HINT_DISMISSED);
      const profileUpdates: Record<string, boolean> = {};
      if (hiddenRaw === 'true') profileUpdates.quick_actions_hidden = true;
      if (hintRaw === 'true') profileUpdates.quick_actions_hint_dismissed = true;
      if (Object.keys(profileUpdates).length > 0) {
        await updateProfile(profileUpdates);
      }

      cleanupLocalStorage();
      queryClient.invalidateQueries({ queryKey: queryKey.value });
    } catch {
      // Silent fail — user can reconfigure manually
    }
  }

  return {
    actions,
    slots,
    hidden,
    hintDismissed,
    isLoading,
    addAction,
    updateAction,
    removeAction,
    toggleHidden,
    dismissHint,
    migrateFromLocalStorage,
  };
}

function cleanupLocalStorage() {
  localStorage.removeItem(STORAGE_KEYS.QUICK_ACTIONS);
  localStorage.removeItem(STORAGE_KEYS.QUICK_ACTIONS_HIDDEN);
  localStorage.removeItem(STORAGE_KEYS.QUICK_ACTIONS_HINT_DISMISSED);
}

function snakeCaseUpdates(updates: { categoryId?: string; accountId?: string; label?: string }) {
  const result: Record<string, string | undefined> = {};
  if (updates.categoryId !== undefined) result.category_id = updates.categoryId;
  if (updates.accountId !== undefined) result.account_id = updates.accountId;
  if (updates.label !== undefined) result.label = updates.label;
  return result;
}
```

**Step 4: Create barrel exports**

File: `frontend/src/entities/quick-action/api/index.ts`
```typescript
export { quickActionApi } from './quickActionApi';
export { useQuickActions } from './useQuickActions';
export { quickActionQueryKeys } from './queryKeys';
```

File: `frontend/src/entities/quick-action/model/index.ts`
```typescript
export type { QuickAction, QuickActionInsert } from './types';
```

File: `frontend/src/entities/quick-action/index.ts`
```typescript
export { quickActionApi, useQuickActions, quickActionQueryKeys } from './api';
export type { QuickAction, QuickActionInsert } from './model';
```

---

### Task 11: Frontend — Update profile types + profileApi

**Files:**
- Modify: `frontend/src/shared/api/database.types.ts` — add `quick_actions_hidden` and `quick_actions_hint_dismissed` to profiles Row/Insert/Update
- Modify: `frontend/src/shared/api/services/profileApi.ts` — add fields to transform + update methods

**Step 1: Add to profile response transform and update**

In `profileApi.ts` `transformProfile()` add:
```typescript
quick_actions_hidden: profile.quickActionsHidden,
quick_actions_hint_dismissed: profile.quickActionsHintDismissed,
```

In `profileApi.ts` `update()` body add:
```typescript
quickActionsHidden: updates.quick_actions_hidden,
quickActionsHintDismissed: updates.quick_actions_hint_dismissed,
```

---

### Task 12: Frontend — Replace localStorage usage in pages

**Files:**
- Modify: `frontend/src/features/configure-quick-action/model/useQuickActions.ts` — rewrite to use new entity composable
- Modify: `frontend/src/features/configure-quick-action/index.ts`
- Modify: `frontend/src/pages/dashboard/model/useDashboardQuickActions.ts` — update to new API
- Modify: `frontend/src/pages/dashboard/DashboardPage.vue` — update imports, call migration, use new hintDismissed
- Modify: `frontend/src/pages/settings/quick-actions/QuickActionsSettingsPage.vue` — update imports

**Step 1: Rewrite feature composable as re-export**

Replace `frontend/src/features/configure-quick-action/model/useQuickActions.ts` content to simply re-export from entity:

```typescript
export { useQuickActions } from '@/entities/quick-action';
```

**Step 2: Update DashboardPage.vue**

- Replace `useLocalStorage(STORAGE_KEYS.QUICK_ACTIONS_HINT_DISMISSED, false)` with `hintDismissed` + `dismissHint` from `useQuickActions`
- Call `migrateFromLocalStorage()` in `onMounted`
- Pass `hintDismissed` as prop, wire `@dismiss-hint` to `dismissHint()`

**Step 3: Update useDashboardQuickActions.ts**

- Import from `@/entities/quick-action` instead of feature
- Methods become async (addAction, updateAction, removeAction now return Promise)
- `handleSave` and `handleDelete` become async

**Step 4: Update QuickActionsSettingsPage.vue**

- Same pattern: import from entity, methods become async

---

### Task 13: Frontend — Build and verify

**Step 1: Build frontend**

Run: `cd frontend && bun run build`
Expected: No type errors, successful build

---

### Task 14: Run /crq twice

**Step 1:** Run `/crq` review
**Step 2:** Fix any issues found
**Step 3:** Run `/crq` again to confirm all clean
