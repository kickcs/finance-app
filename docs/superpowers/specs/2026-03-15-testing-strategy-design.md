# Testing Strategy Design

## Overview

Стратегия внедрения тестов в проект finance-app. Тесты пишутся **по ходу рефакторинга** — при работе над модулем/фичей покрываем все пользовательские сценарии.

## Tech Stack

### Backend (уже настроен)
- **Jest** — тест-раннер (v29.7.0)
- **@nestjs/testing** — TestingModule для DI
- **ts-jest** — TypeScript трансформер
- **supertest** — HTTP-тесты

Конфигурация в `backend/package.json`. Ничего менять не нужно.

### Frontend (настраиваем с нуля)
- **Vitest** — тест-раннер, нативная интеграция с Vite
- **@vue/test-utils** — mount/shallowMount Vue-компонентов, `trigger()`, `setValue()` для взаимодействий
- **jsdom** — эмуляция DOM (быстро, покрывает 95% кейсов)
- **MSW v2** — мок API-запросов на уровне сети (`http.get()` / `HttpResponse.json()` API)

MSW перехватывает fetch, не трогая код приложения. Позволяет тестировать полный flow: компонент → composable → HTTP → мок-ответ → рендер результата.

Используем `@vue/test-utils` (не `@testing-library/vue`) — он даёт полный контроль через `wrapper.find()`, `trigger()`, `setValue()`, `emitted()`, что лучше подходит для тестирования Vue-специфичной логики. Селекторы — через `data-testid`.

## Что тестируем

### Backend — при рефакторинге модуля

| Слой | Что тестируем | Как | Пример |
|------|--------------|-----|--------|
| **Domain** (агрегаты, value objects) | Бизнес-логика, валидация, domain events | Чистые unit-тесты, без моков | `Transaction.create()` выбрасывает event, `Money.add()` считает правильно |
| **Application** (command/query handlers) | Оркестрация, вызовы репозиториев | Unit-тесты, моки репозиториев | `CreateTransactionHandler` вызывает `repo.save()` с правильными данными |
| **Infrastructure** (mappers) | Маппинг domain ↔ ORM | Unit-тесты | `TransactionMapper.toDomain()` корректно преобразует поля |
| **Presentation** (controllers) | Не тестируем отдельно | Покрыто через e2e (позже) | — |

### Frontend — при рефакторинге фичи/страницы

Покрываем **все пользовательские сценарии** — всё что пользователь может сделать на странице.

| Уровень | Что тестируем | Как |
|---------|--------------|-----|
| **Page/Widget flow** (приоритет) | Полный user flow: действия, валидация, loading/empty/error, навигация | mount + MSW + user interaction |
| **Feature-компоненты** | Формы, модалки, фильтры — все сценарии использования | mount + проверка emit/рендер |
| **Shared утилиты** | Чистые функции | Unit-тесты |

**Сценарии для каждой страницы/фичи:**
- Happy path (заполнил → отправил → успех)
- Валидация форм (пустые поля, невалидные данные → ошибка)
- Ошибки сервера (API 500 → сообщение об ошибке)
- Loading-состояния (спиннер при загрузке)
- Empty-состояния (пустой список → EmptyState)
- Все CRUD-действия (создать, редактировать, удалить)
- Условный рендер (показать/скрыть элементы)

**Что НЕ тестируем:**
- Reka UI примитивы (протестированы библиотекой)
- Чисто визуальные компоненты без логики (`UBadge`, `USpinner`)
- Внутреннюю реализацию composables (тестируем через поведение на странице)
- Роутер-конфиг, Tailwind-классы

## Test Environment Setup

### Vitest Config

Vitest наследует конфиг Vite (алиасы `@/*`, плагины) через `mergeConfig`:

```typescript
// frontend/vitest.config.ts
import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(viteConfig, defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    passWithNoTests: true,
  },
}))
```

### Мокирование Vue Router, TanStack Query, provide/inject

Каждый page/widget-тест нуждается в Vue Router, QueryClient и auth-контексте. Создаём хелпер `renderWithProviders()`:

```typescript
// frontend/src/test/test-utils.ts
import { mount, type ComponentMountingOptions } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query'
import type { Component } from 'vue'

export function createTestRouter(routes = [{ path: '/', component: { template: '<div />' } }]) {
  return createRouter({
    history: createMemoryHistory(),
    routes,
  })
}

export function renderWithProviders(
  component: Component,
  options: ComponentMountingOptions<any> & {
    router?: ReturnType<typeof createTestRouter>
    queryClient?: QueryClient
    provideAuth?: { userId: string; user: any }
  } = {},
) {
  const { router, queryClient, provideAuth, ...mountOptions } = options

  const testRouter = router ?? createTestRouter()
  const testQueryClient = queryClient ?? new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })

  return mount(component, {
    ...mountOptions,
    global: {
      ...mountOptions.global,
      plugins: [
        ...(mountOptions.global?.plugins ?? []),
        testRouter,
        [VueQueryPlugin, { queryClient: testQueryClient }],
      ],
      provide: {
        ...mountOptions.global?.provide,
        // Auth context that App.vue normally provides
        ...(provideAuth ? {
          currentUser: { value: provideAuth.user },
          userId: { value: provideAuth.userId },
        } : {}),
      },
    },
  })
}
```

### HTTP Client в тестах

`http.ts` использует `import.meta.env.VITE_API_URL` для base URL. В тестах:
- Vitest автоматически подставляет пустую строку для `VITE_API_URL` (не задан в `.env.test`)
- MSW перехватывает все запросы к `/api/*` через relative URL matching
- `localStorage` работает из коробки в jsdom

```typescript
// frontend/src/test/setup.ts
import { server } from './mocks/server'
import { afterAll, afterEach, beforeAll } from 'vitest'

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

```typescript
// frontend/src/test/mocks/server.ts
import { setupServer } from 'msw/node'
import { handlers } from './handlers'

export const server = setupServer(...handlers)
```

```typescript
// frontend/src/test/mocks/handlers.ts
import { http, HttpResponse } from 'msw'

export const handlers = [
  // Дефолтные хендлеры — добавляются по мере покрытия модулей
]
```

```typescript
// frontend/src/test/mocks/handlers/accounts.ts — пример
import { http, HttpResponse } from 'msw'

export const accountHandlers = [
  http.get('/api/accounts', () => {
    return HttpResponse.json([
      { id: '1', name: 'Основной', type: 'basic', currency: 'UZS' },
    ])
  }),

  http.post('/api/accounts', async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json({ id: '2', ...body }, { status: 201 })
  }),
]
```

### Async Patterns

Vue-компоненты с TanStack Query и MSW требуют ожидания async-операций:

```typescript
import { flushPromises } from '@vue/test-utils'

it('loads and displays accounts', async () => {
  const wrapper = renderWithProviders(AccountsPage, { provideAuth: { userId: '1', user: mockUser } })

  // Ждём пока MSW ответит и Vue отрендерит
  await flushPromises()

  expect(wrapper.find('[data-testid="account-card"]').exists()).toBe(true)
})
```

## File Structure

### Backend (существующий паттерн)
Тесты рядом с кодом:
```
modules/accounting/
  domain/
    aggregates/
      transaction.aggregate.ts
      transaction.aggregate.spec.ts
  application/
    commands/
      create-transaction/
        create-transaction.handler.ts
        create-transaction.handler.spec.ts
  infrastructure/
    persistence/
      mappers/
        transaction.mapper.ts
        transaction.mapper.spec.ts
```

### Frontend (новая конвенция)
Тесты рядом с файлом:
```
pages/
  transactions/
    TransactionsPage.vue
    TransactionsPage.spec.ts

features/
  add-transaction/
    ui/
      TransactionForm.vue
      TransactionForm.spec.ts

shared/
  lib/
    format/
      currency.ts
      currency.spec.ts
```

### Тестовая инфраструктура:
```
frontend/src/test/
  setup.ts                    # глобальный setup (MSW lifecycle)
  test-utils.ts               # renderWithProviders(), createTestRouter()
  mocks/
    handlers.ts               # re-export всех хендлеров
    handlers/
      accounts.ts             # моки по entity
      transactions.ts
      categories.ts
    server.ts                 # MSW setupServer()
```

## Conventions

### Именование тестов

```typescript
// Backend — describe по классу, it по поведению
describe('CreateTransactionHandler', () => {
  it('should create transaction and update account balance', ...)
  it('should throw when account not found', ...)
})

// Frontend — describe по компоненту, it по user action
describe('TransactionsPage', () => {
  it('displays list of transactions', ...)
  it('creates expense transaction when form is filled and saved', ...)
  it('shows validation error when amount is empty', ...)
  it('shows error message when API returns 500', ...)
  it('shows empty state when no transactions exist', ...)
})
```

### data-testid

- Добавляем `data-testid` при рефакторинге компонента — только для элементов, с которыми взаимодействует тест
- Формат: `kebab-case`, описывает роль: `amount-input`, `save-btn`, `category-food`, `toast-success`
- Не используем CSS-классы или DOM-структуру для селекторов
- Осознанный выбор: `data-testid` вместо accessible-селекторов (role/label), т.к. используем `@vue/test-utils`, а не `@testing-library`

### Полный пример frontend flow-теста

```typescript
// features/add-transaction/ui/TransactionForm.spec.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { renderWithProviders } from '@/test/test-utils'
import { server } from '@/test/mocks/server'
import { http, HttpResponse } from 'msw'
import TransactionForm from './TransactionForm.vue'

const mockUser = { id: '1', email: 'test@test.com' }

describe('TransactionForm', () => {
  it('submits expense transaction successfully', async () => {
    // Arrange: MSW мокает POST
    server.use(
      http.post('/api/transactions', () => {
        return HttpResponse.json({ id: 'tx-1' }, { status: 201 })
      }),
    )

    const wrapper = renderWithProviders(TransactionForm, {
      provideAuth: { userId: '1', user: mockUser },
    })

    // Act: заполняем форму
    await wrapper.find('[data-testid="amount-input"]').setValue('50000')
    await wrapper.find('[data-testid="category-food"]').trigger('click')
    await wrapper.find('[data-testid="save-btn"]').trigger('click')
    await flushPromises()

    // Assert: форма отправлена
    expect(wrapper.emitted('saved')).toBeTruthy()
  })

  it('shows error when API fails', async () => {
    server.use(
      http.post('/api/transactions', () => {
        return HttpResponse.json({ message: 'Server error' }, { status: 500 })
      }),
    )

    const wrapper = renderWithProviders(TransactionForm, {
      provideAuth: { userId: '1', user: mockUser },
    })

    await wrapper.find('[data-testid="amount-input"]').setValue('50000')
    await wrapper.find('[data-testid="save-btn"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="error-message"]').exists()).toBe(true)
  })

  it('validates required amount field', async () => {
    const wrapper = renderWithProviders(TransactionForm, {
      provideAuth: { userId: '1', user: mockUser },
    })

    // Нажимаем сохранить без ввода суммы
    await wrapper.find('[data-testid="save-btn"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="amount-error"]').exists()).toBe(true)
  })
})
```

## Workflow

### При рефакторинге backend-модуля:
1. Читаешь domain-слой модуля
2. Пишешь тесты на текущее поведение (domain → handlers → mappers)
3. Рефакторишь код
4. Тесты должны проходить — если сломались, значит изменилось поведение
5. Обновляешь тесты если поведение намеренно изменилось

### При рефакторинге frontend-фичи/страницы:
1. Читаешь страницу/фичу
2. Добавляешь MSW-хендлеры для API, которые использует страница
3. Пишешь flow-тесты на все пользовательские сценарии
4. Рефакторишь код
5. Тесты должны проходить

## CI/CD

Backend — уже прогоняет `bun run test` в `deploy.yml` (шаг "Backend tests" в job `build-backend`).

Frontend — добавить шаг в job `build-frontend` после `bun install`, перед `bun run build`:
```yaml
- name: Frontend tests
  working-directory: frontend
  run: bun run test
```

Шаг добавляется только когда `needs.changes.outputs.frontend == 'true'` (уже обеспечено условием на job).

## Coverage

На старте — без порогов покрытия. Пересмотреть после покрытия 3+ модулей и решить нужны ли минимальные thresholds.

## Setup Checklist (одноразовая настройка)

### Frontend:
1. Установить зависимости: `vitest`, `@vue/test-utils`, `jsdom`, `msw@^2`
2. Создать `vitest.config.ts` с `mergeConfig` от `vite.config.ts` (алиасы `@/*`)
3. Добавить скрипты в `frontend/package.json`: `"test": "vitest run"`, `"test:watch": "vitest"`
4. Создать `src/test/setup.ts` — MSW lifecycle (beforeAll/afterEach/afterAll)
5. Создать `src/test/mocks/server.ts` — `setupServer()`
6. Создать `src/test/mocks/handlers.ts` — пустой массив, расширяется по мере покрытия
7. Создать `src/test/test-utils.ts` — `renderWithProviders()` с Router + QueryClient + auth
8. Добавить тест-шаг в CI/CD pipeline (`deploy.yml`, job `build-frontend`)

### Backend:
Инфраструктура готова. Ничего настраивать не нужно.
