# Custom Quick Actions Design

## Summary

Replace hardcoded quick action buttons on dashboard with user-configurable expense presets. Each button stores a category + account pair. Tapping opens AddTransaction pre-filled with that category and account.

## Data Model

Stored in localStorage key `quick_actions`:

```typescript
interface QuickAction {
  id: string;
  label: string;       // from category name, user can rename
  categoryId: string;
  accountId: string;
}
```

Max 4 slots. Default: empty array (show 4 empty `+` slots).

## Dashboard UX

- **Empty slot**: `+` icon, label "Добавить". Tap → create preset modal.
- **Filled slot**: category icon + color, category name label. Tap → `/transactions/new?type=expense&categoryId=X&accountId=Y`
- **Edit**: long-press OR edit button in section header → edit preset modal
- **Delete**: inside edit modal

## Create/Edit Modal

Single modal with two steps:
1. Pick expense category (grid of category icons from EXPENSE_CATEGORIES)
2. Pick account (list of user's accounts)

Optional: custom label override.

## Settings Page

New item in profile page: "Быстрые действия" → dedicated settings page with 4 slots, same modals.

## AddTransactionPage Changes

Accept `?categoryId=` and `?accountId=` query params to pre-fill the form fields on mount.
