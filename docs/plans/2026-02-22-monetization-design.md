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
| **Premium Monthly** | $2.99/мес | Все Free + premium-фичи |
| **Premium Yearly** | $16.99/год (~53% скидка) | Все Free + premium-фичи |

- 7-дневный бесплатный trial при первой активации
- LemonSqueezy Checkout для оплаты

## Premium Features

1. **Расширенная аналитика** — тренды за любой период, сравнение месяцев, прогноз расходов
2. **Экспорт данных** — PDF/Excel отчёты
3. **Рекуррентные транзакции** — автоматическое создание повторяющихся транзакций
4. **Бюджеты по категориям** — лимиты с уведомлениями о превышении
5. **Дополнительные темы оформления**
6. **Ранний доступ к новым функциям**

## Payment System

**LemonSqueezy** (Merchant of Record):
- LemonSqueezy Checkout Overlay (JS SDK встраивается в приложение)
- Webhook-и для синхронизации статуса подписки
- LemonSqueezy Customer Portal для управления подпиской (отмена, смена плана)
- Берёт на себя налоги/VAT по всему миру — не нужно думать о tax compliance
- Комиссия: 5% + $0.50 за транзакцию

### Почему LemonSqueezy

- **Merchant of Record** — LemonSqueezy является продавцом, сами решают вопросы с налогами, VAT, invoicing
- **Проще для indie** — не нужно регистрировать бизнес, не нужно думать о tax compliance
- **Checkout Overlay** — встраиваемый checkout прямо в приложение (без redirect на внешнюю страницу)
- **Customer Portal** — готовый портал для управления подпиской

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
│   │   ├── create-checkout/                   # Сгенерировать LemonSqueezy checkout URL
│   │   ├── handle-webhook/                    # Обработать LemonSqueezy webhook events
│   │   └── cancel-subscription/               # Отмена подписки
│   └── queries/
│       └── get-subscription-status/           # Текущий статус подписки
├── infrastructure/
│   ├── persistence/
│   │   ├── entities/                          # TypeORM entity
│   │   ├── mappers/                           # Domain ↔ ORM mapper
│   │   └── repositories/                      # TypeORM repository impl
│   └── lemonsqueezy/
│       ├── lemonsqueezy.service.ts            # LemonSqueezy API client
│       └── lemonsqueezy-webhook.service.ts    # Webhook signature verification + routing
├── presentation/
│   ├── controllers/
│   │   └── subscription.controller.ts         # REST endpoints
│   └── dtos/
│       ├── create-checkout.dto.ts
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
    lemon_customer_id VARCHAR(255),
    lemon_subscription_id VARCHAR(255),
    plan VARCHAR(50) NOT NULL DEFAULT 'free',        -- free, premium_monthly, premium_yearly
    status VARCHAR(50) NOT NULL DEFAULT 'active',    -- active, trialing, canceled, past_due, expired
    variant_id VARCHAR(255),                         -- LemonSqueezy variant ID
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
| POST | `/api/subscription/checkout` | JWT | Сгенерировать LemonSqueezy checkout URL |
| POST | `/api/subscription/portal` | JWT | Получить URL Customer Portal |
| POST | `/api/webhooks/lemonsqueezy` | HMAC Signature | Webhook handler |

#### LemonSqueezy Webhook Events

- `subscription_created` → Создать/активировать подписку
- `subscription_updated` → Обновить план/статус (renewal, plan change)
- `subscription_cancelled` → Пометить `cancel_at_period_end: true`
- `subscription_expired` → Деактивировать подписку
- `subscription_payment_success` → Подтвердить оплату
- `subscription_payment_failed` → Пометить как `past_due`

#### Webhook Signature Verification

```typescript
// LemonSqueezy подписывает webhooks через HMAC SHA-256
// Header: X-Signature
// Верифицируем через crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
```

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
│       └── constants.ts                    # Plan details, prices, variant IDs
├── features/
│   ├── upgrade-to-premium/
│   │   ├── ui/
│   │   │   ├── PremiumUpgradeModal.vue     # Модалка при клике на locked feature
│   │   │   ├── PricingCards.vue            # Карточки планов
│   │   │   └── PremiumBadge.vue            # Badge "Premium" на locked фичах
│   │   └── model/
│   │       └── useUpgrade.ts               # Логика checkout (LemonSqueezy JS SDK)
│   └── manage-subscription/
│       └── ui/
│           └── SubscriptionSection.vue     # Секция в профиле
├── shared/
│   └── lib/
│       └── composables/
│           └── usePremiumFeature.ts         # Hook: isPremium, showUpgradeModal()
```

#### LemonSqueezy JS SDK Integration

```typescript
// В index.html или загрузка через useHead()
// <script src="https://app.lemonsqueezy.com/js/lemon.js" defer></script>

// Открытие checkout overlay:
window.createLemonSqueezy()
window.LemonSqueezy.Url.Open(checkoutUrl)

// checkoutUrl генерируется на backend через LemonSqueezy API
// с custom data: { user_id: currentUser.id } для привязки к пользователю
```

#### UX Flow: Soft Paywall

1. Пользователь видит premium-фичу в UI (например, «Тренды» в аналитике)
2. Фича показана, но с `PremiumBadge` и заблокирована
3. При клике → `PremiumUpgradeModal` с описанием + «Попробовать 7 дней бесплатно»
4. Кнопка → backend генерирует checkout URL → LemonSqueezy Overlay opens in-app
5. После оплаты → webhook активирует подписку
6. `useSubscription()` обновляет кэш → фичи разблокируются

#### Subscription Management (Profile)

- В профиле: секция «Подписка» с текущим статусом
- Free: «Перейти на Premium» с описанием преимуществ
- Premium: текущий план, дата следующей оплаты, кнопка «Управление» → LemonSqueezy Customer Portal

## UX Principles

- **Не агрессивно**: Premium-фичи видны, но не мешают пользованию бесплатными функциями
- **Мягкие напоминания**: PremiumBadge на locked фичах, без popup-ов и баннеров
- **Прозрачность**: Цены видны сразу, trial без скрытых условий
- **Гранулярный контроль**: `usePremiumFeature('feature_name')` проверяет доступ по конкретной фиче

## Environment Variables

```bash
# Backend (.env)
LEMONSQUEEZY_API_KEY=...
LEMONSQUEEZY_WEBHOOK_SECRET=...
LEMONSQUEEZY_STORE_ID=...
LEMONSQUEEZY_PREMIUM_MONTHLY_VARIANT_ID=...
LEMONSQUEEZY_PREMIUM_YEARLY_VARIANT_ID=...

# Frontend (.env) — не нужен API key, checkout открывается через URL от backend
```

## LemonSqueezy Setup (Manual Steps)

1. Создать аккаунт на lemonsqueezy.com
2. Создать Store
3. Создать Product «Ouro Premium» с двумя вариантами:
   - Monthly: $2.99/мес с 7-day free trial
   - Yearly: $16.99/год с 7-day free trial
4. Настроить Webhook URL: `https://your-domain.com/api/webhooks/lemonsqueezy`
5. Скопировать API Key, Webhook Secret, Store ID, Variant IDs в .env

## Migration Plan (Existing Users)

- Все текущие пользователи остаются на Free плане (ничего не теряют)
- При первом запуске после обновления: создаётся запись `user_subscriptions` с `plan: 'free'`
- Опционально: дать текущим пользователям 30-дневный бесплатный trial Premium как "спасибо" за ранний доступ

## Out of Scope (Future)

- AI-инсайты по расходам (потребует LLM интеграции)
- Автоматическая категоризация транзакций
- Push-уведомления о бюджетах
- Referral программа
- Промокоды и купоны (LemonSqueezy поддерживает из коробки — добавим позже)
