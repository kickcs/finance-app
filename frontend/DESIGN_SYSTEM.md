# Design System

Документация дизайн-системы приложения Ouro. Все токены определены в `src/app/styles/index.css` (блок `@theme`), компоненты — в `src/shared/ui/`.

---

## 1. Color Palette

### Primary

| Token | Value | Usage |
|-------|-------|-------|
| `primary` | `#4F46E5` | Основной accent, кнопки, ссылки |
| `primary-hover` | `#6366F1` | Hover-состояние primary |
| `primary-pressed` | `#3730A3` | Active/pressed-состояние |
| `primary-light` | `rgba(79,70,229,0.12)` | Фон для primary-элементов |

### Backgrounds (light / dark)

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `background-*` | `#FAFAFA` | `#09090B` | Фон страницы |
| `card-*` | `#FFFFFF` | `#18181B` | Карточки, модалки |
| `surface-*` | `#F4F4F5` | `#27272A` | Вторичные поверхности, hover |

### Text (light / dark)

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `text-primary-*` | `#09090B` | `#FAFAFA` | Заголовки, основной текст |
| `text-secondary-*` | `#71717A` | `#A1A1AA` | Вспомогательный текст |
| `text-tertiary-*` | `#A1A1AA` | `#71717A` | Подписи, мета-информация |

### Semantic

| Token | Value | Light variant | Usage |
|-------|-------|---------------|-------|
| `success` | `#059669` | `success-light` | Доходы, позитивные состояния |
| `danger` | `#E11D48` | `danger-light` | Ошибки, расходы, удаление |
| `warning` | `#D97706` | `warning-light` | Предупреждения, скоро наступит |
| `info` | `#4F46E5` | `info-light` | Информационные подсказки |
| `neutral` | `#6B7280` | `neutral-light` | Неактивные состояния |

### Domain (доменные сущности)

| Token | Value | Light variant | Usage |
|-------|-------|---------------|-------|
| `debt-given` | `#F59E0B` | `debt-given-light` | Долги "мне должны" |
| `debt-received` | `#A855F7` | `debt-received-light` | Долги "я должен" |
| `goal` | `#F59E0B` | `goal-light` | Цели (иконки, фон) |
| `goal-text` / `goal-text-dark` | `#D97706` / `#FBBF24` | — | Текст целей (light/dark) |
| `reminder` | `#A855F7` | `reminder-light` | Подписки/напоминания |

### Category Colors

Токены вида `cat-{name}`: `groceries`, `transport`, `health`, `housing`, `cafe`, `entertainment`, `gifts`, `education`, `family`, `sport`, `travel`, `other`.

### Border

| Token | Light | Dark |
|-------|-------|------|
| `border-*` | `#E4E4E7` | `#27272A` |

---

## 2. Typography

**Font family**: `Inter` (variable weight), fallback: `ui-sans-serif, system-ui, sans-serif`.

### Size Scale

| Token | Size | px | Usage |
|-------|------|----|-------|
| `display-lg` | `3.5rem` | 56 | Hero-заголовки |
| `display` | `2.5rem` | 40 | Крупные заголовки |
| `h1` | `1.875rem` | 30 | Заголовок страницы |
| `h2` | `1.5rem` | 24 | Секционные заголовки |
| `h3` | `1.25rem` | 20 | Подзаголовки |
| `body-lg` | `1.125rem` | 18 | Акцентный текст |
| `body` | `0.9375rem` | 15 | Основной текст |
| `body-sm` | `0.8125rem` | 13 | Вторичный текст |
| `caption` | `0.6875rem` | 11 | Подписи |
| `caption-sm` | `0.625rem` | 10 | Мелкие подписи (бейджи, мета) |
| `caption-xs` | `0.5625rem` | 9 | Минимальные подписи (notification badges) |

**Tailwind-классы**: `text-display-lg`, `text-display`, `text-h1`, `text-body`, `text-caption-sm` и т.д.

### Font Weights

- `font-normal` (400) — body text
- `font-medium` (500) — labels, secondary emphasis
- `font-semibold` (600) — headings, card titles, amounts
- `font-bold` (700) — hero numbers, strong emphasis

### Line Heights

- Headings: `1.3` (через глобальные стили `h1-h6`)
- Body: `1.6` (через `body`)

---

## 3. Spacing

Шкала `spacing-{n}`, доступна через Tailwind `p-{n}`, `m-{n}`, `gap-{n}`:

| Token | Value | Usage |
|-------|-------|-------|
| `1` | `0.25rem` (4px) | Микро-отступы |
| `2` | `0.5rem` (8px) | Между inline-элементами |
| `3` | `0.75rem` (12px) | Padding компактных карточек |
| `4` | `1rem` (16px) | Стандартный padding |
| `5` | `1.25rem` (20px) | Увеличенный padding |
| `6` | `1.5rem` (24px) | Секционные отступы |
| `8` | `2rem` (32px) | Между секциями |
| `10` | `2.5rem` (40px) | Крупные отступы |
| `12` | `3rem` (48px) | Extra spacing |
| `16` | `4rem` (64px) | Максимальные отступы |

---

## 4. Border Radius

| Token | Value | Рекомендация |
|-------|-------|-------------|
| `radius-sm` | `0.375rem` (6px) | Inputs, small chips |
| `radius-md` | `0.5rem` (8px) | Buttons, badges |
| `radius-lg` | `0.75rem` (12px) | Dropdown items, list items |
| `radius-xl` | `1rem` (16px) | Cards, modals |
| `radius-2xl` | `1.25rem` (20px) | Large cards |
| `radius-3xl` | `1.5rem` (24px) | Bottom sheets |
| `radius-full` | `9999px` | Pills, avatars, circles |

---

## 5. Shadows

| Token | Value | Usage |
|-------|-------|-------|
| `shadow-xs` | `0 1px 2px rgba(0,0,0,0.04)` | Subtle lift |
| `shadow-sm` | `0 1px 3px rgba(0,0,0,0.06)` | Cards, buttons |
| `shadow-md` | `0 4px 6px -1px rgba(0,0,0,0.07)` | Dropdowns, popovers |
| `shadow-lg` | `0 10px 15px -3px rgba(0,0,0,0.08)` | Modals, overlays |
| `shadow-soft` | `0 2px 8px -2px rgba(0,0,0,0.05)` | Hover states |

---

## 6. Component Catalog

### UButton

Варианты: `primary`, `secondary`, `ghost`, `icon`, `danger`, `outline`.
Размеры: `xs` (h-7), `sm` (h-8), `md` (h-10), `lg` (h-11), `xl` (h-12).
Props: `variant`, `size`, `fullWidth`, `loading`, `disabled`.

```vue
<UButton variant="primary" size="md">Сохранить</UButton>
<UButton variant="ghost" size="sm" :loading="true">Загрузка</UButton>
```

### UBadge

Варианты: `primary`, `success`, `danger`, `warning`, `neutral`, `debt-given`, `debt-received`, `goal`, `reminder`.
Размеры: `xs`, `sm`, `md`.
Форма: `rounded` (rounded-md), `pill` (rounded-full).

```vue
<UBadge variant="success" size="sm">Активна</UBadge>
<UBadge variant="debt-given" shape="pill">Мне должны</UBadge>
<UBadge variant="neutral" size="xs">Неактивна</UBadge>
```

### UInput

Варианты: `default`, `search`, `currency`.
Размеры: `md`, `lg`.
Props: `icon`, `suffix`, `showPasswordToggle`, `label`, `error`.

```vue
<UInput v-model="name" label="Имя" placeholder="Введите имя" />
<UInput v-model="amount" variant="currency" :suffix="'UZS'" />
```

### UCard

Варианты: `default`, `bordered`, `flat`.
Padding: `none`, `sm`, `md`, `lg`.
Props: `hoverable`, `clickable`.

```vue
<UCard padding="lg">Контент карточки</UCard>
```

### UModal

Full-screen bottom sheet (mobile) или centered dialog (desktop).
Props: `v-model`, `title`.
Slots: `default`, `#actions`.

```vue
<UModal v-model="isOpen" title="Заголовок">
  <p>Контент модалки</p>
  <template #actions>
    <UButton variant="primary" full-width>OK</UButton>
  </template>
</UModal>
```

### UTabs

Horizontal tab bar с pill-стилем.
Props: `items` (array of `{ id, label }`), `v-model`, `size`.

### UIcon

Обёртка над Lucide icons с Material Symbol naming.
Размеры: `xs`, `sm`, `md`, `lg`, `xl`, `2xl`.
Маппинг имён в `shared/ui/icon/iconMap.ts`.

```vue
<UIcon name="arrow_back" size="sm" />
```

### UProgressBar

Линейный прогресс-бар.
Props: `value` (0-100), `color`.

### EmptyState

Пустое состояние с иконкой, заголовком и CTA.

### SwipeableItem

Swipe-to-action для списков (edit/delete).

### PullToRefresh

Pull-to-refresh обёртка для scrollable контента.

### Skeleton

Анимированный placeholder для загрузки (shimmer effect).

### Toast

Notification система через `useToast()`.

---

## 7. Layout Patterns

### Standard Page

```vue
<div class="min-h-screen bg-background-light dark:bg-background-dark pb-28">
  <AppHeader title="Заголовок" />
  <main class="px-5 pt-8 space-y-6">
    <!-- content -->
  </main>
  <BottomNav />
</div>
```

`pb-28` резервирует пространство для фиксированного BottomNav.

### Fixed-Scroll Page (HistoryPage, CategoriesPage)

```vue
<div class="h-dvh flex flex-col overflow-hidden bg-background-light dark:bg-background-dark">
  <AppHeader title="Заголовок" />
  <div class="flex-1 overflow-y-auto">
    <main class="px-5 pt-8 pb-28 space-y-4">
      <!-- scrollable content -->
    </main>
  </div>
  <BottomNav />
</div>
```

### Safe Areas

```css
padding-top: calc(0.75rem + var(--safe-area-inset-top));
padding-bottom: env(safe-area-inset-bottom);
```

Утилиты: `.safe-area-inset-top`, `.safe-area-inset-bottom`.

---

## 8. Animations

### Keyframes

| Animation | Class | Duration | Usage |
|-----------|-------|----------|-------|
| `fadeInUp` | `.animate-fadeInUp` | 200ms | Появление карточек |
| `scaleIn` | `.animate-scaleIn` | 150ms | Появление элементов |
| `shimmer` | `.animate-shimmer` | 1s loop | Skeleton loaders |
| `shake` | `.animate-shake` | 400ms | Ошибки валидации |
| `slideInFromBottom` | `.animate-slideInFromBottom` | 200ms | Bottom sheets |

### Stagger

Классы `.stagger-1` ... `.stagger-5` добавляют задержку `0.05s` ... `0.25s`.

```vue
<div v-for="(item, i) in items" class="animate-fadeInUp" :class="`stagger-${i + 1}`">
```

### Transitions

| Token | Duration | Usage |
|-------|----------|-------|
| `transition-fast` | 150ms | Hover, focus |
| `transition-normal` | 200ms | Стандартные переходы |
| `transition-slow` | 250ms | Плавные анимации |

---

## 9. Dark Mode

**Стратегия**: Class-based (`.dark` на `<html>`).
**Конфигурация**: `@custom-variant dark (&:where(.dark, .dark *));`

### Паттерн парных токенов

Все визуальные токены имеют пару `-light` / `-dark`:

```vue
<div class="bg-card-light dark:bg-card-dark text-text-primary-light dark:text-text-primary-dark">
```

Исключения — semantic токены (success, danger, warning, domain), которые одинаковы в обоих темах.

---

## 10. Forms

### Input Pattern

```vue
<UInput v-model="value" label="Метка" placeholder="Подсказка" :error="errorMsg" />
```

### Currency Input

```vue
<UInput v-model="amount" variant="currency" :suffix="'UZS'" />
```

### Validation

- Ошибки отображаются под полем красным текстом
- Shake-анимация при ошибке (`.animate-shake`)
- Реал-тайм валидация при `@blur` + `watch`

---

## 11. Accessibility

### Focus Ring

Глобальный стиль:
```css
.focus-ring {
  @apply focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2;
}
```

Все интерактивные элементы (UButton, UInput) включают focus-visible стили.

### ARIA

- Кнопки-карточки: `aria-label` с описанием контента
- Табы: `role="tablist"` / `role="tab"` / `aria-selected`
- Модалки: фокус-трап, `Escape` для закрытия
- Toggle switch: `role="switch"` + `aria-checked`

### Keyboard Navigation

- `Tab` — навигация между элементами
- `Enter/Space` — активация кнопок
- `Escape` — закрытие модалок/попаперов

---

## 12. Anti-Patterns

**НЕ делать:**

| Плохо | Хорошо | Причина |
|-------|--------|---------|
| `bg-gray-100 dark:bg-gray-800` | `bg-surface-light dark:bg-surface-dark` | Хардкод цветов |
| `text-[10px]` | `text-caption-sm` | Произвольный размер вне шкалы |
| `text-[9px]` | `text-caption-xs` | Произвольный размер вне шкалы |
| `bg-amber-500/10 text-amber-500` | `bg-debt-given-light text-debt-given` | Хардкод доменных цветов |
| `bg-purple-500/10 text-purple-500` | `bg-reminder-light text-reminder` | Хардкод доменных цветов |
| `bg-gray-500/10 text-gray-500` | `bg-neutral-light text-neutral` | Хардкод нейтрального цвета |
| Inline badge styles | `<UBadge variant="...">` | Дублирование стилей |
| `border-gray-200 dark:border-gray-700` | `border-border-light dark:border-border-dark` | Хардкод бордера |

**Исключение**: `TooltipContent.vue` использует инвертированные цвета (`bg-gray-900 dark:bg-gray-100`) — это корректный UX-паттерн для тултипов.
