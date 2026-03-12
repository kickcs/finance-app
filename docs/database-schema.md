# Database Schema

## Overview

- **DBMS**: PostgreSQL
- **ORM**: TypeORM (synchronize: false, migrations only)
- **Total Tables**: 13
- **Multi-tenancy**: All tables except `exchange_rates` have `user_id` for tenant isolation

---

## Tables

### 1. profiles

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| id | uuid | NO | - | PK |
| name | varchar | YES | - | - |
| email | varchar | YES | - | - |
| currency | varchar | NO | 'RUB' | - |
| has_completed_onboarding | boolean | NO | false | - |
| default_account_id | uuid | YES | - | - |
| created_at | timestamp with time zone | NO | auto | - |
| is_demo | boolean | NO | false | - |
| demo_expires_at | timestamp with time zone | YES | - | - |
| password_hash | varchar | YES | - | - |
| refresh_token | text | YES | - | - |
| dashboard_settings | jsonb | YES | - | - |
| quick_actions_hidden | boolean | NO | false | - |
| quick_actions_hint_dismissed | boolean | NO | false | - |

---

### 2. settings

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| id | uuid | NO | auto | PK |
| user_id | uuid | NO | - | UNIQUE |
| theme | varchar | NO | 'system' | - |
| language | varchar | NO | 'en' | - |
| notifications_enabled | boolean | NO | true | - |

---

### 3. accounts

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| id | uuid | NO | auto | PK |
| user_id | uuid | NO | - | - |
| name | varchar | NO | - | - |
| balance | decimal(18,2) | NO | 0 | - |
| currency | varchar | NO | 'USD' | - |
| icon | varchar | NO | - | - |
| color | varchar | NO | - | - |
| type | varchar | NO | 'basic' | - |
| order | integer | NO | 0 | - |
| credit_limit | decimal(18,2) | YES | - | - |
| grace_period_days | integer | YES | - | - |
| billing_day | integer | YES | - | - |
| total_amount | decimal(18,2) | YES | - | - |
| interest_rate | decimal(5,2) | YES | - | - |
| monthly_payment | decimal(18,2) | YES | - | - |
| start_date | date | YES | - | - |
| end_date | date | YES | - | - |
| maturity_date | date | YES | - | - |
| is_replenishable | boolean | YES | - | - |
| is_withdrawable | boolean | YES | - | - |
| created_at | timestamp with time zone | NO | auto | - |

**Relations**: OneToMany -> `account_balances` (cascade delete)

---

### 4. account_balances

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| id | uuid | NO | auto | PK |
| account_id | uuid | NO | - | FK -> accounts.id (CASCADE) |
| currency | varchar | NO | - | UNIQUE(account_id, currency) |
| balance | decimal(18,2) | NO | 0 | - |
| created_at | timestamp with time zone | NO | auto | - |

**Relations**: ManyToOne -> `accounts` (onDelete: CASCADE)

---

### 5. transactions

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| id | uuid | NO | auto | PK |
| user_id | uuid | NO | - | - |
| account_id | uuid | NO | - | - |
| category_id | text | NO | - | - |
| amount | decimal(18,2) | NO | - | - |
| currency | varchar | NO | 'UZS' | - |
| type | varchar | NO | - | - |
| description | text | YES | - | - |
| date | timestamp with time zone | NO | - | - |
| created_at | timestamp with time zone | NO | auto | - |
| is_debt_related | boolean | NO | false | - |
| debt_id | uuid | YES | - | - |
| to_account_id | uuid | YES | - | - |
| to_amount | decimal(18,2) | YES | - | - |
| to_currency | varchar | YES | - | - |

---

### 6. categories

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| id | uuid | NO | auto | PK |
| user_id | uuid | NO | - | - |
| name | varchar | NO | - | - |
| icon | varchar | NO | - | - |
| color | varchar | NO | - | - |
| type | varchar | NO | - | - |
| sort_order | integer | NO | 0 | - |
| created_at | timestamp with time zone | NO | auto | - |

---

### 7. quick_actions

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| id | uuid | NO | auto | PK |
| user_id | uuid | NO | - | - |
| category_id | uuid | NO | - | - |
| account_id | uuid | NO | - | - |
| label | varchar | NO | - | - |
| position | smallint | NO | 0 | - |
| created_at | timestamp with time zone | NO | auto | - |
| updated_at | timestamp with time zone | NO | auto | - |

---

### 8. debts

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| id | uuid | NO | auto | PK |
| user_id | uuid | NO | - | - |
| name | varchar | NO | - | - |
| total_amount | decimal(18,2) | NO | - | - |
| remaining_amount | decimal(18,2) | NO | - | - |
| monthly_payment | decimal(18,2) | YES | - | - |
| next_payment_date | date | YES | - | - |
| created_at | timestamp with time zone | NO | auto | - |
| debt_type | varchar | NO | 'taken' | - |
| person_name | varchar | YES | - | - |
| account_id | uuid | YES | - | - |
| transaction_id | uuid | YES | - | - |
| close_transaction_id | uuid | YES | - | - |
| is_closed | boolean | NO | false | - |
| currency | varchar | NO | 'UZS' | - |
| source_transaction_id | uuid | YES | - | - |

---

### 9. goals

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| id | uuid | NO | auto | PK |
| user_id | uuid | NO | - | - |
| name | varchar | NO | - | - |
| target_amount | decimal(18,2) | NO | - | - |
| current_amount | decimal(18,2) | NO | 0 | - |
| deadline | date | YES | - | - |
| icon | varchar | NO | - | - |
| color | varchar | NO | - | - |
| created_at | timestamp with time zone | NO | auto | - |

---

### 10. reminders

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| id | uuid | NO | auto | PK |
| user_id | uuid | NO | - | - |
| name | varchar | NO | - | - |
| amount | decimal(18,2) | NO | - | - |
| frequency | varchar | NO | - | - |
| next_date | date | NO | - | - |
| icon | varchar | NO | - | - |
| color | varchar | NO | - | - |
| is_active | boolean | NO | true | - |
| created_at | timestamp with time zone | NO | auto | - |

---

### 11. people

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| id | uuid | NO | auto | PK |
| user_id | uuid | NO | - | - |
| name | varchar | NO | - | - |
| color | varchar | NO | - | - |
| created_at | timestamp with time zone | NO | auto | - |
| updated_at | timestamp with time zone | NO | auto | - |

---

### 12. exchange_rates

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| base_currency | varchar(3) | NO | - | PK (composite) |
| target_currency | varchar(3) | NO | - | PK (composite) |
| rate | decimal(18,8) | NO | - | - |
| updated_at | timestamp with time zone | NO | auto | - |

---

### 13. user_subscriptions

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| id | uuid | NO | auto | PK |
| user_id | uuid | NO | - | UNIQUE |
| lemon_customer_id | varchar | YES | - | - |
| lemon_subscription_id | varchar | YES | - | - |
| variant_id | varchar | YES | - | - |
| plan | varchar | NO | 'free' | - |
| status | varchar | NO | 'active' | - |
| trial_start | timestamp | YES | - | - |
| trial_end | timestamp | YES | - | - |
| current_period_start | timestamp | YES | - | - |
| current_period_end | timestamp | YES | - | - |
| cancel_at_period_end | boolean | NO | false | - |
| created_at | timestamp with time zone | NO | auto | - |
| updated_at | timestamp with time zone | NO | auto | - |

---

## Entity Relationships

```
profiles (1) -------- (*) accounts
profiles (1) -------- (1) settings
profiles (1) -------- (*) transactions
profiles (1) -------- (*) categories
profiles (1) -------- (*) debts
profiles (1) -------- (*) goals
profiles (1) -------- (*) reminders
profiles (1) -------- (*) people
profiles (1) -------- (*) quick_actions
profiles (1) -------- (1) user_subscriptions

accounts (1) -------- (*) account_balances  [CASCADE DELETE]
```

## Key Notes

- **Primary Keys**: All tables use UUID except `exchange_rates` (composite PK: base_currency + target_currency)
- **Unique Constraints**: `settings.user_id`, `account_balances(account_id, currency)`, `user_subscriptions.user_id`
- **Timestamps**: All entities have `created_at` (`@CreateDateColumn`). `quick_actions`, `people`, `user_subscriptions` also have `updated_at` (`@UpdateDateColumn`)
- **Cascade**: Only `account_balances` has CASCADE DELETE from `accounts`
- **Logical FKs**: `transactions.account_id`, `transactions.debt_id`, `debts.account_id`, etc. are logical references without TypeORM relation decorators
