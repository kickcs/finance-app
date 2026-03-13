# Category Frequency & Loading Skeleton Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add loading skeletons to Categories page, allow users to manually toggle categories between "frequent" and "infrequent" via swipe, with infrequent categories in a collapsible section.

**Architecture:** New `isFrequent` boolean field on category aggregate, persisted in PostgreSQL via TypeORM migration. Frontend splits categories into two sections with SwipeableItem for toggling. Default value is `true`.

**Tech Stack:** NestJS, TypeORM, PostgreSQL, Vue 3, TanStack Vue Query, Tailwind CSS v4

---

## Chunk 1: Backend — Domain & Infrastructure

### Task 1: Add `isFrequent` to ORM Entity

**Files:**
- Modify: `backend/src/modules/accounting/infrastructure/persistence/typeorm/category.orm-entity.ts`

- [ ] **Step 1: Add isFrequent column**

```typescript
// After the sortOrder column (line 23-24), add:
@Column({ name: 'is_frequent', default: true })
isFrequent: boolean;
```

The full file should be:
```typescript
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('categories')
export class CategoryOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column()
  name: string;

  @Column()
  icon: string;

  @Column()
  color: string;

  @Column({ type: 'varchar' })
  type: string;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  @Column({ name: 'is_frequent', default: true })
  isFrequent: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
```

### Task 2: Add `isFrequent` to Domain Aggregate

**Files:**
- Modify: `backend/src/modules/accounting/domain/aggregates/category/category.aggregate.ts`

- [ ] **Step 1: Add isFrequent to CategoryProps interface**

Add `isFrequent: boolean;` after `sortOrder: number;` (line 11):
```typescript
export interface CategoryProps {
  id: string;
  userId: string;
  name: string;
  icon: string;
  color: string;
  type: CategoryType;
  sortOrder: number;
  isFrequent: boolean;
  createdAt: Date;
}
```

- [ ] **Step 2: Add private field and constructor assignment**

Add `private _isFrequent: boolean;` after `_sortOrder` (line 24), and `this._isFrequent = props.isFrequent;` in constructor after `_sortOrder` assignment (line 34):

- [ ] **Step 3: Add isFrequent param to `create()` static method**

```typescript
static create(
  id: string,
  userId: string,
  name: string,
  icon: string,
  color: string,
  type: string,
  sortOrder: number = 0,
  isFrequent: boolean = true,
): Category {
  return new Category({
    id,
    userId,
    name,
    icon,
    color,
    type: CategoryType.create(type),
    sortOrder,
    isFrequent,
    createdAt: new Date(),
  });
}
```

- [ ] **Step 4: Add getter**

After `get sortOrder()` (line 88-90):
```typescript
get isFrequent(): boolean {
  return this._isFrequent;
}
```

- [ ] **Step 5: Add isFrequent to `update()` method data type and body**

```typescript
update(data: {
  name?: string;
  icon?: string;
  color?: string;
  type?: string;
  sortOrder?: number;
  isFrequent?: boolean;
}): void {
  if (data.name !== undefined) this._name = data.name;
  if (data.icon !== undefined) this._icon = data.icon;
  if (data.color !== undefined) this._color = data.color;
  if (data.type !== undefined) this._type = CategoryType.create(data.type);
  if (data.sortOrder !== undefined) this._sortOrder = data.sortOrder;
  if (data.isFrequent !== undefined) this._isFrequent = data.isFrequent;
}
```

### Task 3: Update Mapper

**Files:**
- Modify: `backend/src/modules/accounting/infrastructure/persistence/mappers/category.mapper.ts`

- [ ] **Step 1: Add isFrequent to toDomain()**

Add `isFrequent: ormEntity.isFrequent,` after `sortOrder` (line 14):
```typescript
static toDomain(ormEntity: CategoryOrmEntity): Category {
  return Category.reconstitute({
    id: ormEntity.id,
    userId: ormEntity.userId,
    name: ormEntity.name,
    icon: ormEntity.icon,
    color: ormEntity.color,
    type: CategoryType.create(ormEntity.type),
    sortOrder: ormEntity.sortOrder,
    isFrequent: ormEntity.isFrequent,
    createdAt: ormEntity.createdAt,
  });
}
```

- [ ] **Step 2: Add isFrequent to toOrm()**

Add `ormEntity.isFrequent = category.isFrequent;` after `sortOrder` (line 28):
```typescript
static toOrm(category: Category): CategoryOrmEntity {
  const ormEntity = new CategoryOrmEntity();
  ormEntity.id = category.id;
  ormEntity.userId = category.userId;
  ormEntity.name = category.name;
  ormEntity.icon = category.icon;
  ormEntity.color = category.color;
  ormEntity.type = category.typeValue;
  ormEntity.sortOrder = category.sortOrder;
  ormEntity.isFrequent = category.isFrequent;
  ormEntity.createdAt = category.createdAt;
  return ormEntity;
}
```

### Task 4: Update DTOs

**Files:**
- Modify: `backend/src/modules/accounting/presentation/dto/create-category.dto.ts`
- Modify: `backend/src/modules/accounting/presentation/dto/update-category.dto.ts`

- [ ] **Step 1: Add isFrequent to CreateCategoryDto**

Add import for `IsBoolean` and the field after `sortOrder`:
```typescript
import { IsString, IsOptional, IsNumber, IsIn, IsBoolean } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  name: string;

  @IsString()
  icon: string;

  @IsString()
  color: string;

  @IsIn(['income', 'expense'])
  type: 'income' | 'expense';

  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isFrequent?: boolean;
}
```

- [ ] **Step 2: Add isFrequent to UpdateCategoryDto**

```typescript
import { IsString, IsOptional, IsNumber, IsIn, IsBoolean } from 'class-validator';

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsIn(['income', 'expense'])
  type?: string;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isFrequent?: boolean;
}
```

### Task 5: Update Commands and Handlers

**Files:**
- Modify: `backend/src/modules/accounting/application/commands/create-category/create-category.command.ts`
- Modify: `backend/src/modules/accounting/application/commands/create-category/create-category.handler.ts`
- Modify: `backend/src/modules/accounting/application/commands/update-category/update-category.command.ts`
- Modify: `backend/src/modules/accounting/application/commands/update-category/update-category.handler.ts`
- Modify: `backend/src/modules/accounting/application/queries/get-categories/get-categories.handler.ts`
- Modify: `backend/src/modules/accounting/application/commands/initialize-default-categories/initialize-default-categories.handler.ts`
- Modify: `backend/src/modules/accounting/presentation/controllers/categories.controller.ts`

- [ ] **Step 1: Update CreateCategoryCommand**

```typescript
export class CreateCategoryCommand {
  constructor(
    public readonly userId: string,
    public readonly name: string,
    public readonly icon: string,
    public readonly color: string,
    public readonly type: 'income' | 'expense',
    public readonly sortOrder: number = 0,
    public readonly isFrequent: boolean = true,
  ) {}
}
```

- [ ] **Step 2: Update CreateCategoryHandler**

Pass `isFrequent` to `Category.create()` and include in response:
```typescript
async execute(command: CreateCategoryCommand) {
  const category = Category.create(
    crypto.randomUUID(),
    command.userId,
    command.name,
    command.icon,
    command.color,
    command.type,
    command.sortOrder,
    command.isFrequent,
  );

  const savedCategory = await this.categoryRepository.save(category);

  return {
    id: savedCategory.id,
    userId: savedCategory.userId,
    name: savedCategory.name,
    icon: savedCategory.icon,
    color: savedCategory.color,
    type: savedCategory.typeValue,
    sortOrder: savedCategory.sortOrder,
    isFrequent: savedCategory.isFrequent,
    createdAt: savedCategory.createdAt,
  };
}
```

- [ ] **Step 3: Update UpdateCategoryCommand**

Add `isFrequent` to data type:
```typescript
export class UpdateCategoryCommand {
  constructor(
    public readonly id: string,
    public readonly data: {
      name?: string;
      icon?: string;
      color?: string;
      type?: string;
      sortOrder?: number;
      isFrequent?: boolean;
    },
  ) {}
}
```

- [ ] **Step 4: Update UpdateCategoryHandler response**

Add `isFrequent: savedCategory.isFrequent,` to the return object (after `sortOrder` line):
```typescript
return {
  id: savedCategory.id,
  userId: savedCategory.userId,
  name: savedCategory.name,
  icon: savedCategory.icon,
  color: savedCategory.color,
  type: savedCategory.typeValue,
  sortOrder: savedCategory.sortOrder,
  isFrequent: savedCategory.isFrequent,
  createdAt: savedCategory.createdAt,
};
```

- [ ] **Step 5: Update GetCategoriesHandler response**

Add `isFrequent: c.isFrequent,` to the map return (line 28):
```typescript
return categories.map((c) => ({
  id: c.id,
  userId: c.userId,
  name: c.name,
  icon: c.icon,
  color: c.color,
  type: c.typeValue,
  sortOrder: c.sortOrder,
  isFrequent: c.isFrequent,
  createdAt: c.createdAt,
}));
```

- [ ] **Step 6: Update InitializeDefaultCategoriesHandler response**

Add `isFrequent: cat.isFrequent,` to BOTH map returns (lines 28 and 56 — existing categories and newly created):
```typescript
// Line ~28 (existing categories return)
return existingCategories.map((cat) => ({
  id: cat.id,
  userId: cat.userId,
  name: cat.name,
  icon: cat.icon,
  color: cat.color,
  type: cat.typeValue,
  sortOrder: cat.sortOrder,
  isFrequent: cat.isFrequent,
  createdAt: cat.createdAt,
}));

// Line ~55 (newly created categories return)
return savedCategories.map((cat) => ({
  id: cat.id,
  userId: cat.userId,
  name: cat.name,
  icon: cat.icon,
  color: cat.color,
  type: cat.typeValue,
  sortOrder: cat.sortOrder,
  isFrequent: cat.isFrequent,
  createdAt: cat.createdAt,
}));
```

- [ ] **Step 7: Update CategoriesController create method**

Pass `isFrequent` to the command (line 46):
```typescript
@Post()
async create(
  @CurrentUser('sub') userId: string,
  @Body() dto: CreateCategoryDto,
): Promise<unknown> {
  return this.commandBus.execute(
    new CreateCategoryCommand(userId, dto.name, dto.icon, dto.color, dto.type, dto.sortOrder, dto.isFrequent),
  );
}
```

### Task 6: Create Migration

**Files:**
- Create: `backend/src/database/migrations/1772600000000-AddIsFrequentToCategories.ts`

- [ ] **Step 1: Create migration file**

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIsFrequentToCategories1772600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "categories" ADD "is_frequent" boolean NOT NULL DEFAULT true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "categories" DROP COLUMN "is_frequent"`);
  }
}
```

- [ ] **Step 2: Register migration in data-source.ts**

In `backend/src/config/data-source.ts`, add the import and include in migrations array. Check the file first to see how other migrations are registered, then follow the same pattern.

- [ ] **Step 3: Verify backend builds**

Run: `cd backend && bun run build`
Expected: No compilation errors.

- [ ] **Step 4: Commit backend changes**

```bash
git add backend/src/modules/accounting/ backend/src/database/migrations/ backend/src/config/data-source.ts
git commit -m "feat(backend): add isFrequent field to categories"
```

---

## Chunk 2: Frontend — Data Layer

### Task 7: Update Frontend Types

**Files:**
- Modify: `frontend/src/shared/api/database.types.ts`
- Modify: `frontend/src/entities/category/api/categoriesApi.ts`

- [ ] **Step 1: Add is_frequent to database.types.ts categories**

Add `is_frequent: boolean;` to the Row type (after `sort_order: number;`, line 404):
```typescript
categories: {
  Row: {
    id: string;
    user_id: string;
    name: string;
    icon: string;
    color: string;
    type: 'expense' | 'income';
    sort_order: number;
    is_frequent: boolean;
    created_at: string;
  };
  Insert: {
    id?: string;
    user_id: string;
    name: string;
    icon: string;
    color: string;
    type: 'expense' | 'income';
    sort_order?: number;
    is_frequent?: boolean;
    created_at?: string;
  };
  Update: {
    id?: string;
    user_id?: string;
    name?: string;
    icon?: string;
    color?: string;
    type?: 'expense' | 'income';
    sort_order?: number;
    is_frequent?: boolean;
    created_at?: string;
  };
```

- [ ] **Step 2: Add isFrequent to CategoryResponse and transformCategory**

In `categoriesApi.ts`, add `isFrequent: boolean;` to `CategoryResponse` (after `sortOrder`, line 12):
```typescript
interface CategoryResponse {
  id: string;
  userId: string;
  name: string;
  icon: string;
  color: string;
  type: 'expense' | 'income';
  sortOrder: number;
  isFrequent: boolean;
  createdAt: string;
}
```

Add `is_frequent: cat.isFrequent ?? true,` to `transformCategory` (after `sort_order`, line 24):
```typescript
function transformCategory(cat: CategoryResponse): UserCategory {
  return {
    id: cat.id,
    user_id: cat.userId,
    name: cat.name,
    icon: cat.icon,
    color: cat.color,
    type: cat.type,
    sort_order: cat.sortOrder,
    is_frequent: cat.isFrequent ?? true,
    created_at: cat.createdAt,
  };
}
```

- [ ] **Step 3: Include is_frequent in update() request body**

In the `update()` method, add `isFrequent: updates.is_frequent,` (after `sortOrder`, line 72):
```typescript
async update(
  id: string,
  updates: Partial<Omit<UserCategory, 'id' | 'user_id' | 'created_at'>>,
): Promise<UserCategory> {
  const data = await http.patch<CategoryResponse>(`/categories/${id}`, {
    name: updates.name,
    icon: updates.icon,
    color: updates.color,
    type: updates.type,
    sortOrder: updates.sort_order,
    isFrequent: updates.is_frequent,
  });
  return transformCategory(data);
},
```

### Task 8: Update useCategories Composable

**Files:**
- Modify: `frontend/src/entities/category/api/useCategories.ts`

- [ ] **Step 1: Add is_frequent to optimistic create**

In `createMutation.onMutate` (line 53-62), add `is_frequent: true,` to the optimistic category:
```typescript
const optimisticCategory: UserCategory = {
  id: `temp-${Date.now()}`,
  user_id: uid,
  created_at: new Date().toISOString(),
  name: newCategory.name,
  icon: newCategory.icon,
  color: newCategory.color,
  type: newCategory.type,
  sort_order: maxSortOrder + 1,
  is_frequent: true,
};
```

- [ ] **Step 2: Verify build**

Run: `cd frontend && bun run build`
Expected: No type errors.

- [ ] **Step 3: Commit frontend data layer**

```bash
git add frontend/src/shared/api/database.types.ts frontend/src/entities/category/
git commit -m "feat(frontend): add isFrequent to category types and API"
```

---

## Chunk 3: Frontend — Categories Page UI

### Task 9: Rewrite CategoriesPage with Loading Skeleton, Sections, and Swipe

**Files:**
- Modify: `frontend/src/pages/settings/categories/CategoriesPage.vue`

- [ ] **Step 1: Update imports**

Replace `Skeleton` with `SkeletonListItem` and add `SwipeableItem`:
```typescript
import { ref, computed, watch, defineAsyncComponent } from 'vue';
import {
  UButton,
  UIcon,
  UCard,
  UModal,
  SkeletonListItem,
  EmptyState,
  IconBadge,
  SwipeableItem,
} from '@/shared/ui';
```

- [ ] **Step 2: Add `toggleFrequent` function and split categories**

After the `useCategories` destructuring (line 17-18), add:
```typescript
const { categories, createCategory, updateCategory, deleteCategory, reorderCategories, isLoading } =
  useCategories(userId);

// Toggle frequent status
async function toggleFrequent(id: string, isFrequent: boolean) {
  await updateCategory(id, { is_frequent: isFrequent });
}
```

Replace the `localCategories` ref and watch (lines 58-67) with two separate computed + local refs:
```typescript
// Local mutable lists for draggable (filtered by type and frequency)
const localFrequentCategories = ref<UserCategory[]>([]);
const localInfrequentCategories = ref<UserCategory[]>([]);
const showInfrequent = ref(false);

// Watch categories and activeTab to update local lists
watch(
  [categories, activeTab],
  ([cats, tab]) => {
    const filtered = cats.filter((c) => c.type === tab);
    localFrequentCategories.value = filtered.filter((c) => c.is_frequent !== false);
    localInfrequentCategories.value = filtered.filter((c) => c.is_frequent === false);
  },
  { immediate: true },
);

const infrequentCount = computed(() => localInfrequentCategories.value.length);
```

- [ ] **Step 3: Update handleDragEnd to use localFrequentCategories**

```typescript
async function handleDragEnd() {
  const categoryIds = localFrequentCategories.value.map((c) => c.id);
  try {
    await reorderCategories(categoryIds);
  } catch (error) {
    console.error('Failed to reorder categories:', error);
  }
}
```

- [ ] **Step 4: Replace template loading state with SkeletonListItems**

Replace the loading div (lines 201-203):
```html
<!-- Loading state -->
<div v-if="isLoading" class="space-y-3">
  <UCard variant="bordered" class="overflow-hidden">
    <div class="divide-y divide-border-light dark:divide-border-dark">
      <div v-for="i in 5" :key="i" class="p-4">
        <SkeletonListItem :show-trailing="false" avatar-class="w-9 h-9 rounded-xl" />
      </div>
    </div>
  </UCard>
</div>
```

- [ ] **Step 5: Replace categories list template with SwipeableItem sections**

Replace the entire draggable UCard (lines 206-257) and empty state (lines 260-267) with:

```html
<!-- Frequent Categories -->
<template v-else-if="localFrequentCategories.length > 0 || localInfrequentCategories.length > 0">
  <UCard v-if="localFrequentCategories.length > 0" variant="bordered" class="overflow-hidden">
    <draggable
      v-model="localFrequentCategories"
      item-key="id"
      handle=".drag-handle"
      ghost-class="opacity-50"
      animation="200"
      class="divide-y divide-border-light dark:divide-border-dark"
      @end="handleDragEnd"
    >
      <template #item="{ element: category }">
        <SwipeableItem
          :left-action="{ icon: 'visibility_off', color: '#f59e0b', label: 'Скрыть' }"
          :right-action="{ icon: 'edit', color: '#3b82f6', label: 'Изменить' }"
          @action-left="toggleFrequent(category.id, false)"
          @action-right="openEditModal(category)"
        >
          <div
            class="flex items-center gap-3 p-4 bg-surface-light dark:bg-surface-dark"
          >
            <!-- Drag Handle -->
            <div
              class="drag-handle cursor-grab active:cursor-grabbing text-text-tertiary-light dark:text-text-tertiary-dark"
            >
              <UIcon name="drag_indicator" size="sm" />
            </div>

            <!-- Category Icon -->
            <IconBadge :icon="category.icon" size="sm" :color="category.color" class="shrink-0" />

            <!-- Category Name -->
            <span
              class="flex-1 font-medium text-text-primary-light dark:text-text-primary-dark truncate"
            >
              {{ category.name }}
            </span>
          </div>
        </SwipeableItem>
      </template>
    </draggable>
  </UCard>

  <!-- Infrequent Categories Section -->
  <div v-if="infrequentCount > 0" class="space-y-2">
    <button
      class="flex items-center gap-2 w-full px-1 py-2 text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark"
      @click="showInfrequent = !showInfrequent"
    >
      <UIcon
        name="expand_more"
        size="sm"
        class="transition-transform duration-200"
        :class="showInfrequent ? 'rotate-180' : ''"
      />
      Редко используемые ({{ infrequentCount }})
    </button>

    <UCard v-if="showInfrequent" variant="bordered" class="overflow-hidden">
      <div class="divide-y divide-border-light dark:divide-border-dark">
        <SwipeableItem
          v-for="category in localInfrequentCategories"
          :key="category.id"
          :left-action="{ icon: 'visibility', color: '#22c55e', label: 'Показать' }"
          :right-action="{ icon: 'edit', color: '#3b82f6', label: 'Изменить' }"
          @action-left="toggleFrequent(category.id, true)"
          @action-right="openEditModal(category)"
        >
          <div
            class="flex items-center gap-3 p-4 bg-surface-light dark:bg-surface-dark opacity-60"
          >
            <!-- Category Icon -->
            <IconBadge :icon="category.icon" size="sm" :color="category.color" class="shrink-0" />

            <!-- Category Name -->
            <span
              class="flex-1 font-medium text-text-primary-light dark:text-text-primary-dark truncate"
            >
              {{ category.name }}
            </span>
          </div>
        </SwipeableItem>
      </div>
    </UCard>
  </div>
</template>

<!-- Empty state -->
<UCard v-else variant="bordered" class="py-4">
  <EmptyState
    icon="category"
    title="Нет категорий"
    description="Добавьте свои категории для лучшего учета финансов"
    :action="{ label: 'Добавить', onClick: openAddModal }"
  />
</UCard>
```

- [ ] **Step 6: Remove old edit/delete action buttons references**

The old edit/delete buttons were inline in the category row. Now they're handled by swipe actions (edit = swipe right, hide = swipe left). Delete is handled via the edit modal or long press. Keep the `openDeleteModal` function and delete modal for use from edit flows.

- [ ] **Step 7: Verify build**

Run: `cd frontend && bun run build`
Expected: No errors.

- [ ] **Step 8: Commit UI changes**

```bash
git add frontend/src/pages/settings/categories/CategoriesPage.vue
git commit -m "feat: add loading skeleton, frequent/infrequent category sections with swipe"
```

---

## Chunk 4: Migration & Verification

### Task 10: Run Migration and End-to-End Test

- [ ] **Step 1: Run backend migration locally**

```bash
cd backend && bun run migration:run
```
Expected: Migration runs successfully, `is_frequent` column added to `categories` table.

- [ ] **Step 2: Start dev servers and verify**

```bash
bun run dev
```

Test checklist:
1. Categories page shows 5 skeleton items while loading
2. All existing categories appear in "frequent" section
3. Swipe left on a category → orange "Скрыть" button appears → tap it → category moves to "Редко используемые" section
4. "Редко используемые (N)" header appears with chevron
5. Tap header → infrequent section expands
6. Swipe left on infrequent category → green "Показать" button → category returns to frequent section
7. Swipe right on any category → blue "Изменить" button → edit modal opens
8. Drag-and-drop still works in frequent section
9. Switching between Расходы/Доходы tabs works correctly
10. Creating new category adds it to frequent section
