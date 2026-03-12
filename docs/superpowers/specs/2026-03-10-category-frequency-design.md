# Category Frequency & Loading Skeleton

## Summary

Add loading skeletons to the Categories page and allow users to manually mark categories as "frequently used" or "infrequently used". Frequent categories are shown by default; infrequent ones are hidden behind a collapsible section.

## Requirements

1. **Loading skeleton** — replace single skeleton with 4-5 skeleton items matching category card shape
2. **`isFrequent` field** — new boolean column on categories (default `true`), persisted in backend
3. **Swipe to hide** — swipe left on a frequent category shows "Скрыть" button → sets `isFrequent = false`
4. **Swipe to show** — swipe left on an infrequent category shows "Показать" button → sets `isFrequent = true`
5. **Collapsible section** — infrequent categories shown under expandable "Редко используемые (N)" header
6. **All categories start as frequent** — both existing and newly created

## Backend Changes

### ORM Entity (`category.orm-entity.ts`)
- Add `@Column({ name: 'is_frequent', default: true }) isFrequent: boolean`

### Domain Aggregate (`category.aggregate.ts`)
- Add `isFrequent: boolean` to `CategoryProps`
- Add getter, handle in `create()` and `update()`

### Mapper (`category.mapper.ts`)
- Map `isFrequent` in both `toDomain()` and `toOrm()`

### DTOs
- `CreateCategoryDto`: add `@IsOptional() @IsBoolean() isFrequent?: boolean`
- `UpdateCategoryDto`: same

### Commands
- `CreateCategoryCommand`: add `isFrequent` param (default `true`)
- Both handlers: include `isFrequent` in response objects

### Migration
- `ALTER TABLE "categories" ADD "is_frequent" boolean NOT NULL DEFAULT true`

## Frontend Changes

### Types (`entities/category/model/types.ts`)
- Add `is_frequent: boolean` to `UserCategory` type

### API (`entities/category/api/categoriesApi.ts`)
- Add `isFrequent` to `CategoryResponse`
- Map in `transformCategory()`: `is_frequent: response.isFrequent`
- Include in `update()` request body

### Composable (`entities/category/api/useCategories.ts`)
- Add `toggleFrequent(id, isFrequent)` using existing `updateMutation`

### Categories Page (`pages/settings/categories/CategoriesPage.vue`)
- Loading: 4-5 `SkeletonListItem` components
- Split into `frequentCategories` and `infrequentCategories` computed refs
- Use `SwipeableItem` for swipe actions (hide/show)
- Collapsible section with chevron animation for infrequent categories
- Keep drag-and-drop in frequent section

## UI Behavior

- **Frequent section**: drag-and-drop list, swipe left → orange "Скрыть" button
- **Infrequent section**: collapsed by default, header "Редко используемые (N)", swipe left → green "Показать" button
- **Transition**: category animates out of one section into the other on toggle
