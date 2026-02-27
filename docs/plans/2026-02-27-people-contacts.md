# People/Contacts Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "People" entity so users can save frequently-used contacts and quickly select them when creating debts, splitting expenses, or scanning receipts.

**Architecture:** New `person` bounded context on backend (DDD + CQRS), new `person` entity on frontend (FSD), PersonSelector component integrated into 3 existing forms. Backend stores `people` table (id, user_id, name, color). Frontend uses Vue Query composable with optimistic updates.

**Tech Stack:** NestJS, TypeORM, PostgreSQL, Vue 3, TanStack Vue Query, Tailwind CSS v4, Reka UI

---

### Task 1: Backend — Domain Layer (Aggregate + Repository Interface)

**Files:**
- Create: `backend/src/modules/person/domain/aggregates/person/person.aggregate.ts`
- Create: `backend/src/modules/person/domain/aggregates/person/index.ts`
- Create: `backend/src/modules/person/domain/aggregates/index.ts`
- Create: `backend/src/modules/person/domain/repositories/person.repository.interface.ts`
- Create: `backend/src/modules/person/domain/repositories/index.ts`
- Create: `backend/src/modules/person/domain/index.ts`

**Step 1: Create Person aggregate**

```typescript
// person.aggregate.ts
import { AggregateRoot } from '../../../../../shared/domain/base';

export interface PersonProps {
  id: string;
  userId: string;
  name: string;
  color: string;
  createdAt: Date;
  updatedAt: Date;
}

export class Person extends AggregateRoot<string> {
  private _userId: string;
  private _name: string;
  private _color: string;
  private _createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: PersonProps) {
    super(props.id);
    this._userId = props.userId;
    this._name = props.name.trim();
    this._color = props.color;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  static create(
    id: string,
    userId: string,
    name: string,
    color: string,
  ): Person {
    const now = new Date();
    return new Person({
      id,
      userId,
      name,
      color,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: PersonProps): Person {
    return new Person(props);
  }

  get userId(): string { return this._userId; }
  get name(): string { return this._name; }
  get color(): string { return this._color; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }

  update(data: { name?: string; color?: string }): void {
    if (data.name !== undefined) this._name = data.name.trim();
    if (data.color !== undefined) this._color = data.color;
    this._updatedAt = new Date();
  }
}
```

```typescript
// person/index.ts
export * from './person.aggregate';

// aggregates/index.ts
export * from './person';

// domain/repositories/person.repository.interface.ts
import type { Person } from '../aggregates/person';

export const PERSON_REPOSITORY = Symbol('PERSON_REPOSITORY');

export interface IPersonRepository {
  findById(id: string): Promise<Person | null>;
  findByUserId(userId: string): Promise<Person[]>;
  save(person: Person): Promise<Person>;
  delete(id: string): Promise<void>;
}

// domain/repositories/index.ts
export * from './person.repository.interface';

// domain/index.ts
export * from './aggregates';
export * from './repositories';
```

**Step 2: Verify backend builds**

Run: `cd backend && bun run build`
Expected: Build succeeds (new files are standalone, not yet imported by module)

**Step 3: Commit**

```bash
git add backend/src/modules/person/domain/
git commit -m "feat(person): add Person aggregate and repository interface"
```

---

### Task 2: Backend — Infrastructure Layer (ORM Entity + Mapper + Repository)

**Files:**
- Create: `backend/src/modules/person/infrastructure/persistence/typeorm/person.orm-entity.ts`
- Create: `backend/src/modules/person/infrastructure/persistence/typeorm/index.ts`
- Create: `backend/src/modules/person/infrastructure/persistence/mappers/person.mapper.ts`
- Create: `backend/src/modules/person/infrastructure/persistence/mappers/index.ts`
- Create: `backend/src/modules/person/infrastructure/persistence/repositories/person.repository.ts`
- Create: `backend/src/modules/person/infrastructure/persistence/repositories/index.ts`
- Create: `backend/src/modules/person/infrastructure/persistence/index.ts`
- Create: `backend/src/modules/person/infrastructure/index.ts`

**Step 1: Create ORM entity**

```typescript
// person.orm-entity.ts
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('people')
export class PersonOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column()
  name: string;

  @Column()
  color: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

**Step 2: Create mapper**

```typescript
// person.mapper.ts
import { Person } from '../../../domain/aggregates/person';
import { PersonOrmEntity } from '../typeorm/person.orm-entity';

export class PersonMapper {
  static toDomain(ormEntity: PersonOrmEntity): Person {
    return Person.reconstitute({
      id: ormEntity.id,
      userId: ormEntity.userId,
      name: ormEntity.name,
      color: ormEntity.color,
      createdAt: ormEntity.createdAt,
      updatedAt: ormEntity.updatedAt,
    });
  }

  static toOrm(person: Person): PersonOrmEntity {
    const ormEntity = new PersonOrmEntity();
    ormEntity.id = person.id;
    ormEntity.userId = person.userId;
    ormEntity.name = person.name;
    ormEntity.color = person.color;
    ormEntity.createdAt = person.createdAt;
    ormEntity.updatedAt = person.updatedAt;
    return ormEntity;
  }
}
```

**Step 3: Create repository implementation**

```typescript
// person.repository.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Person } from '../../../domain/aggregates/person';
import { IPersonRepository } from '../../../domain/repositories';
import { PersonOrmEntity } from '../typeorm/person.orm-entity';
import { PersonMapper } from '../mappers/person.mapper';

@Injectable()
export class PersonRepository implements IPersonRepository {
  constructor(
    @InjectRepository(PersonOrmEntity)
    private readonly ormRepository: Repository<PersonOrmEntity>,
  ) {}

  async findById(id: string): Promise<Person | null> {
    const ormEntity = await this.ormRepository.findOne({ where: { id } });
    if (!ormEntity) return null;
    return PersonMapper.toDomain(ormEntity);
  }

  async findByUserId(userId: string): Promise<Person[]> {
    const ormEntities = await this.ormRepository.find({
      where: { userId },
      order: { name: 'ASC' },
    });
    return ormEntities.map((entity) => PersonMapper.toDomain(entity));
  }

  async save(person: Person): Promise<Person> {
    const ormEntity = PersonMapper.toOrm(person);
    const savedEntity = await this.ormRepository.save(ormEntity);
    return PersonMapper.toDomain(savedEntity);
  }

  async delete(id: string): Promise<void> {
    await this.ormRepository.delete(id);
  }
}
```

**Step 4: Create index files**

```typescript
// typeorm/index.ts
export * from './person.orm-entity';

// mappers/index.ts
export * from './person.mapper';

// repositories/index.ts
export * from './person.repository';

// persistence/index.ts
export * from './typeorm';
export * from './mappers';
export * from './repositories';

// infrastructure/index.ts
export * from './persistence';
```

**Step 5: Commit**

```bash
git add backend/src/modules/person/infrastructure/
git commit -m "feat(person): add ORM entity, mapper, and repository implementation"
```

---

### Task 3: Backend — Application Layer (Commands + Queries + Response Mapper)

**Files:**
- Create: `backend/src/modules/person/application/commands/create-person/create-person.command.ts`
- Create: `backend/src/modules/person/application/commands/create-person/create-person.handler.ts`
- Create: `backend/src/modules/person/application/commands/update-person/update-person.command.ts`
- Create: `backend/src/modules/person/application/commands/update-person/update-person.handler.ts`
- Create: `backend/src/modules/person/application/commands/delete-person/delete-person.command.ts`
- Create: `backend/src/modules/person/application/commands/delete-person/delete-person.handler.ts`
- Create: `backend/src/modules/person/application/commands/index.ts`
- Create: `backend/src/modules/person/application/queries/get-people/get-people.query.ts`
- Create: `backend/src/modules/person/application/queries/get-people/get-people.handler.ts`
- Create: `backend/src/modules/person/application/queries/index.ts`
- Create: `backend/src/modules/person/application/mappers/person-response.mapper.ts`
- Create: `backend/src/modules/person/application/mappers/index.ts`
- Create: `backend/src/modules/person/application/index.ts`

**Step 1: Create response mapper**

```typescript
// person-response.mapper.ts
import type { Person } from '../../domain/aggregates/person';

export class PersonResponseMapper {
  static toResponse(person: Person) {
    return {
      id: person.id,
      userId: person.userId,
      name: person.name,
      color: person.color,
      createdAt: person.createdAt,
      updatedAt: person.updatedAt,
    };
  }

  static toResponseList(people: Person[]) {
    return people.map((person) => PersonResponseMapper.toResponse(person));
  }
}
```

**Step 2: Create commands**

```typescript
// create-person.command.ts
export class CreatePersonCommand {
  constructor(
    public readonly userId: string,
    public readonly name: string,
    public readonly color: string,
  ) {}
}

// create-person.handler.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { CreatePersonCommand } from './create-person.command';
import { Person } from '../../../domain/aggregates/person';
import { IPersonRepository, PERSON_REPOSITORY } from '../../../domain/repositories';
import { PersonResponseMapper } from '../../mappers';

@CommandHandler(CreatePersonCommand)
export class CreatePersonHandler implements ICommandHandler<CreatePersonCommand> {
  constructor(
    @Inject(PERSON_REPOSITORY)
    private readonly personRepository: IPersonRepository,
  ) {}

  async execute(command: CreatePersonCommand) {
    const person = Person.create(
      crypto.randomUUID(),
      command.userId,
      command.name,
      command.color,
    );
    const savedPerson = await this.personRepository.save(person);
    return PersonResponseMapper.toResponse(savedPerson);
  }
}

// update-person.command.ts
export class UpdatePersonCommand {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly data: { name?: string; color?: string },
  ) {}
}

// update-person.handler.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import { UpdatePersonCommand } from './update-person.command';
import { IPersonRepository, PERSON_REPOSITORY } from '../../../domain/repositories';
import { PersonResponseMapper } from '../../mappers';

@CommandHandler(UpdatePersonCommand)
export class UpdatePersonHandler implements ICommandHandler<UpdatePersonCommand> {
  constructor(
    @Inject(PERSON_REPOSITORY)
    private readonly personRepository: IPersonRepository,
  ) {}

  async execute(command: UpdatePersonCommand) {
    const person = await this.personRepository.findById(command.id);
    if (!person) throw new NotFoundException('Person not found');
    if (person.userId !== command.userId) throw new ForbiddenException('Access denied');

    person.update(command.data);
    const savedPerson = await this.personRepository.save(person);
    return PersonResponseMapper.toResponse(savedPerson);
  }
}

// delete-person.command.ts
export class DeletePersonCommand {
  constructor(
    public readonly id: string,
    public readonly userId: string,
  ) {}
}

// delete-person.handler.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import { DeletePersonCommand } from './delete-person.command';
import { IPersonRepository, PERSON_REPOSITORY } from '../../../domain/repositories';

@CommandHandler(DeletePersonCommand)
export class DeletePersonHandler implements ICommandHandler<DeletePersonCommand> {
  constructor(
    @Inject(PERSON_REPOSITORY)
    private readonly personRepository: IPersonRepository,
  ) {}

  async execute(command: DeletePersonCommand): Promise<void> {
    const person = await this.personRepository.findById(command.id);
    if (!person) throw new NotFoundException('Person not found');
    if (person.userId !== command.userId) throw new ForbiddenException('Access denied');
    await this.personRepository.delete(command.id);
  }
}
```

**Step 3: Create query**

```typescript
// get-people.query.ts
export class GetPeopleQuery {
  constructor(public readonly userId: string) {}
}

// get-people.handler.ts
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetPeopleQuery } from './get-people.query';
import { IPersonRepository, PERSON_REPOSITORY } from '../../../domain/repositories';
import { PersonResponseMapper } from '../../mappers';

@QueryHandler(GetPeopleQuery)
export class GetPeopleHandler implements IQueryHandler<GetPeopleQuery> {
  constructor(
    @Inject(PERSON_REPOSITORY)
    private readonly personRepository: IPersonRepository,
  ) {}

  async execute(query: GetPeopleQuery) {
    const people = await this.personRepository.findByUserId(query.userId);
    return PersonResponseMapper.toResponseList(people);
  }
}
```

**Step 4: Create index files**

```typescript
// commands/index.ts
export * from './create-person/create-person.command';
export * from './create-person/create-person.handler';
export * from './update-person/update-person.command';
export * from './update-person/update-person.handler';
export * from './delete-person/delete-person.command';
export * from './delete-person/delete-person.handler';

import { CreatePersonHandler } from './create-person/create-person.handler';
import { UpdatePersonHandler } from './update-person/update-person.handler';
import { DeletePersonHandler } from './delete-person/delete-person.handler';

export const CommandHandlers = [
  CreatePersonHandler,
  UpdatePersonHandler,
  DeletePersonHandler,
];

// queries/index.ts
export * from './get-people/get-people.query';
export * from './get-people/get-people.handler';

import { GetPeopleHandler } from './get-people/get-people.handler';

export const QueryHandlers = [GetPeopleHandler];

// mappers/index.ts
export * from './person-response.mapper';

// application/index.ts
export * from './commands';
export * from './queries';
export * from './mappers';
```

**Step 5: Commit**

```bash
git add backend/src/modules/person/application/
git commit -m "feat(person): add CQRS commands, queries, and response mapper"
```

---

### Task 4: Backend — Presentation Layer (Controller + DTOs) + Module Registration

**Files:**
- Create: `backend/src/modules/person/presentation/dto/create-person.dto.ts`
- Create: `backend/src/modules/person/presentation/dto/update-person.dto.ts`
- Create: `backend/src/modules/person/presentation/dto/index.ts`
- Create: `backend/src/modules/person/presentation/controllers/people.controller.ts`
- Create: `backend/src/modules/person/presentation/controllers/index.ts`
- Create: `backend/src/modules/person/presentation/index.ts`
- Create: `backend/src/modules/person/person.module.ts`
- Modify: `backend/src/config/data-source.ts` — add PersonOrmEntity to entities array
- Modify: `backend/src/app.module.ts` — add PersonModule to imports

**Step 1: Create DTOs**

```typescript
// create-person.dto.ts
import { IsString, IsOptional } from 'class-validator';

export class CreatePersonDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  color?: string;
}

// update-person.dto.ts
import { IsString, IsOptional } from 'class-validator';

export class UpdatePersonDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  color?: string;
}

// dto/index.ts
export * from './create-person.dto';
export * from './update-person.dto';
```

**Step 2: Create controller**

```typescript
// people.controller.ts
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
import { CurrentUser } from '../../../../common';
import { CreatePersonDto, UpdatePersonDto } from '../dto';
import { CreatePersonCommand, UpdatePersonCommand, DeletePersonCommand } from '../../application/commands';
import { GetPeopleQuery } from '../../application/queries';

// Default colors rotation (matches frontend ENTITY_COLORS)
const DEFAULT_COLORS = ['#3b82f6', '#10b981', '#f43f5e', '#a855f7', '#f59e0b', '#1f2937'];

@Controller('people')
export class PeopleController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  async findAll(@CurrentUser('sub') userId: string) {
    return this.queryBus.execute(new GetPeopleQuery(userId));
  }

  @Post()
  async create(@CurrentUser('sub') userId: string, @Body() dto: CreatePersonDto) {
    const color = dto.color || DEFAULT_COLORS[Math.floor(Math.random() * DEFAULT_COLORS.length)];
    return this.commandBus.execute(new CreatePersonCommand(userId, dto.name, color));
  }

  @Patch(':id')
  async update(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePersonDto,
  ) {
    return this.commandBus.execute(new UpdatePersonCommand(id, userId, dto));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    await this.commandBus.execute(new DeletePersonCommand(id, userId));
  }
}

// controllers/index.ts
export * from './people.controller';

// presentation/index.ts
export * from './controllers';
export * from './dto';
```

**Step 3: Create module**

```typescript
// person.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';

import { PERSON_REPOSITORY } from './domain/repositories';
import { CommandHandlers } from './application/commands';
import { QueryHandlers } from './application/queries';
import { PersonOrmEntity } from './infrastructure/persistence/typeorm';
import { PersonRepository } from './infrastructure/persistence/repositories';
import { PeopleController } from './presentation/controllers';

@Module({
  imports: [CqrsModule, TypeOrmModule.forFeature([PersonOrmEntity])],
  controllers: [PeopleController],
  providers: [
    { provide: PERSON_REPOSITORY, useClass: PersonRepository },
    ...CommandHandlers,
    ...QueryHandlers,
  ],
  exports: [PERSON_REPOSITORY],
})
export class PersonModule {}
```

**Step 4: Register ORM entity in data-source.ts**

Add import and entity to the entities array in `backend/src/config/data-source.ts`:
```typescript
import { PersonOrmEntity } from '../modules/person/infrastructure/persistence/typeorm';
// ... add to entities array:
PersonOrmEntity,
```

**Step 5: Register module in app.module.ts**

Add `PersonModule` to the `imports` array in `backend/src/app.module.ts`:
```typescript
import { PersonModule } from './modules/person/person.module';
// ... add to imports array:
PersonModule,
```

**Step 6: Generate and run migration**

Run: `cd backend && bun run migration:generate src/database/migrations/AddPeopleTable`
Then: `bun run migration:run`

**Step 7: Verify backend builds and starts**

Run: `cd backend && bun run build`
Run: `cd backend && bun run start:dev` (verify no errors, test endpoints with curl)

**Step 8: Commit**

```bash
git add backend/src/modules/person/presentation/ backend/src/modules/person/person.module.ts backend/src/config/data-source.ts backend/src/app.module.ts backend/src/database/migrations/
git commit -m "feat(person): add controller, DTOs, module registration, and migration"
```

---

### Task 5: Frontend — Entity Layer (Types + API + Vue Query Composable)

**Files:**
- Create: `frontend/src/entities/person/model/types.ts`
- Create: `frontend/src/entities/person/api/personApi.ts`
- Create: `frontend/src/entities/person/api/queryKeys.ts`
- Create: `frontend/src/entities/person/api/usePeople.ts`
- Create: `frontend/src/entities/person/api/index.ts`
- Create: `frontend/src/entities/person/index.ts`

**Step 1: Create types**

```typescript
// model/types.ts
export interface Person {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
  updated_at: string;
}

export type PersonInsert = Pick<Person, 'name'> & { color?: string };
```

**Step 2: Create API**

```typescript
// api/personApi.ts
import { http } from '@/shared/api/http';
import type { Person, PersonInsert } from '../model/types';

interface PersonResponse {
  id: string;
  userId: string;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

function transformPerson(p: PersonResponse): Person {
  return {
    id: p.id,
    user_id: p.userId,
    name: p.name,
    color: p.color,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  };
}

export const personApi = {
  async getAll(): Promise<Person[]> {
    const data = await http.get<PersonResponse[]>('/people');
    return data.map(transformPerson);
  },

  async create(person: PersonInsert): Promise<Person> {
    const data = await http.post<PersonResponse>('/people', {
      name: person.name,
      color: person.color,
    });
    return transformPerson(data);
  },

  async update(id: string, updates: Partial<Pick<Person, 'name' | 'color'>>): Promise<Person> {
    const data = await http.patch<PersonResponse>(`/people/${id}`, updates);
    return transformPerson(data);
  },

  async delete(id: string): Promise<void> {
    await http.delete(`/people/${id}`);
  },
};
```

**Step 3: Create query keys**

```typescript
// api/queryKeys.ts
export const personQueryKeys = {
  all: ['people'] as const,
  list: (userId: string) => [...personQueryKeys.all, 'list', userId] as const,
};
```

**Step 4: Create Vue Query composable**

```typescript
// api/usePeople.ts
import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query';
import { personQueryKeys } from './queryKeys';
import { personApi } from './personApi';
import type { Person, PersonInsert } from '../model/types';

export function usePeople(userId: MaybeRefOrGetter<string | null>) {
  const queryClient = useQueryClient();

  const queryKey = computed(() => {
    const uid = toValue(userId);
    return uid ? personQueryKeys.list(uid) : personQueryKeys.all;
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: () => personApi.getAll(),
    enabled: computed(() => !!toValue(userId)),
  });

  const people = computed(() => data.value ?? []);

  const createMutation = useMutation({
    mutationFn: (person: PersonInsert) => personApi.create(person),
    onMutate: async (newPerson) => {
      const uid = toValue(userId);
      if (!uid) return;
      await queryClient.cancelQueries({ queryKey: queryKey.value });
      const previous = queryClient.getQueryData<Person[]>(queryKey.value);

      const optimistic: Person = {
        id: `temp-${Date.now()}`,
        user_id: uid,
        name: newPerson.name,
        color: newPerson.color || '#3b82f6',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      queryClient.setQueryData<Person[]>(queryKey.value, (old) =>
        [...(old ?? []), optimistic].sort((a, b) => a.name.localeCompare(b.name)),
      );
      return { previous };
    },
    onError: (_err, _newPerson, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey.value, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKey.value }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Pick<Person, 'name' | 'color'>> }) =>
      personApi.update(id, updates),
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: queryKey.value });
      const previous = queryClient.getQueryData<Person[]>(queryKey.value);
      queryClient.setQueryData<Person[]>(queryKey.value, (old) =>
        old?.map((p) => (p.id === id ? { ...p, ...updates } : p)) ?? [],
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey.value, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKey.value }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => personApi.delete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKey.value });
      const previous = queryClient.getQueryData<Person[]>(queryKey.value);
      queryClient.setQueryData<Person[]>(queryKey.value, (old) =>
        old?.filter((p) => p.id !== id) ?? [],
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey.value, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKey.value }),
  });

  async function createPerson(person: PersonInsert) {
    return createMutation.mutateAsync(person);
  }

  async function updatePerson(id: string, updates: Partial<Pick<Person, 'name' | 'color'>>) {
    return updateMutation.mutateAsync({ id, updates });
  }

  async function deletePerson(id: string) {
    return deleteMutation.mutateAsync(id);
  }

  return {
    people,
    isLoading,
    error,
    createPerson,
    updatePerson,
    deletePerson,
    refetch,
  };
}
```

**Step 5: Create index files**

```typescript
// api/index.ts
export { personApi } from './personApi';
export { usePeople } from './usePeople';
export { personQueryKeys } from './queryKeys';

// index.ts (entity root)
export * from './model/types';
export * from './api';
```

**Step 6: Verify frontend builds**

Run: `cd frontend && bun run build`

**Step 7: Commit**

```bash
git add frontend/src/entities/person/
git commit -m "feat(person): add frontend entity with types, API, and Vue Query composable"
```

---

### Task 6: Frontend — PersonSelector Component

**Files:**
- Create: `frontend/src/entities/person/ui/PersonSelector.vue`
- Modify: `frontend/src/entities/person/index.ts` — export PersonSelector

**Step 1: Create PersonSelector component**

This is the key UI component. It shows saved people as horizontal chips and allows selecting or typing a new name.

Props:
- `modelValue: string` — the selected name (v-model)
- `people: Person[]` — list of saved people
- `label?: string` — optional label
- `placeholder?: string` — input placeholder

Emits:
- `update:modelValue` — when name changes
- `save-person` — when user clicks "+" to save a new person

```vue
<!-- PersonSelector.vue -->
<script setup lang="ts">
import { ref, computed } from 'vue';
import { UIcon } from '@/shared/ui';
import { cn } from '@/shared/lib/utils';
import type { Person } from '../model/types';

const props = withDefaults(defineProps<{
  modelValue: string;
  people: Person[];
  label?: string;
  placeholder?: string;
}>(), {
  placeholder: 'Имя человека',
});

const emit = defineEmits<{
  'update:modelValue': [value: string];
  'save-person': [name: string];
}>();

const inputRef = ref<HTMLInputElement | null>(null);
const inputValue = computed({
  get: () => props.modelValue,
  set: (val: string) => emit('update:modelValue', val),
});

const filteredPeople = computed(() => {
  if (!inputValue.value.trim()) return props.people;
  const query = inputValue.value.toLowerCase();
  return props.people.filter((p) => p.name.toLowerCase().includes(query));
});

const canSave = computed(() => {
  const trimmed = inputValue.value.trim();
  if (!trimmed) return false;
  return !props.people.some((p) => p.name.toLowerCase() === trimmed.toLowerCase());
});

function selectPerson(person: Person) {
  emit('update:modelValue', person.name);
}

function handleSave() {
  if (canSave.value) {
    emit('save-person', inputValue.value.trim());
  }
}

function getInitials(name: string): string {
  return name.charAt(0).toUpperCase();
}
</script>

<template>
  <div class="space-y-2">
    <label
      v-if="label"
      class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark"
    >
      {{ label }}
    </label>

    <!-- Saved people chips -->
    <div
      v-if="filteredPeople.length > 0"
      class="flex gap-2 overflow-x-auto pb-1 no-scrollbar -mx-1 px-1"
    >
      <button
        v-for="person in filteredPeople"
        :key="person.id"
        type="button"
        :class="cn(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-all duration-200',
          'border active:scale-95',
          modelValue === person.name
            ? 'border-primary bg-primary/10 text-primary'
            : 'border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark hover:border-primary/50',
        )"
        @click="selectPerson(person)"
      >
        <span
          class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
          :style="{ backgroundColor: person.color }"
        >
          {{ getInitials(person.name) }}
        </span>
        {{ person.name }}
      </button>
    </div>

    <!-- Input row -->
    <div class="flex gap-2">
      <div class="relative flex-1">
        <input
          ref="inputRef"
          v-model="inputValue"
          type="text"
          :placeholder="placeholder"
          :class="cn(
            'w-full h-10 px-3 rounded-xl text-sm transition-colors duration-200',
            'bg-surface-light dark:bg-surface-dark',
            'border border-border-light dark:border-border-dark',
            'text-text-primary-light dark:text-text-primary-dark',
            'placeholder:text-text-tertiary-light dark:placeholder:text-text-tertiary-dark',
            'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary',
          )"
        />
      </div>
      <button
        v-if="canSave"
        type="button"
        class="h-10 w-10 shrink-0 rounded-xl flex items-center justify-center bg-primary/10 text-primary transition-all duration-200 hover:bg-primary/20 active:scale-95"
        title="Сохранить контакт"
        @click="handleSave"
      >
        <UIcon name="person_add" size="sm" />
      </button>
    </div>
  </div>
</template>
```

**Step 2: Update entity index**

Add to `frontend/src/entities/person/index.ts`:
```typescript
export { default as PersonSelector } from './ui/PersonSelector.vue';
```

**Step 3: Add `person_add` icon mapping if missing**

Check `frontend/src/shared/ui/icon/iconMap.ts` and add mapping for `person_add` if not present:
```typescript
person_add: UserPlus,  // from lucide-vue-next
```

**Step 4: Verify frontend builds**

Run: `cd frontend && bun run build`

**Step 5: Commit**

```bash
git add frontend/src/entities/person/ frontend/src/shared/ui/icon/iconMap.ts
git commit -m "feat(person): add PersonSelector component with chips and inline save"
```

---

### Task 7: Frontend — Integrate PersonSelector into DebtForm

**Files:**
- Modify: `frontend/src/features/create-debt/ui/DebtForm.vue`
- Modify: `frontend/src/features/create-debt/model/useCreateDebt.ts` (if needed)

**Step 1: Read current DebtForm.vue**

Read `frontend/src/features/create-debt/ui/DebtForm.vue` to understand current person_name input location.

**Step 2: Add PersonSelector import and integration**

Replace the `UInput` for `person_name` with `PersonSelector`. Import `usePeople` and `PersonSelector` from `@/entities/person`. Use `useCurrentUser` to get userId.

Key changes:
- Import `{ PersonSelector, usePeople }` from `@/entities/person`
- Call `const { people, createPerson } = usePeople(userId)`
- Replace the person_name `<UInput>` with:
```vue
<PersonSelector
  v-model="formData.person_name"
  :people="people"
  :label="formData.debt_type === 'given' ? 'Кому дали в долг' : 'У кого взяли в долг'"
  placeholder="Имя человека"
  @save-person="(name) => createPerson({ name })"
/>
```

**Step 3: Verify frontend builds**

Run: `cd frontend && bun run build`

**Step 4: Commit**

```bash
git add frontend/src/features/create-debt/
git commit -m "feat(person): integrate PersonSelector into debt creation form"
```

---

### Task 8: Frontend — Integrate PersonSelector into SplitExpenseSection

**Files:**
- Modify: `frontend/src/features/split-expense/ui/SplitExpenseSection.vue`

**Step 1: Read current SplitExpenseSection.vue**

Read the file to understand the current participant name input.

**Step 2: Add PersonSelector for adding participants**

Replace the participant name `<UInput>` with `PersonSelector`. When a person chip is tapped, call the existing `addParticipant` emit with that name.

Key changes:
- Import `{ PersonSelector, usePeople }` from `@/entities/person`
- Call `const { people, createPerson } = usePeople(userId)`
- Replace the add-participant input section with PersonSelector
- The `@update:modelValue` should set a local ref, and on Enter/button submit call `emit('addParticipant', name)`

**Step 3: Verify frontend builds**

Run: `cd frontend && bun run build`

**Step 4: Commit**

```bash
git add frontend/src/features/split-expense/
git commit -m "feat(person): integrate PersonSelector into split expense form"
```

---

### Task 9: Frontend — Integrate PersonSelector into Receipt Scanning

**Files:**
- Modify: `frontend/src/features/scan-receipt/ui/steps/Step3AssignParticipants.vue`

**Step 1: Read current Step3AssignParticipants.vue**

Read the file to understand the participant add modal.

**Step 2: Add PersonSelector in the add-participant modal**

Inside the existing add-participant modal, add PersonSelector above the current name input. When a person chip is tapped, it sets the name field. The "Я" quick button stays separate.

Key changes:
- Import `{ PersonSelector, usePeople }` from `@/entities/person`
- Call `const { people, createPerson } = usePeople(userId)`
- Add PersonSelector in the modal, integrated with existing `newParticipantName` ref

**Step 3: Verify frontend builds**

Run: `cd frontend && bun run build`

**Step 4: Commit**

```bash
git add frontend/src/features/scan-receipt/
git commit -m "feat(person): integrate PersonSelector into receipt scanning"
```

---

### Task 10: Frontend — People Management Page

**Files:**
- Create: `frontend/src/pages/people/PeopleListPage.vue`
- Modify: `frontend/src/app/router/index.ts` — add route
- Modify: Profile page — add link to People page

**Step 1: Create PeopleListPage**

Standard list page with:
- AppHeader with back button and "+" add button
- List of people cards (colored avatar circle + name)
- SwipeableItem for delete
- Tap to edit (opens modal with name + UColorPicker)
- Add button opens same modal
- EmptyState when no people
- Toast on create/update/delete

Use the page layout pattern: `min-h-screen bg-background-light dark:bg-background-dark pb-28`

**Step 2: Add route**

In `frontend/src/app/router/index.ts`, add inside the authenticated routes:
```typescript
{
  path: 'people',
  name: 'people-list',
  component: () => import('@/pages/people/PeopleListPage.vue'),
},
```

**Step 3: Add link from profile page**

Find the profile/settings page and add a navigation item for "Люди" (People) with icon `group`.

**Step 4: Verify frontend builds**

Run: `cd frontend && bun run build`

**Step 5: Manual test**

- Navigate to /people
- Add a person, verify it appears
- Edit name/color
- Delete via swipe
- Go to create debt, verify PersonSelector shows saved people
- Go to split expense, verify PersonSelector works
- Go to receipt scanning, verify PersonSelector works

**Step 6: Commit**

```bash
git add frontend/src/pages/people/ frontend/src/app/router/index.ts frontend/src/pages/profile/
git commit -m "feat(person): add People management page with CRUD and profile link"
```

---

### Task 11: Demo Data + Changelog

**Files:**
- Modify: `frontend/src/features/demo-mode/model/demoDataGenerator.ts` — add demo people
- Modify: `frontend/src/features/changelog/model/changelogData.ts` — add changelog entry

**Step 1: Add demo people**

Add 2-3 demo people (e.g., "Ахмед", "Анна", "Коля") in the demo data generator, using the personApi.

**Step 2: Update changelog**

Add entry at top of `CHANGELOG_ENTRIES`:
```typescript
{
  version: '<next_patch>',
  date: '2026-02-27',
  entries: [
    {
      type: 'feature',
      description: 'Добавлена возможность сохранять контакты для быстрого выбора при создании долгов, разделении расходов и сканировании чеков',
    },
  ],
},
```

**Step 3: Verify frontend builds**

Run: `cd frontend && bun run build`

**Step 4: Commit**

```bash
git add frontend/src/features/demo-mode/ frontend/src/features/changelog/
git commit -m "feat(person): add demo data and changelog entry"
```

---

### Task 12: Final Verification

**Step 1: Run backend tests**

Run: `cd backend && bun run test`
Expected: All tests pass

**Step 2: Run backend lint**

Run: `cd backend && bun run lint`
Expected: No errors

**Step 3: Run frontend build**

Run: `cd frontend && bun run build`
Expected: Build succeeds with no type errors

**Step 4: Full integration test**

Run: `bun run dev` (both frontend and backend)
- Create a person from /people page
- Create a debt → verify person appears in PersonSelector
- Split expense → verify person appears
- Scan receipt → verify person appears
- Edit person name → verify updates in selector
- Delete person → verify removed from selector
