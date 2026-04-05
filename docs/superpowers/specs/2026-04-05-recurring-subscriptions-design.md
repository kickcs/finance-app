# Recurring Subscriptions Tracker — Design Spec

## Overview

Replace the unused Reminders module with a full-featured Recurring Subscriptions tracker. Users can track external service subscriptions (Netflix, Spotify, etc.) with calendar view, push notifications, and optional auto-charge that creates transactions automatically.

**Scope**: Full-stack feature — new backend module, reusable push notification service, frontend calendar UI, dashboard widget.

**Access**: Free for all users (no premium gate).

## Data Model

### Table: `recurring_subscriptions`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | |
| user_id | UUID | FK -> profiles, NOT NULL | |
| name | VARCHAR | NOT NULL | Display name (Netflix, Spotify...) |
| description | TEXT | nullable | User notes |
| amount | DECIMAL(18,2) | NOT NULL | Billing amount |
| currency | VARCHAR | NOT NULL | Currency code (USD, UZS, EUR...) |
| account_id | UUID | FK -> accounts, nullable | Linked account for auto-charge |
| icon | VARCHAR | NOT NULL | Preset key ("netflix") or Material Symbol ("fitness_center") |
| color | VARCHAR | NOT NULL | Hex color (#e50914) |
| frequency | VARCHAR | NOT NULL | weekly, monthly, quarterly, yearly, custom |
| frequency_days | INT | nullable | Only for custom — every N days |
| billing_date | DATE | NOT NULL | Next billing date |
| notify_days_before | INT | NOT NULL, default 2 | Per-subscription notification lead time |
| category_id | VARCHAR | NOT NULL, default 'entertainment' | Expense category for auto-charge transactions |
| auto_charge | BOOLEAN | NOT NULL, default false | Auto-create transaction on billing_date |
| status | VARCHAR | NOT NULL, default 'active' | active, paused |
| created_at | TIMESTAMP | NOT NULL | |
| updated_at | TIMESTAMP | NOT NULL | |

### Table: `push_subscriptions`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | |
| user_id | UUID | FK -> profiles, NOT NULL | |
| endpoint | TEXT | NOT NULL | Web Push endpoint URL |
| p256dh | TEXT | NOT NULL | Encryption key |
| auth | TEXT | NOT NULL | Auth secret |
| user_agent | VARCHAR | nullable | Device identification |
| created_at | TIMESTAMP | NOT NULL | |

### Profile change

Add `timezone` field to profiles table. Default: `Asia/Tashkent`. Frontend auto-detects via `Intl.DateTimeFormat().resolvedOptions().timeZone`.

### Migration

- DROP TABLE `reminders`
- CREATE TABLE `recurring_subscriptions`
- CREATE TABLE `push_subscriptions`
- ALTER TABLE `profiles` ADD COLUMN `timezone` VARCHAR DEFAULT 'Asia/Tashkent'

## Backend Architecture

### Module: `notification/` (reusable)

Standalone module for push notifications. Any module can inject `PushNotificationService` to send notifications.

**Structure:**
```
modules/notification/
  domain/
    aggregates/push-subscription/
    repositories/push-subscription.repository.interface.ts
  application/
    commands/   RegisterPushSubscription, UnregisterPushSubscription
    queries/    GetUserPushSubscriptions
    services/   PushNotificationService
  infrastructure/
    persistence/  ORM entity, mapper, repository impl
  presentation/
    controllers/  push-subscription.controller.ts
    dto/          RegisterPushSubscriptionDto
```

**API endpoints:**
- `POST /api/push-subscriptions` — register device (endpoint, p256dh, auth)
- `DELETE /api/push-subscriptions/:id` — unregister device

**PushNotificationService:**
- Uses `web-push` npm package with VAPID keys
- `sendToUser(userId, { title, body, icon?, url?, tag? })` — sends to all user's registered devices
- Handles expired/invalid subscriptions (auto-cleanup on 410 response)

**Environment variables:**
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT` (mailto: URL)

### Module: `recurring-subscription/` (replaces planning/reminder)

**Structure:**
```
modules/recurring-subscription/
  domain/
    aggregates/recurring-subscription/
    repositories/recurring-subscription.repository.interface.ts
  application/
    commands/   Create, Update, Delete, Pause, Resume, ProcessAutoCharge, ProcessNotifications
    queries/    GetAll, GetById, GetUpcoming, GetCalendar
    services/   SubscriptionCronService
  infrastructure/
    persistence/  ORM entity, mapper, repository impl
  presentation/
    controllers/  recurring-subscriptions.controller.ts
    dto/
```

**API endpoints:**
- `GET /api/recurring-subscriptions` — all user subscriptions
- `GET /api/recurring-subscriptions/calendar?month=2026-04` — subscriptions with dates for calendar view
- `GET /api/recurring-subscriptions/upcoming?days=7` — upcoming charges
- `GET /api/recurring-subscriptions/:id`
- `POST /api/recurring-subscriptions`
- `PATCH /api/recurring-subscriptions/:id`
- `PATCH /api/recurring-subscriptions/:id/pause`
- `PATCH /api/recurring-subscriptions/:id/resume`
- `DELETE /api/recurring-subscriptions/:id`

### SubscriptionCronService

Runs every hour. For each run:

1. Determine which users have ~12:00 local time right now (using profile timezone)
2. **Notification check**: Find active subscriptions where `billing_date - notify_days_before = today`. Send push: "Netflix — $15 через 2 дня"
3. **Auto-charge check**: Find active subscriptions where `auto_charge=true` AND `billing_date = today`. For each:
   - Create expense transaction via `CommandBus` (amount, currency, accountId, categoryId — user-selected per subscription, default: "entertainment")
   - Advance `billing_date` to next period based on frequency
   - Send push: "Списано $15 за Netflix · Kaspi"

## Frontend Architecture

### Entity: `recurring-subscription/`

```
entities/recurring-subscription/
  model/
    types.ts            RecurringSubscription, Frequency, SubscriptionStatus
    constants.ts        SERVICE_PRESETS: {netflix: {icon, color, name}, spotify: ...}
    utils.ts            getNextBillingDate, daysUntilBilling, formatFrequency
  api/
    recurringSubscriptionApi.ts
    useRecurringSubscriptions.ts    CRUD + pause/resume
    useSubscriptionCalendar.ts      calendar query by month
    useUpcomingSubscriptions.ts     upcoming within N days
    queryKeys.ts
  ui/
    SubscriptionCard.vue
    SubscriptionCalendar.vue        mini-calendar with icons in day cells
    SubscriptionListItem.vue        list item below calendar
    SubscriptionCardSkeleton.vue
  index.ts
```

### Entity: `push-subscription/`

```
entities/push-subscription/
  api/
    pushSubscriptionApi.ts          register, unregister
    usePushSubscription.ts          registration + permission status
    queryKeys.ts
  model/
    types.ts
  index.ts
```

### Features

```
features/
  create-subscription/              creation form with service presets + custom
  edit-subscription/                editing form
  manage-push-notifications/        push toggle in profile
```

### Widgets

```
widgets/
  UpcomingSubscriptions/            dashboard widget: 3 nearest + "View all"
  UpcomingSubscriptionsSkeleton.vue
```

### Pages

```
pages/
  subscriptions/
    SubscriptionsPage.vue           calendar + full list + FAB "add"
  subscription-detail/
    SubscriptionDetailPage.vue      details + edit/pause/delete
```

### Routing

- `/subscriptions` — calendar page
- `/subscriptions/:id` — subscription detail
- Dashboard widget links to `/subscriptions`

### Calendar UI

- Mini month calendar at top with subscription icons rendered inside day cells
- Days with subscriptions highlighted with subscription color as background tint
- Up to 2-3 icons per day cell; if more, show "+N"
- Tap on day — shows subscriptions for that day
- Month navigation arrows + total monthly amount
- Below calendar — chronological list sorted by nearest billing_date
- List items show: icon, name, date/countdown, account, amount, "auto" badge if auto-charge enabled

### Service Presets

Predefined icons and colors for popular services:

```typescript
const SERVICE_PRESETS = {
  netflix:       { name: 'Netflix',        icon: 'netflix',        color: '#e50914' },
  spotify:       { name: 'Spotify',        icon: 'spotify',        color: '#1DB954' },
  youtube:       { name: 'YouTube Premium',icon: 'youtube',        color: '#FF0000' },
  apple_music:   { name: 'Apple Music',    icon: 'apple_music',    color: '#FA2D48' },
  icloud:        { name: 'iCloud',         icon: 'icloud',         color: '#3498db' },
  telegram:      { name: 'Telegram Premium',icon: 'telegram',      color: '#2AABEE' },
  yandex_plus:   { name: 'Яндекс Плюс',   icon: 'yandex_plus',    color: '#FFCC00' },
  chatgpt:       { name: 'ChatGPT Plus',   icon: 'chatgpt',       color: '#10A37F' },
  // ... extend as needed
}
```

Preset icons stored as small SVGs or emoji with fallback to Material Symbols for custom subscriptions.

### Push Notification Flow

**Registration:**
1. App checks `Notification.permission`
2. If `default` — show banner "Включите уведомления, чтобы не пропустить списания"
3. On consent — `Notification.requestPermission()` → `pushManager.subscribe({ applicationServerKey: VAPID_PUBLIC_KEY })`
4. Send `POST /api/push-subscriptions` with endpoint, p256dh, auth
5. Profile has toggle "Push-уведомления" for management

**Service Worker:**
```
push event → self.registration.showNotification(title, { body, icon, data: { url } })
notificationclick → clients.openWindow(event.notification.data.url)
```

## Removal: Reminders Module

Complete removal of the Reminders module:

**Backend:**
- Delete `modules/planning/domain/aggregates/reminder/`
- Delete reminder commands, queries, handlers
- Delete reminder ORM entity, mapper, repository
- Delete `reminders.controller.ts` + DTOs
- Remove reminder providers from `planning.module.ts`

**Frontend:**
- Delete `entities/reminder/` entirely
- Delete `features/create-reminder/`, `features/edit-reminder/`
- Delete `widgets/RemindersSection/`
- Remove RemindersSection from dashboard
- Remove `/reminders` routes
- Clean up all `useReminders` imports

## Summary of Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| New entity vs extend reminders | New entity, replace reminders | Nobody uses reminders; clean slate |
| Frequency options | weekly, monthly, quarterly, yearly, custom(N days) | Flexible, UI optimized for monthly/yearly |
| Notification timing | Per-subscription `notify_days_before` | Different lead times for different subscriptions |
| Auto-charge behavior | Create transaction + push notification | User stays informed about automatic charges |
| Calendar view | Mini-calendar with icons in cells + list below | Visual + practical combined view |
| Navigation | Dashboard widget + `/subscriptions` page | No BottomNav changes needed |
| Icons | Service presets + Material Symbols fallback | Best of both: recognizable brands + custom |
| Subscription pausing | active/paused status | Pause without deleting |
| Push notification architecture | Reusable `notification/` module | Other modules can use push later |
| Scheduling approach | Cron-based (hourly) | Simple, sufficient for daily notifications |
| Notification time | 12:00 user local time, timezone in profile | Respectful of user timezone |
| Premium gating | Free for all | User acquisition feature |
