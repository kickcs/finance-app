# Monetization Design: Soft Paywall + Premium Subscription

**Date**: 2026-02-22
**Status**: Draft
**Approach**: Soft Paywall — all current features remain free, new premium features behind subscription

## Context

Ouro — PWA для личных финансов (Vue 3 + NestJS). Сейчас полностью бесплатное. Цель монетизации — дополнительный доход (side-проект). Аудитория глобальная, <100 пользователей. Без рекламы.

## Pricing

| Plan | Price | Features |
|------|-------|----------|
| **Free** | $0 | Всё текущее: безлимитные счета, транзакции, долги, цели, напоминания, базовая аналитика (текущий месяц), 6 валют, кастомизация категорий, CSV импорт, PWA |
| **Premium Monthly** | $1.99/мес | Все Free + premium-фичи |
| **Premium Yearly** | $14.99/год (~37% скидка) | Все Free + premium-фичи |

- 7-дневный бесплатный trial при первой активации
- Stripe Checkout для оплаты

## Premium Features

1. **Расширенная аналитика** — тренды за любой период, сравнение месяцев, прогноз расходов
2. **Экспорт данных** — PDF/Excel отчёты
3. **Рекуррентные транзакции** — автоматическое создание повторяющихся транзакций
4. **Бюджеты по категориям** — лимиты с уведомлениями о превышении
5. **Дополнительные темы оформления**
6. **Ранний доступ к новым функциям**

## Payment System

**Stripe** via `@golevelup/nestjs-stripe` plugin:
- Stripe Checkout (hosted payment page)
- Webhook-и для синхронизации статуса подписки
- Stripe Customer Portal для управления подпиской (отмена, смена плана)
- Комиссия: 2.9% + $0.30 за транзакцию

## Architecture

### Backend — New Bounded Context: `subscription`

```
backend/src/modules/subscription/
├── domain/
│   ├── entities/
│   │   └── user-subscription.entity.ts      # Subscription aggregate
│   ├── enums/
│   │   ├── subscription-plan.enum.ts         # FREE, PREMIUM_MONTHLY, PREMIUM_YEARLY
│   │   └── subscription-status.enum.ts       # ACTIVE, TRIALING, CANCELED, EXPIRED
│   └── repositories/
│       └── user-subscription.repository.ts   # Interface
├── application/
│   ├── commands/
│   │   ├── create-checkout-session/           # Создать Stripe Checkout session
│   │   ├── handle-webhook/                    # Обработать Stripe webhook events
│   │   └── cancel-subscription/               # Отмена подписки
│   └── queries/
│       └── get-subscription-status/           # Текущий статус подписки
├── infrastructure/
│   ├── persistence/
│   │   ├── entities/                          # TypeORM entity
│   │   ├── mappers/                           # Domain ↔ ORM mapper
│   │   └── repositories/                      # TypeORM repository impl
│   └── stripe/
│       └── stripe-webhook.handler.ts          # @StripeWebhookHandler decorators
├── presentation/
│   ├── controllers/
│   │   └── subscription.controller.ts         # REST endpoints
│   └── dtos/
│       ├── create-checkout-session.dto.ts
│       └── subscription-status.response.ts
├── guards/
│   └── premium.guard.ts                       # @RequiresPremium() decorator + guard
└── subscription.module.ts
```

#### Database Schema

```sql
CREATE TABLE user_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),
    plan VARCHAR(50) NOT NULL DEFAULT 'free',        -- free, premium_monthly, premium_yearly
    status VARCHAR(50) NOT NULL DEFAULT 'active',    -- active, trialing, canceled, past_due, expired
    trial_start TIMESTAMP,
    trial_end TIMESTAMP,
    current_period_start TIMESTAMP,
    current_period_end TIMESTAMP,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id)
);
```

#### API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/subscription/status` | JWT | Текущий статус подписки |
| POST | `/api/subscription/checkout` | JWT | Создать Stripe Checkout Session |
| POST | `/api/subscription/portal` | JWT | Получить URL Stripe Customer Portal |
| POST | `/api/stripe/webhook` | Stripe Signature | Webhook handler (via @golevelup/nestjs-stripe) |

#### Stripe Webhook Events

- `checkout.session.completed` → Активировать подписку
- `invoice.paid` → Продлить подписку
- `invoice.payment_failed` → Пометить как `past_due`
- `customer.subscription.updated` → Обновить план/статус
- `customer.subscription.deleted` → Деактивировать подписку

#### Premium Guard

```typescript
@Injectable()
export class PremiumGuard implements CanActivate {
  // Проверяет user_subscriptions.status IN ('active', 'trialing')
  // Для premium-only эндпоинтов: @UseGuards(PremiumGuard)
  // Для проверки в логике: subscriptionService.isPremium(userId)
}
```

### Frontend

```
frontend/src/
├── entities/subscription/
│   ├── api/
│   │   ├── subscriptionApi.ts              # HTTP calls
│   │   ├── useSubscription.ts              # Vue Query composable
│   │   └── queryKeys.ts
│   └── model/
│       ├── types.ts                        # SubscriptionStatus, Plan types
│       └── constants.ts                    # Plan details, prices
├── features/
│   ├── upgrade-to-premium/
│   │   ├── ui/
│   │   │   ├── PremiumUpgradeModal.vue     # Модалка при клике на locked feature
│   │   │   ├── PricingCards.vue            # Карточки планов
│   │   │   └── PremiumBadge.vue            # Badge "Premium" на locked фичах
│   │   └── model/
│   │       └── useUpgrade.ts               # Логика checkout
│   └── manage-subscription/
│       └── ui/
│           └── SubscriptionSection.vue     # Секция в профиле
├── shared/
│   └── lib/
│       └── composables/
│           └── usePremiumFeature.ts         # Hook: isPremium, showUpgradeModal()
```

#### UX Flow: Soft Paywall

1. Пользователь видит premium-фичу в UI (например, «Тренды» в аналитике)
2. Фича показана, но с `PremiumBadge` и заблокирована
3. При клике → `PremiumUpgradeModal` с описанием + «Попробовать 7 дней бесплатно»
4. Кнопка → redirect на Stripe Checkout (hosted page)
5. После оплаты → Stripe redirect back + webhook активирует подписку
6. `useSubscription()` обновляет кэш → фичи разблокируются

#### Subscription Management (Profile)

- В профиле: секция «Подписка» с текущим статусом
- Free: «Перейти на Premium» с описанием преимуществ
- Premium: текущий план, дата следующей оплаты, кнопка «Управление» → Stripe Customer Portal

## UX Principles

- **Не агрессивно**: Premium-фичи видны, но не мешают пользованию бесплатными функциями
- **Мягкие напоминания**: PremiumBadge на locked фичах, без popup-ов и баннеров
- **Прозрачность**: Цены видны сразу, trial без скрытых условий
- **Гранулярный контроль**: `usePremiumFeature('feature_name')` проверяет доступ по конкретной фиче

## Environment Variables

```bash
# Backend (.env)
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PREMIUM_MONTHLY_PRICE_ID=price_...
STRIPE_PREMIUM_YEARLY_PRICE_ID=price_...

# Frontend (.env)
VITE_STRIPE_PUBLISHABLE_KEY=pk_...
```

## Migration Plan (Existing Users)

- Все текущие пользователи остаются на Free плане (ничего не теряют)
- При первом запуске после обновления: создаётся запись `user_subscriptions` с `plan: 'free'`
- Опционально: дать текущим пользователям 30-дневный бесплатный trial Premium как "спасибо" за ранний доступ

## Out of Scope (Future)

- AI-инсайты по расходам (потребует LLM интеграции)
- Автоматическая категоризация транзакций
- Push-уведомления о бюджетах
- Referral программа
- Промокоды и купоны
