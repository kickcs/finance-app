# People/Contacts Feature Design

**Date**: 2026-02-27
**Status**: Approved

## Problem

User frequently enters the same names when creating debts, splitting expenses, and scanning receipts. No autocomplete or saved contacts exist — names are free-text in 3 places:
1. `DebtForm.vue` — person_name field
2. `SplitExpenseSection.vue` — participant name input
3. `Step3AssignParticipants.vue` — participant name in receipt scanning

## Decision

- **Storage**: Backend (PostgreSQL table, syncs across devices)
- **Data**: Name + color (visual identifier)
- **Management**: Dedicated page + inline creation in forms
- **Access**: Free for all users (not premium-gated)
- **Architecture**: Separate `Person` entity (Approach A — full DDD module)

## Backend — Module `person`

New bounded context at `backend/src/modules/person/`.

### Domain
- `PersonAggregate` — id, userId, name, color, createdAt, updatedAt
- `PersonRepository` interface

### API Endpoints
- `GET /api/people` — list user's people
- `POST /api/people` — create (body: `{name, color?}`)
- `PATCH /api/people/:id` — update name/color
- `DELETE /api/people/:id` — delete

### Database
Table `people`:
- `id` (uuid PK)
- `user_id` (uuid FK → users)
- `name` (varchar, not null)
- `color` (varchar, nullable — hex from ENTITY_COLORS)
- `created_at` (timestamp)
- `updated_at` (timestamp)
- Index on `user_id`

Color auto-assigned from `ENTITY_COLORS` rotation if not provided.

## Frontend — Entity `person`

At `frontend/src/entities/person/`:

- **model/types.ts**: `Person { id, user_id, name, color }`
- **api/personApi.ts**: CRUD HTTP functions (camelCase → snake_case transform)
- **api/usePeople.ts**: Vue Query composable — `people`, `createPerson`, `updatePerson`, `deletePerson`
- **api/queryKeys.ts**: query key factory
- **ui/PersonChip.vue**: compact chip with colored circle + name

## Frontend — Management Page

Route: `/people` (accessible from profile page)

- List of people with colored avatars (first letter of name)
- "Add" button → modal with name + color picker fields
- Swipe to delete (consistent with other lists)
- Tap to edit → same modal
- `EmptyState` when list is empty

## Frontend — Form Integration (PersonSelector)

Component `PersonSelector` at `entities/person/ui/`:
- Horizontal scrollable chips showing saved people
- Tap chip → selects name
- Text input below for new name (can use without saving)
- "+" button next to input → saves new person to list

### Integration Points
1. **DebtForm.vue** — replace `person_name` UInput with PersonSelector
2. **SplitExpenseSection.vue** — show PersonSelector when adding participant
3. **Step3AssignParticipants.vue** — show PersonSelector in add-participant modal
