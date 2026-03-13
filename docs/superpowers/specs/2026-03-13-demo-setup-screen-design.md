# Demo Setup Screen — Fullscreen Stepper Transition

## Problem

При нажатии "Попробовать демо" пользователь видит только спиннер на кнопке и текст "Создание демо...". Бэкенд за 1-2 секунды создаёт профиль, 6 счетов, 60-90 транзакций, долги и напоминания, но пользователь не получает обратной связи о том, что происходит. Это создаёт ощущение неотзывчивости.

## Solution

Полноэкранный overlay с animated stepper, показывающий 4 шага подготовки демо-данных. Шаги фейковые (по таймеру на фронте), API-запрос выполняется параллельно. Бэкенд не меняется.

## New Component

### `DemoSetupScreen.vue`

**Расположение:** `frontend/src/features/demo-mode/ui/DemoSetupScreen.vue`

**Props:**
```ts
interface Props {
  visible: boolean  // одностороннее управление из родителя (не v-model)
}
```

**Emits:**
```ts
interface Emits {
  (e: 'complete'): void  // все шаги пройдены + API ответил — можно навигировать
  (e: 'error', message: string): void  // API вернул ошибку — родитель скрывает overlay
}
```

**Используемые компоненты из shared/ui:**
- `UProgressBar` — прогресс-бар внизу (size="sm", color="primary")
- `UIcon` — иконка галочки для завершённых шагов

### UI Structure

Полноэкранный overlay с `fixed inset-0 z-50`, фон `bg-background-light dark:bg-background-dark`. По центру:

1. **Горизонтальный stepper** — 4 кружка (28px) с линиями между ними:
   - Завершённый: `bg-success` + иконка `check` белая
   - Активный: `border-2 border-primary` + внутренний кружок `bg-primary` (7px)
   - Ожидающий: `border-2 border-border-light dark:border-border-dark`
   - Линии: `bg-success` для завершённых отрезков, `bg-border-light dark:bg-border-dark` для остальных

2. **Текст текущего шага** — заголовок (font-semibold, text-body-lg) + подпись (text-body-sm, text-secondary)

3. **UProgressBar** — общий прогресс (size="sm"), плавно заполняется

4. **Анимация смены шагов** — fade+translateY при переключении текста (transition 200ms)

### 4 Steps

| # | Title | Subtitle |
|---|-------|----------|
| 1 | Создаём профиль | Ваш аккаунт готов |
| 2 | Добавляем счета | Кошелёк, карты, накопления |
| 3 | Генерируем историю | Транзакции за последний месяц |
| 4 | Финальные штрихи | Долги, напоминания, контакты |

### Timing Logic

**Нумерация шагов:** 1-based (1, 2, 3, 4). `currentStep` начинается с `1` при показе overlay.

```
t=0ms     — Показать overlay, currentStep=1 (активный), запустить API-запрос
t=600ms   — currentStep=2
t=1200ms  — currentStep=3
t=1800ms  — currentStep=4
```

**Два параллельных процесса:**
1. **Таймер шагов** — используем `useTimeoutFn` из `@vueuse/core` (цепочка из 3 таймаутов). Все таймеры очищаются в `onUnmounted` или при `visible=false`
2. **API-запрос** — `signInAnonymously()` выполняется параллельно

**Условие завершения** (`tryComplete`):
```ts
function tryComplete() {
  if (currentStep.value >= STEPS.length && apiDone.value) {
    // Последний шаг получает галочку, пауза 400ms, emit('complete')
  }
}
```
`tryComplete()` вызывается из двух мест: (1) после перехода на последний шаг в таймере, (2) после успешного ответа API. Кто последний — тот и триггерит завершение.

**Если API ответил быстрее таймера** (например за 800ms, а мы на шаге 2):
- Не ускоряем. Пользователь должен увидеть все шаги. Таймер продолжает работать. Когда таймер дойдёт до шага 4, `tryComplete()` обнаружит что `apiDone=true` и завершит.

**Если API ответил медленнее** (например за 3 секунды):
- Шаг 4 остаётся "активным" (крутится) до получения ответа
- После ответа — `apiDone=true`, `tryComplete()` срабатывает → галочка + пауза 400ms + complete

**При ошибке API:**
- `emit('error', message)` — ошибка emit'ится только после того как промис `signInAnonymously()` полностью reject'нулся (т.е. `isLoading` из `useAuth` уже вернулся в `false`)
- Родитель (LoginPage) устанавливает `showDemoSetup=false` и показывает ошибку

**Cleanup:** Все таймеры (`useTimeoutFn`) останавливаются при `onUnmounted` или когда `visible` становится `false`. Это предотвращает emit после уничтожения компонента.

### Progress Calculation

`UProgressBar` value рассчитывается: `(currentStep / totalSteps) * 100`
- Шаг 1: 25%
- Шаг 2: 50%
- Шаг 3: 75%
- Шаг 4 active: 88%
- Всё завершено: 100%

## Changes to LoginPage.vue

### handleDemoMode

Текущая логика:
```ts
isDemoLoading.value = true
const { user } = await signInAnonymously()
// set localStorage, navigate
```

Новая логика:
```ts
showDemoSetup.value = true
// API-запрос запускается внутри DemoSetupScreen через callback
```

**LoginPage передаёт** в `DemoSetupScreen`:
- `visible` — `showDemoSetup` ref
- `onComplete` callback — устанавливает localStorage и навигирует на дашборд
- `onError` callback — скрывает overlay, показывает ошибку

### Template Change

Добавить `<DemoSetupScreen>` в template:

```vue
<DemoSetupScreen
  :visible="showDemoSetup"
  @complete="onDemoComplete"
  @error="onDemoError"
/>
```

Функции:
```ts
const showDemoSetup = ref(false)

function handleDemoMode() {
  if (showDemoSetup.value) return
  localError.value = null
  showDemoSetup.value = true
}

function onDemoComplete() {
  localStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETE, 'true')
  localStorage.setItem(STORAGE_KEYS.SELECTED_CURRENCY, DEFAULT_CURRENCY)
  router.push({ name: ROUTE_NAMES.DASHBOARD })
}

function onDemoError(error: string) {
  showDemoSetup.value = false
  localError.value = error
}
```

## DemoSetupScreen Internal Logic

Компонент сам вызывает `signInAnonymously()` внутри `watch(visible)`. Использует `useTimeoutFn` из `@vueuse/core` для таймеров шагов.

```ts
import { useTimeoutFn } from '@vueuse/core'
const { signInAnonymously } = useAuth()

const STEPS = [
  { title: 'Создаём профиль', subtitle: 'Ваш аккаунт готов' },
  { title: 'Добавляем счета', subtitle: 'Кошелёк, карты, накопления' },
  { title: 'Генерируем историю', subtitle: 'Транзакции за последний месяц' },
  { title: 'Финальные штрихи', subtitle: 'Долги, напоминания, контакты' },
]

const currentStep = ref(1)  // 1-based
const apiDone = ref(false)

// Таймеры для шагов 2, 3, 4 (шаг 1 показывается сразу)
const stepTimers = [
  useTimeoutFn(() => { currentStep.value = 2 }, 600, { immediate: false }),
  useTimeoutFn(() => { currentStep.value = 3 }, 1200, { immediate: false }),
  useTimeoutFn(() => { currentStep.value = 4; tryComplete() }, 1800, { immediate: false }),
]

function stopAllTimers() {
  stepTimers.forEach(t => t.stop())
}

watch(() => props.visible, async (show) => {
  if (!show) {
    stopAllTimers()
    return
  }

  currentStep.value = 1
  apiDone.value = false

  // Start fake stepper timers
  stepTimers.forEach(t => t.start())

  // Start real API call in parallel
  try {
    await signInAnonymously()
    apiDone.value = true
    tryComplete()
  } catch (err) {
    // signInAnonymously() already settled — isLoading is false
    stopAllTimers()
    const message = err instanceof Error ? err.message : 'Не удалось запустить демо режим'
    emit('error', message)
  }
})

onUnmounted(() => stopAllTimers())
```

## Export

Добавить в `frontend/src/features/demo-mode/index.ts`:
```ts
export { default as DemoSetupScreen } from './ui/DemoSetupScreen.vue'
```

## Files to Create/Modify

| File | Action |
|------|--------|
| `frontend/src/features/demo-mode/ui/DemoSetupScreen.vue` | Create |
| `frontend/src/features/demo-mode/index.ts` | Add export |
| `frontend/src/pages/auth/LoginPage.vue` | Modify handleDemoMode, add DemoSetupScreen |

## No Backend Changes

Бэкенд остаётся без изменений. Один запрос `POST /auth/login/anonymous` выполняется как раньше.
