# UI/UX Design Specification: Scan Receipt & Split by Items

**Feature**: Premium — Scan Receipt & Split by Items
**Route**: `/scan-receipt`
**Date**: 2026-02-24
**Language**: Russian UI
**Platform**: Mobile-first PWA (Vue 3 + Tailwind CSS v4)

---

## Table of Contents

1. [Feature Entry Points](#1-feature-entry-points)
2. [Page Shell & Step Progress Indicator](#2-page-shell--step-progress-indicator)
3. [Step Transitions](#3-step-transitions)
4. [Step 1: Photo Capture](#4-step-1-photo-capture)
5. [Step 2: Edit Items](#5-step-2-edit-items)
6. [Step 3: Assign Participants](#6-step-3-assign-participants)
7. [Step 4: Summary & Create](#7-step-4-summary--create)
8. [Empty States](#8-empty-states)
9. [Error States](#9-error-states)
10. [Accessibility Summary](#10-accessibility-summary)

---

## 1. Feature Entry Points

### 1.1 Dashboard Quick Action Button

On the Dashboard page, the existing row of quick-action buttons (typically FAB-style or horizontal chip row near the top) gains a new entry: **"Сканировать чек"**.

**Structure:**
```
<button
  type="button"
  aria-label="Сканировать чек — Премиум функция"
  class="relative flex flex-col items-center gap-1.5 p-3 rounded-2xl
         bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark
         shadow-xs active:scale-95 transition-all duration-150 min-w-[72px]"
>
  <!-- Icon container -->
  <div class="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center">
    <UIcon name="document_scanner" size="md" class="text-primary" />
  </div>
  <!-- Label -->
  <span class="text-caption font-medium text-text-secondary-light dark:text-text-secondary-dark
               whitespace-nowrap">
    Сканировать
  </span>
  <!-- Premium badge — top-right corner -->
  <div class="absolute -top-1 -right-1">
    <PremiumBadge />
  </div>
</button>
```

**Behavior:** Tapping calls `requirePremium('Сканирование чеков')`. If the user is premium, navigates to `/scan-receipt`. Otherwise opens `PremiumUpgradeModal`.

**Haptic**: `haptics.tap()` on press.

---

### 1.2 Add Transaction Page Entry Point

On the `AddTransactionPage`, inside the `ExpensePanel`, below the `CategoryChips` and above `SplitExpenseSection`, add a secondary action link:

```
<button
  type="button"
  class="flex items-center gap-2 w-full px-4 py-2.5 rounded-xl
         border border-dashed border-border-light dark:border-border-dark
         text-text-secondary-light dark:text-text-secondary-dark
         hover:border-primary/40 hover:text-primary hover:bg-primary-light
         transition-all duration-150 active:scale-[0.98]"
  aria-label="Импортировать позиции из чека — Премиум функция"
>
  <UIcon name="document_scanner" size="sm" />
  <span class="text-body-sm font-medium">Импортировать из чека</span>
  <PremiumBadge class="ml-auto" />
</button>
```

**Behavior:** Navigates to `/scan-receipt` with a `?returnTo=add-transaction` query param so the final step can return the user and pre-fill items.

---

### 1.3 History Page Context Menu

In the `VirtualGroupedTransactionList`, the long-press context menu on a date group header gains an optional "Добавить по чеку" item (secondary, icon-only chip row). This is a lower priority entry point, mentioned for completeness.

---

## 2. Page Shell & Step Progress Indicator

### 2.1 Page-Level Layout

The `/scan-receipt` page uses the **fixed-scroll layout** to prevent body scroll and allow each step to manage its own overflow:

```
<!-- Root -->
<div class="h-dvh flex flex-col overflow-hidden
            bg-background-light dark:bg-background-dark">

  <!-- Header: back + title + step label -->
  <header class="flex-shrink-0 flex items-center gap-3 px-5
                 pt-[calc(0.75rem+var(--safe-area-inset-top))] pb-3
                 bg-background-light dark:bg-background-dark">

    <!-- Back / Close button -->
    <button
      type="button"
      aria-label="Назад"
      class="w-9 h-9 rounded-full flex items-center justify-center
             bg-surface-light dark:bg-surface-dark
             text-text-secondary-light dark:text-text-secondary-dark
             active:bg-border-light dark:active:bg-border-dark
             transition-colors duration-150"
    >
      <UIcon name="arrow_back" size="sm" />
    </button>

    <!-- Title block -->
    <div class="flex-1 min-w-0">
      <h1 class="text-body font-semibold text-text-primary-light dark:text-text-primary-dark
                 leading-tight truncate">
        Сканировать чек
      </h1>
      <!-- Dynamic step label, changes with animation -->
      <p class="text-caption text-text-tertiary-light dark:text-text-tertiary-dark">
        <!-- Transition: Crossfade 150ms -->
        <Transition name="step-label">
          Шаг {{ currentStep }} из 4 · {{ STEP_LABELS[currentStep - 1] }}
        </Transition>
      </p>
    </div>

    <!-- Premium badge -->
    <PremiumBadge />

  </header>

  <!-- Step Progress Indicator (see 2.2) -->
  <StepProgressIndicator :current-step="currentStep" :total-steps="4" />

  <!-- Step content area — fills remaining height -->
  <div class="flex-1 overflow-hidden relative">
    <!-- Step panels slide in here (see Section 3) -->
  </div>

</div>
```

**STEP_LABELS** (Russian): `['Фото чека', 'Позиции', 'Участники', 'Итог']`

---

### 2.2 Step Progress Indicator

A horizontal 4-segment bar sits below the page header, flush edge-to-edge. It is **not** inside the scrollable area.

**Anatomy:**
```
<!-- Container: full width, no horizontal padding, 3px height -->
<div
  class="flex-shrink-0 flex gap-1 px-5 pb-3"
  role="progressbar"
  :aria-valuenow="currentStep"
  aria-valuemin="1"
  aria-valuemax="4"
  :aria-label="`Шаг ${currentStep} из 4`"
>
  <!-- 4 segments -->
  <div
    v-for="i in 4"
    :key="i"
    class="flex-1 h-1 rounded-full overflow-hidden transition-colors duration-300"
    :class="i <= currentStep
      ? 'bg-primary'
      : 'bg-border-light dark:bg-border-dark'"
  >
    <!-- Active segment has animated fill for the CURRENT step only -->
    <div
      v-if="i === currentStep"
      class="h-full bg-primary origin-left"
      style="animation: stepFill 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards"
    />
  </div>
</div>
```

**CSS keyframe** (add to global styles or scoped):
```css
@keyframes stepFill {
  from { transform: scaleX(0); }
  to   { transform: scaleX(1); }
}
```

**Behavior:**
- Segments 1…(currentStep-1): fully filled `bg-primary`, no animation.
- Segment currentStep: fills from left with `stepFill` animation (400ms ease) each time the step advances.
- Segments (currentStep+1)…4: unfilled `bg-border-light dark:bg-border-dark`.
- Going **back** reverses the current segment from right to left (`scaleX(1) → scaleX(0)`, 250ms) before the previous segment becomes active.

---

## 3. Step Transitions

Steps slide horizontally like a native iOS page stack. Only the active step is rendered in the DOM at a time (using `v-if` + `<Transition>`).

### 3.1 CSS Transition Names

```css
/* Moving forward: new step slides in from the right */
.step-forward-enter-active,
.step-forward-leave-active {
  transition: transform 280ms cubic-bezier(0.4, 0, 0.2, 1),
              opacity 280ms cubic-bezier(0.4, 0, 0.2, 1);
  position: absolute;
  inset: 0;
  width: 100%;
}
.step-forward-enter-from {
  transform: translateX(100%);
  opacity: 0;
}
.step-forward-leave-to {
  transform: translateX(-30%);
  opacity: 0;
}

/* Moving backward: new step slides in from the left */
.step-back-enter-active,
.step-back-leave-active {
  transition: transform 280ms cubic-bezier(0.4, 0, 0.2, 1),
              opacity 280ms cubic-bezier(0.4, 0, 0.2, 1);
  position: absolute;
  inset: 0;
  width: 100%;
}
.step-back-enter-from {
  transform: translateX(-100%);
  opacity: 0;
}
.step-back-leave-to {
  transform: translateX(30%);
  opacity: 0;
}
```

The transition name (`step-forward` vs `step-back`) is set reactively based on whether `currentStep` increased or decreased.

### 3.2 Haptics on Step Change

- Advancing to next step: `haptics.tap()` (light)
- Going back: `haptics.tap()` (light)
- Completing all steps (create): `haptics.success()` (medium)
- Validation error preventing advancement: `haptics.error()` + `animate-shake` on the CTA button

---

## 4. Step 1: Photo Capture

**Goal:** The user provides a photo of the receipt. The app performs OCR and extracts line items. The user sees a preview and can retry if needed.

### 4.1 Layout — Idle State (No Photo Yet)

The step content area is `h-full flex flex-col`.

```
<!-- Step 1 content root -->
<div class="h-full flex flex-col px-5 pt-6 pb-6
            overflow-y-auto no-scrollbar">

  <!-- Instructional illustration zone -->
  <div class="flex-1 flex flex-col items-center justify-center gap-6 min-h-0">

    <!-- Receipt illustration placeholder -->
    <div
      class="w-full max-w-[280px] aspect-[3/4] rounded-2xl
             border-2 border-dashed border-border-light dark:border-border-dark
             bg-surface-light dark:bg-surface-dark
             flex flex-col items-center justify-center gap-4"
      aria-hidden="true"
    >
      <!-- Camera icon -->
      <div class="w-16 h-16 rounded-full bg-primary-light
                  flex items-center justify-center">
        <UIcon name="photo_camera" size="xl" class="text-primary" />
      </div>
      <!-- Corner accent lines (decorative receipt corners) -->
      <!-- Rendered as 4 absolutely-positioned 16×16 px elements
           with 2px borders on two sides each, color border-border-light -->

      <div class="text-center px-6">
        <p class="text-body-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">
          Сфотографируйте чек
        </p>
        <p class="text-caption text-text-tertiary-light dark:text-text-tertiary-dark mt-1">
          Держите чек ровно, текст должен быть чётким
        </p>
      </div>
    </div>

    <!-- Tips row -->
    <div class="flex gap-3 w-full">
      <TipChip icon="light_mode" label="Хорошее освещение" />
      <TipChip icon="crop_free" label="Весь чек в кадре" />
      <TipChip icon="text_fields" label="Чёткий текст" />
    </div>

  </div>

  <!-- Action buttons — always at bottom -->
  <div class="flex-shrink-0 space-y-3 mt-6">

    <!-- Primary: Open camera -->
    <UButton
      variant="primary"
      size="lg"
      full-width
      aria-label="Открыть камеру"
    >
      <UIcon name="photo_camera" size="sm" class="mr-2" />
      Сфотографировать
    </UButton>

    <!-- Secondary: Choose from gallery -->
    <UButton
      variant="outline"
      size="lg"
      full-width
      aria-label="Выбрать из галереи"
    >
      <UIcon name="photo_library" size="sm" class="mr-2" />
      Выбрать из галереи
    </UButton>

    <!-- Hidden native file inputs (triggered by buttons above) -->
    <!-- Camera input: capture="environment" accept="image/*" -->
    <!-- Gallery input: accept="image/*" (no capture attribute) -->

  </div>

</div>
```

**TipChip sub-component anatomy** (inline, no separate file):
```
<div class="flex-1 flex flex-col items-center gap-1 p-2 rounded-xl
            bg-surface-light dark:bg-surface-dark">
  <UIcon :name="icon" size="sm"
         class="text-text-secondary-light dark:text-text-secondary-dark" />
  <span class="text-caption text-center text-text-tertiary-light dark:text-text-tertiary-dark
               leading-tight">
    {{ label }}
  </span>
</div>
```

---

### 4.2 Layout — Photo Preview + OCR Loading State

Triggered immediately after the user selects an image. The illustration zone is replaced by the actual image. An overlay indicates OCR is running.

```
<!-- Image preview container — replaces illustration zone -->
<div class="flex-1 relative min-h-0">

  <!-- Preview image -->
  <img
    :src="previewUrl"
    alt="Фото чека"
    class="w-full h-full object-contain rounded-2xl"
    style="max-height: calc(100dvh - 280px)"
  />

  <!-- OCR loading overlay — full cover of the image -->
  <Transition name="fade">
    <div
      v-if="isOcrLoading"
      class="absolute inset-0 rounded-2xl
             bg-background-dark/70 backdrop-blur-sm
             flex flex-col items-center justify-center gap-3"
      aria-live="polite"
      aria-label="Распознаём текст чека..."
    >
      <USpinner size="lg" class="text-white" />
      <p class="text-body-sm font-medium text-white">Распознаём текст...</p>
      <!-- Animated dots appended to text -->
      <!-- Use CSS animation: opacity 0→1→0, 1.2s infinite, stagger 0.4s per dot -->
    </div>
  </Transition>

  <!-- Success flash — briefly shown (600ms) before advancing to Step 2 -->
  <Transition name="fade">
    <div
      v-if="isOcrSuccess"
      class="absolute inset-0 rounded-2xl
             bg-success/20 flex items-center justify-center"
      aria-live="assertive"
    >
      <div class="w-16 h-16 rounded-full bg-success
                  flex items-center justify-center animate-scaleIn">
        <UIcon name="check" size="xl" class="text-white" />
      </div>
    </div>
  </Transition>

  <!-- Retake button — top-right of preview, always visible after photo taken -->
  <button
    v-if="!isOcrLoading"
    type="button"
    aria-label="Переснять фото"
    class="absolute top-3 right-3
           w-9 h-9 rounded-full bg-background-dark/60 backdrop-blur-sm
           flex items-center justify-center
           text-white active:scale-90 transition-transform"
  >
    <UIcon name="refresh" size="sm" />
  </button>

</div>

<!-- Action row — replaced when OCR is loading -->
<div class="flex-shrink-0 space-y-3 mt-4">

  <!-- While loading: disabled continue button -->
  <UButton
    v-if="isOcrLoading"
    variant="primary"
    size="lg"
    full-width
    disabled
    :loading="true"
  >
    Распознаём...
  </UButton>

  <!-- After OCR success: continue (auto-advances after 600ms, or tap) -->
  <UButton
    v-else
    variant="primary"
    size="lg"
    full-width
    aria-label="Продолжить к редактированию позиций"
    @click="advanceToStep2"
  >
    Продолжить
    <UIcon name="arrow_forward" size="sm" class="ml-2" />
  </UButton>

  <!-- Retake — visible only when not loading -->
  <UButton
    v-if="!isOcrLoading"
    variant="ghost"
    size="md"
    full-width
    @click="resetPhoto"
  >
    Переснять
  </UButton>

</div>
```

---

### 4.3 States Summary — Step 1

| State | Description |
|---|---|
| **idle** | No photo selected. Camera + gallery buttons. Illustration placeholder. |
| **preview** | Photo selected. Image shown. OCR overlay with spinner. "Распознаём текст..." |
| **ocr-success** | OCR returned results. Green check flash for 600ms, then auto-advance. |
| **ocr-error** | OCR failed or returned empty. Error state shown (see Section 9.1). |
| **file-too-large** | Selected file > 10MB. Inline warning shown instead of preview. |
| **unsupported-format** | Non-image file selected. Inline error shown. |

---

## 5. Step 2: Edit Items

**Goal:** The user reviews the OCR-extracted line items, corrects names, quantities, and prices, and deletes spurious items.

### 5.1 Layout Structure

```
<!-- Step 2 content root -->
<div class="h-full flex flex-col">

  <!-- Scrollable items list — fills available height -->
  <div class="flex-1 overflow-y-auto no-scrollbar px-5 pt-4 pb-4">

    <!-- Section header -->
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-body font-semibold text-text-primary-light dark:text-text-primary-dark">
        Позиции чека
      </h2>
      <!-- Item count badge -->
      <UBadge variant="neutral" size="sm" shape="pill">
        {{ items.length }} поз.
      </UBadge>
    </div>

    <!-- Items list — TransitionGroup for add/remove animations -->
    <TransitionGroup
      tag="div"
      name="item-list"
      class="space-y-2 relative"
    >
      <ReceiptItemRow
        v-for="(item, index) in items"
        :key="item.id"
        :item="item"
        :index="index"
        @update="updateItem(item.id, $event)"
        @delete="deleteItem(item.id)"
      />
    </TransitionGroup>

    <!-- Add item button — below the list -->
    <button
      type="button"
      class="mt-3 flex items-center gap-2 w-full px-4 py-3 rounded-xl
             border border-dashed border-border-light dark:border-border-dark
             text-text-secondary-light dark:text-text-secondary-dark
             hover:border-primary/40 hover:text-primary hover:bg-primary-light
             active:scale-[0.98] transition-all duration-150"
      aria-label="Добавить позицию вручную"
      @click="addItem"
    >
      <UIcon name="add" size="sm" />
      <span class="text-body-sm font-medium">Добавить позицию</span>
    </button>

  </div>

  <!-- Footer: total + continue button — always visible above keyboard -->
  <div class="flex-shrink-0 border-t border-border-light dark:border-border-dark
              px-5 pt-3 pb-[calc(1.25rem+var(--safe-area-inset-bottom))]
              bg-background-light dark:bg-background-dark">

    <!-- Total row -->
    <div class="flex items-baseline justify-between mb-4">
      <span class="text-body-sm text-text-secondary-light dark:text-text-secondary-dark">
        Итого:
      </span>
      <span
        class="text-h3 font-bold text-text-primary-light dark:text-text-primary-dark
               tabular-nums transition-all duration-200"
      >
        {{ formatCurrency(totalAmount, currency) }}
      </span>
    </div>

    <UButton
      variant="primary"
      size="lg"
      full-width
      :disabled="items.length === 0"
      aria-label="Перейти к назначению участников"
      @click="advanceToStep3"
    >
      Далее — Участники
      <UIcon name="arrow_forward" size="sm" class="ml-2" />
    </UButton>

  </div>

</div>
```

---

### 5.2 ReceiptItemRow Component Anatomy

Each item is a card-like row with inline-editable fields. On mobile, tapping a field focuses it. The row has a swipe-to-delete affordance (using `SwipeableItem` wrapper).

```
<!-- ReceiptItemRow root — wrapped in SwipeableItem for swipe-delete -->
<SwipeableItem
  :delete-label="'Удалить'"
  @delete="$emit('delete')"
>
  <div
    class="flex items-start gap-3 px-4 py-3 rounded-xl
           bg-card-light dark:bg-card-dark
           border border-border-light dark:border-border-dark
           shadow-xs"
    :class="isEditing && 'border-primary/40 shadow-soft ring-1 ring-primary/20'"
  >
    <!-- Index number -->
    <div
      class="w-6 h-6 rounded-full bg-surface-light dark:bg-surface-dark
             flex items-center justify-center flex-shrink-0 mt-0.5"
      aria-hidden="true"
    >
      <span class="text-caption font-semibold
                   text-text-tertiary-light dark:text-text-tertiary-dark">
        {{ index + 1 }}
      </span>
    </div>

    <!-- Item details column -->
    <div class="flex-1 min-w-0 space-y-2">

      <!-- Name field — auto-expands, single line, no label shown to save space -->
      <input
        :value="item.name"
        type="text"
        inputmode="text"
        placeholder="Название товара"
        :aria-label="`Название позиции ${index + 1}`"
        class="w-full bg-transparent border-none outline-none
               text-body font-medium
               text-text-primary-light dark:text-text-primary-dark
               placeholder:text-text-tertiary-light dark:placeholder:text-text-tertiary-dark
               focus:placeholder:opacity-0 transition-all"
        @input="emit('update', { ...item, name: $event.target.value })"
        @focus="isEditing = true"
        @blur="isEditing = false"
      />

      <!-- Qty × Unit price row -->
      <div class="flex items-center gap-2">

        <!-- Quantity -->
        <div class="flex items-center gap-1 bg-surface-light dark:bg-surface-dark
                    rounded-lg px-2 py-1">
          <!-- Decrement -->
          <button
            type="button"
            :aria-label="`Уменьшить количество позиции ${index + 1}`"
            class="w-5 h-5 rounded flex items-center justify-center
                   text-text-secondary-light dark:text-text-secondary-dark
                   hover:text-primary active:scale-90 transition-all"
            @click="decrementQty"
          >
            <UIcon name="remove" size="xs" />
          </button>

          <input
            :value="item.qty"
            type="number"
            inputmode="decimal"
            min="0.01"
            step="0.01"
            :aria-label="`Количество позиции ${index + 1}`"
            class="w-8 text-center bg-transparent border-none outline-none
                   text-body-sm font-semibold
                   text-text-primary-light dark:text-text-primary-dark
                   tabular-nums"
            @input="emit('update', { ...item, qty: parseFloat($event.target.value) || 1 })"
          />

          <!-- Increment -->
          <button
            type="button"
            :aria-label="`Увеличить количество позиции ${index + 1}`"
            class="w-5 h-5 rounded flex items-center justify-center
                   text-text-secondary-light dark:text-text-secondary-dark
                   hover:text-primary active:scale-90 transition-all"
            @click="incrementQty"
          >
            <UIcon name="add" size="xs" />
          </button>
        </div>

        <!-- Multiplication sign -->
        <span class="text-caption text-text-tertiary-light dark:text-text-tertiary-dark">×</span>

        <!-- Unit price -->
        <div class="flex items-center gap-1 flex-1">
          <input
            :value="item.unitPrice"
            type="number"
            inputmode="decimal"
            min="0"
            step="0.01"
            placeholder="0"
            :aria-label="`Цена за единицу позиции ${index + 1}`"
            class="flex-1 min-w-0 bg-transparent border-b
                   border-border-light dark:border-border-dark
                   focus:border-primary outline-none
                   text-body-sm font-medium text-right
                   text-text-primary-light dark:text-text-primary-dark
                   tabular-nums pb-0.5 transition-colors"
            @input="emit('update', { ...item, unitPrice: parseFloat($event.target.value) || 0 })"
          />
          <span class="text-caption text-text-secondary-light dark:text-text-secondary-dark
                       flex-shrink-0">
            {{ currencySymbol }}
          </span>
        </div>

      </div>

    </div>

    <!-- Line total — right column -->
    <div class="flex flex-col items-end gap-1 flex-shrink-0">
      <span
        class="text-body font-semibold
               text-text-primary-light dark:text-text-primary-dark
               tabular-nums transition-all duration-200"
      >
        {{ formatCurrency(item.qty * item.unitPrice, currency) }}
      </span>
      <!-- Delete button — tap target -->
      <button
        type="button"
        :aria-label="`Удалить позицию ${index + 1}: ${item.name}`"
        class="w-7 h-7 rounded-full flex items-center justify-center
               text-text-tertiary-light dark:text-text-tertiary-dark
               hover:text-danger hover:bg-danger-light
               active:scale-90 transition-all duration-150"
        @click="$emit('delete')"
      >
        <UIcon name="delete" size="xs" />
      </button>
    </div>

  </div>
</SwipeableItem>
```

**TransitionGroup classes** for item add/remove:
```css
.item-list-enter-active {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.item-list-leave-active {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  position: absolute;
  width: 100%;
}
.item-list-enter-from {
  opacity: 0;
  transform: translateY(-8px) scale(0.97);
}
.item-list-leave-to {
  opacity: 0;
  transform: translateX(20px) scale(0.97);
}
.item-list-move {
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
```

When adding an item: `haptics.tap()`. When deleting: `haptics.warning()`.

The **total amount** in the footer updates with a brief scale pulse animation (`transform: scale(1.05) → scale(1)`, 200ms) whenever any quantity or price changes. Implemented via a CSS transition on the total element triggered by a watched computed value.

---

### 5.3 States Summary — Step 2

| State | Description |
|---|---|
| **populated** | Items extracted from OCR. Normal editing state. |
| **empty** | OCR returned 0 items. Empty state shown (see Section 8.2). |
| **item-editing** | A row is focused — border highlights with `border-primary/40 ring-1 ring-primary/20`. |
| **single-item** | Only 1 item. Delete button on it is hidden (list cannot be empty). |
| **adding** | User taps "Добавить позицию" — new row appended with empty fields and name field auto-focused via `nextTick`. `haptics.tap()`. |

---

## 6. Step 3: Assign Participants

**Goal:** The user defines who participated in the purchase. Each receipt item is assigned to one or more participants. Items shared by multiple people are split equally by default.

### 6.1 Layout Structure

```
<!-- Step 3 content root -->
<div class="h-full flex flex-col">

  <!-- Participants bar — fixed height, horizontal scroll -->
  <div class="flex-shrink-0 px-5 pt-4 pb-3
              border-b border-border-light dark:border-border-dark">

    <!-- Section label -->
    <p class="text-caption font-medium text-text-secondary-light dark:text-text-secondary-dark mb-2">
      Участники
    </p>

    <!-- Horizontal scrollable chips row -->
    <div class="flex gap-2 overflow-x-auto no-scrollbar pb-1">

      <!-- Add participant button — always first -->
      <button
        type="button"
        aria-label="Добавить участника"
        class="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full
               border border-dashed border-border-light dark:border-border-dark
               text-text-secondary-light dark:text-text-secondary-dark
               hover:border-primary/40 hover:text-primary
               active:scale-95 transition-all duration-150
               text-body-sm font-medium whitespace-nowrap"
        @click="openAddParticipantSheet"
      >
        <UIcon name="person_add" size="xs" />
        Добавить
      </button>

      <!-- Participant chips — one per person -->
      <TransitionGroup tag="div" name="chip-list" class="flex gap-2">
        <ParticipantChip
          v-for="p in participants"
          :key="p.id"
          :participant="p"
          :is-active="activeFilter === p.id"
          @click="toggleFilter(p.id)"
          @long-press="editParticipant(p.id)"
        />
      </TransitionGroup>

    </div>

  </div>

  <!-- Items list — scrollable, fills remaining height -->
  <div class="flex-1 overflow-y-auto no-scrollbar px-5 pt-4 pb-4">

    <!-- Assignment instruction hint — shown only on first use -->
    <div
      v-if="showHint"
      class="flex items-start gap-3 p-3 mb-4 rounded-xl
             bg-info-light border border-primary/20"
    >
      <UIcon name="touch_app" size="sm" class="text-primary flex-shrink-0 mt-0.5" />
      <p class="text-body-sm text-text-secondary-light dark:text-text-secondary-dark">
        Нажмите на позицию, чтобы назначить участников. Один товар может
        принадлежать нескольким людям.
      </p>
      <button
        type="button"
        aria-label="Закрыть подсказку"
        class="text-text-tertiary-light dark:text-text-tertiary-dark
               hover:text-text-secondary-light active:scale-90 transition-all"
        @click="dismissHint"
      >
        <UIcon name="close" size="xs" />
      </button>
    </div>

    <!-- Grouped or flat item list -->
    <div class="space-y-2">
      <AssignableItemRow
        v-for="item in filteredItems"
        :key="item.id"
        :item="item"
        :participants="participants"
        :assigned-ids="item.assignedParticipantIds"
        @toggle-participant="toggleItemParticipant(item.id, $event)"
      />
    </div>

  </div>

  <!-- Footer — summary + continue -->
  <div class="flex-shrink-0 border-t border-border-light dark:border-border-dark
              px-5 pt-3 pb-[calc(1.25rem+var(--safe-area-inset-bottom))]
              bg-background-light dark:bg-background-dark">

    <!-- Unassigned items warning -->
    <Transition name="section-slide">
      <div
        v-if="unassignedCount > 0"
        class="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl
               bg-warning-light"
        role="alert"
      >
        <UIcon name="warning" size="sm" class="text-warning flex-shrink-0" />
        <p class="text-body-sm text-warning font-medium">
          {{ unassignedCount }} поз. без участника — назначьте «Я» или другого
        </p>
      </div>
    </Transition>

    <UButton
      variant="primary"
      size="lg"
      full-width
      :disabled="participants.length === 0"
      aria-label="Перейти к итогу и созданию транзакций"
      @click="advanceToStep4"
    >
      Далее — Итог
      <UIcon name="arrow_forward" size="sm" class="ml-2" />
    </UButton>

  </div>

</div>
```

---

### 6.2 ParticipantChip Component Anatomy

Each chip is a pill button with a colored avatar and the participant's name. The color is drawn from `ENTITY_COLORS` assigned in order of creation.

```
<!-- ParticipantChip -->
<button
  type="button"
  :aria-label="`${participant.name}${isActive ? ', фильтр активен' : ''}`"
  :aria-pressed="isActive"
  class="flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-full
         border transition-all duration-150 active:scale-95"
  :class="cn(
    isActive
      ? 'border-transparent text-white shadow-sm'
      : 'border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark text-text-primary-light dark:text-text-primary-dark',
  )"
  :style="isActive ? { backgroundColor: participant.color } : {}"
>
  <!-- Avatar circle with first letter -->
  <div
    class="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
    :style="{ backgroundColor: isActive ? 'rgba(255,255,255,0.25)' : participant.color + '33' }"
    aria-hidden="true"
  >
    <span
      class="text-caption-sm font-bold leading-none"
      :style="{ color: isActive ? '#fff' : participant.color }"
    >
      {{ participant.name.charAt(0).toUpperCase() }}
    </span>
  </div>
  <span class="text-body-sm font-medium whitespace-nowrap">
    {{ participant.name }}
  </span>
</button>
```

**Color assignment**: The first participant ("Я") always gets `ENTITY_COLORS[0]` (`#3b82f6` — Blue). Each subsequent participant cycles through `ENTITY_COLORS[1]` onward.

**Active filter behavior**: When a chip is pressed (toggled active), the list below filters to show only items currently assigned to that participant. Pressing again clears the filter and shows all items. Transition: `section-slide` (200ms).

**Long press**: Opens a bottom sheet to rename or remove the participant (see Section 6.4).

---

### 6.3 AssignableItemRow Component Anatomy

```
<!-- AssignableItemRow -->
<div
  class="rounded-xl border transition-all duration-150 overflow-hidden"
  :class="cn(
    isFullyAssigned
      ? 'border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark'
      : 'border-warning/30 bg-warning-light/30 dark:bg-warning-light/10'
  )"
>
  <!-- Main row: item info -->
  <div class="flex items-center gap-3 px-4 py-3">

    <!-- Assignment status indicator -->
    <div
      class="w-2 h-2 rounded-full flex-shrink-0 transition-colors duration-200"
      :class="isFullyAssigned ? 'bg-success' : 'bg-warning'"
      :aria-label="isFullyAssigned ? 'Назначено' : 'Не назначено'"
    />

    <!-- Item name and total -->
    <div class="flex-1 min-w-0">
      <p class="text-body-sm font-medium text-text-primary-light dark:text-text-primary-dark truncate">
        {{ item.name }}
      </p>
      <p class="text-caption text-text-secondary-light dark:text-text-secondary-dark">
        {{ formatCurrency(item.qty * item.unitPrice, currency) }}
        <span v-if="item.qty !== 1" class="ml-1">
          · {{ item.qty }} {{ qty > 1 ? 'шт.' : 'шт.' }}
        </span>
      </p>
    </div>

    <!-- Assigned participant avatars (overlap stack, max 3 shown + overflow) -->
    <div class="flex items-center -space-x-1 flex-shrink-0" aria-label="Назначено участникам">
      <div
        v-for="(pid, i) in item.assignedParticipantIds.slice(0, 3)"
        :key="pid"
        class="w-6 h-6 rounded-full border-2 border-card-light dark:border-card-dark
               flex items-center justify-center"
        :style="{ backgroundColor: getParticipantColor(pid), zIndex: 10 - i }"
        :aria-label="getParticipantName(pid)"
      >
        <span class="text-caption-xs font-bold text-white leading-none">
          {{ getParticipantName(pid).charAt(0).toUpperCase() }}
        </span>
      </div>
      <!-- Overflow badge -->
      <div
        v-if="item.assignedParticipantIds.length > 3"
        class="w-6 h-6 rounded-full border-2 border-card-light dark:border-card-dark
               bg-surface-light dark:bg-surface-dark
               flex items-center justify-center"
      >
        <span class="text-caption-xs font-bold text-text-secondary-light dark:text-text-secondary-dark">
          +{{ item.assignedParticipantIds.length - 3 }}
        </span>
      </div>
    </div>

  </div>

  <!-- Participant toggle chips — expanded below the main row -->
  <div
    class="flex gap-1.5 flex-wrap px-4 pb-3 pt-0"
    role="group"
    :aria-label="`Назначить участников для позиции «${item.name}»`"
  >
    <button
      v-for="p in participants"
      :key="p.id"
      type="button"
      :aria-label="`${p.name}${isAssigned(p.id) ? ', назначен' : ''}`"
      :aria-pressed="isAssigned(p.id)"
      class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full
             text-body-sm font-medium transition-all duration-150 active:scale-95"
      :class="cn(
        isAssigned(p.id)
          ? 'text-white shadow-xs'
          : 'bg-surface-light dark:bg-surface-dark text-text-secondary-light dark:text-text-secondary-dark border border-border-light dark:border-border-dark'
      )"
      :style="isAssigned(p.id) ? { backgroundColor: p.color } : {}"
      @click="$emit('toggle-participant', p.id)"
    >
      <div
        class="w-3.5 h-3.5 rounded-full flex-shrink-0"
        :style="{ backgroundColor: isAssigned(p.id) ? 'rgba(255,255,255,0.3)' : p.color + '44' }"
        aria-hidden="true"
      />
      {{ p.name }}
      <UIcon v-if="isAssigned(p.id)" name="check" size="xs" />
    </button>
  </div>

</div>
```

**Haptic on toggle**: `haptics.tap()` each time a participant chip is toggled on or off.

**Visual feedback on toggle**: When a participant is added to an item, the chip scales `0.95 → 1.05 → 1` (spring-like, 200ms). When removed, it fades to neutral.

**Shared item indication**: If `assignedParticipantIds.length > 1`, a small label appears below the chips:
```
<p class="text-caption text-text-tertiary-light dark:text-text-tertiary-dark mt-1 px-4 pb-2">
  Разделено поровну между {{ assignedParticipantIds.length }} участниками
</p>
```

---

### 6.4 Add Participant Bottom Sheet

Triggered by the "Добавить" button or the "+" at the end of the chips row. Rendered as a `UModal`.

```
<UModal v-model="addParticipantOpen" title="Добавить участника">

  <!-- "Я" quick-add — only shown if "Я" not already in list -->
  <button
    v-if="!hasMe"
    type="button"
    class="flex items-center gap-3 w-full px-4 py-3 rounded-xl mb-3
           bg-primary-light border border-primary/20
           active:scale-[0.98] transition-all"
    @click="addMe"
  >
    <div class="w-9 h-9 rounded-full bg-primary flex items-center justify-center">
      <UIcon name="person" size="sm" class="text-white" />
    </div>
    <div class="text-left">
      <p class="text-body-sm font-semibold text-primary">Добавить «Я»</p>
      <p class="text-caption text-text-secondary-light dark:text-text-secondary-dark">
        Вы участвуете в этом чеке
      </p>
    </div>
    <UIcon name="add_circle" size="sm" class="text-primary ml-auto" />
  </button>

  <!-- Custom name input -->
  <div class="space-y-3">
    <UInput
      v-model="newName"
      label="Имя участника"
      placeholder="Например: Аня, Коля..."
      :error="nameError"
      @keydown.enter.prevent="confirmAdd"
    />
  </div>

  <template #actions>
    <UButton
      variant="primary"
      size="lg"
      full-width
      :disabled="!newName.trim()"
      @click="confirmAdd"
    >
      Добавить
    </UButton>
  </template>

</UModal>
```

---

### 6.5 States Summary — Step 3

| State | Description |
|---|---|
| **no-participants** | No one added yet. "Я" quick-add prompt shown prominently (see Section 8.3). |
| **participants-added** | Normal state. Items shown, chips available. |
| **filter-active** | One chip is active. List filtered. Active chip colored, others desaturated. |
| **all-assigned** | All items have at least one participant. Progress indicator shows 100%. |
| **unassigned-warning** | Some items have no participant. Warning banner shown above CTA. |

---

## 7. Step 4: Summary & Create

**Goal:** Show a per-person breakdown of what each participant owes. Confirm account, category, description, date, and create all transactions / debts.

### 7.1 Layout Structure

```
<!-- Step 4 content root -->
<div class="h-full flex flex-col">

  <!-- Scrollable summary content -->
  <div class="flex-1 overflow-y-auto no-scrollbar px-5 pt-4 pb-4 space-y-5">

    <!-- Per-person breakdown cards -->
    <section aria-label="Разбивка по участникам">
      <h2 class="text-body-sm font-semibold text-text-secondary-light dark:text-text-secondary-dark
                 uppercase tracking-wide mb-3">
        Кто платит сколько
      </h2>

      <div class="space-y-3">
        <PersonSummaryCard
          v-for="p in participantSummaries"
          :key="p.id"
          :participant="p"
          :currency="currency"
        />
      </div>
    </section>

    <!-- Divider -->
    <div class="h-px bg-border-light dark:bg-border-dark" />

    <!-- Transaction details form -->
    <section aria-label="Параметры транзакций" class="space-y-4">
      <h2 class="text-body-sm font-semibold text-text-secondary-light dark:text-text-secondary-dark
                 uppercase tracking-wide">
        Параметры
      </h2>

      <!-- Account selector -->
      <AccountSelector
        :accounts="accounts"
        :selected-id="formData.accountId"
        label="Счёт"
        @select="formData.accountId = $event"
      />

      <!-- Category chips -->
      <CategoryChips
        :categories="expenseCategories"
        :selected-id="formData.categoryId"
        label="Категория"
        @select="formData.categoryId = $event"
      />

      <!-- Description + Date row (same pattern as TransactionForm) -->
      <div class="grid grid-cols-2 gap-2">
        <UInput
          v-model="formData.description"
          label="Комментарий"
          placeholder="#продукты, #кафе..."
        />
        <div class="flex flex-col gap-1.5 w-full">
          <label class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark ml-0.5">
            Дата
          </label>
          <!-- Date picker trigger — same as in TransactionForm -->
          <Popover v-model:open="calendarOpen">
            <PopoverTrigger as-child>
              <button
                type="button"
                class="flex items-center justify-between w-full px-3 py-3 rounded-lg text-sm
                       bg-card-light dark:bg-card-dark
                       border border-border-light dark:border-border-dark
                       text-text-primary-light dark:text-text-primary-dark
                       transition-all duration-150"
              >
                <span>{{ displayDate }}</span>
                <UIcon name="calendar_today" size="sm"
                       class="text-text-tertiary-light dark:text-text-tertiary-dark" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" side="top" :side-offset="8" class="w-auto p-0">
              <Calendar :model-value="calendarValue" locale="ru-RU" @update:model-value="onDateSelect" />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <!-- Create debts toggle -->
      <button
        type="button"
        role="switch"
        :aria-checked="createDebts"
        aria-label="Создать долги для участников"
        class="flex items-center justify-between w-full px-4 py-3 rounded-xl
               bg-card-light dark:bg-card-dark
               border border-border-light dark:border-border-dark
               transition-all"
        :class="createDebts && 'border-primary bg-primary/5'"
        @click="createDebts = !createDebts"
      >
        <div class="flex items-center gap-3">
          <div
            class="w-9 h-9 rounded-full flex items-center justify-center"
            :class="createDebts
              ? 'bg-primary/20 text-primary'
              : 'bg-surface-light dark:bg-surface-dark text-text-secondary-light dark:text-text-secondary-dark'"
          >
            <UIcon name="group" size="sm" />
          </div>
          <div class="text-left">
            <p class="text-body-sm font-medium text-text-primary-light dark:text-text-primary-dark">
              Создать долги
            </p>
            <p class="text-caption text-text-secondary-light dark:text-text-secondary-dark">
              Участники увидят, сколько должны вам
            </p>
          </div>
        </div>
        <!-- Toggle switch — same pattern as SplitExpenseSection -->
        <div
          class="w-12 h-7 rounded-full transition-all relative"
          :class="createDebts ? 'bg-primary' : 'bg-border-light dark:bg-border-dark'"
        >
          <div
            class="absolute w-5 h-5 bg-white rounded-full top-1 shadow-xs transition-all"
            :class="createDebts ? 'right-1' : 'left-1'"
          />
        </div>
      </button>

    </section>

    <!-- Total summary -->
    <div class="p-4 rounded-2xl bg-surface-light dark:bg-surface-dark space-y-2">
      <div class="flex justify-between items-baseline">
        <span class="text-body-sm text-text-secondary-light dark:text-text-secondary-dark">
          Сумма чека
        </span>
        <span class="text-h3 font-bold text-text-primary-light dark:text-text-primary-dark tabular-nums">
          {{ formatCurrency(receiptTotal, currency) }}
        </span>
      </div>
      <div class="h-px bg-border-light dark:bg-border-dark" />
      <div class="flex justify-between items-center">
        <span class="text-body-sm text-text-secondary-light dark:text-text-secondary-dark">
          Создаётся транзакций
        </span>
        <UBadge variant="primary" size="sm" shape="pill">
          {{ transactionCount }}
        </UBadge>
      </div>
      <div v-if="createDebts" class="flex justify-between items-center">
        <span class="text-body-sm text-text-secondary-light dark:text-text-secondary-dark">
          Создаётся долгов
        </span>
        <UBadge variant="neutral" size="sm" shape="pill">
          {{ debtCount }}
        </UBadge>
      </div>
    </div>

  </div>

  <!-- Sticky footer: error + create button -->
  <div class="flex-shrink-0 border-t border-border-light dark:border-border-dark
              px-5 pt-3 pb-[calc(1.25rem+var(--safe-area-inset-bottom))]
              bg-background-light dark:bg-background-dark">

    <!-- Validation error -->
    <Transition name="section-slide">
      <p v-if="submitError" class="text-body-sm text-danger mb-3 flex items-center gap-2">
        <UIcon name="error" size="sm" class="flex-shrink-0" />
        {{ submitError }}
      </p>
    </Transition>

    <UButton
      variant="primary"
      size="xl"
      full-width
      :loading="isSubmitting"
      :disabled="!isFormValid"
      aria-label="Создать транзакции по чеку"
      @click="handleSubmit"
    >
      <UIcon name="receipt_long" size="sm" class="mr-2" />
      Создать транзакции
    </UButton>

  </div>

</div>
```

---

### 7.2 PersonSummaryCard Component Anatomy

```
<!-- PersonSummaryCard -->
<div
  class="rounded-xl border border-border-light dark:border-border-dark
         bg-card-light dark:bg-card-dark overflow-hidden"
>
  <!-- Header row: avatar + name + total -->
  <div class="flex items-center gap-3 px-4 py-3">
    <!-- Colored avatar -->
    <div
      class="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
      :style="{ backgroundColor: participant.color + '22' }"
    >
      <span
        class="text-body font-bold"
        :style="{ color: participant.color }"
      >
        {{ participant.name.charAt(0).toUpperCase() }}
      </span>
    </div>
    <div class="flex-1 min-w-0">
      <p class="text-body font-semibold text-text-primary-light dark:text-text-primary-dark">
        {{ participant.name }}
        <span v-if="participant.isMe" class="text-caption text-text-tertiary-light dark:text-text-tertiary-dark font-normal ml-1">
          (вы)
        </span>
      </p>
      <p class="text-caption text-text-secondary-light dark:text-text-secondary-dark">
        {{ participant.itemCount }} поз.
      </p>
    </div>
    <!-- Total for this person -->
    <span class="text-body-lg font-bold tabular-nums" :style="{ color: participant.color }">
      {{ formatCurrency(participant.total, currency) }}
    </span>
  </div>

  <!-- Expandable item list — collapsed by default, expand on chevron tap -->
  <Transition name="section-slide">
    <div
      v-if="isExpanded"
      class="border-t border-border-light dark:border-border-dark
             divide-y divide-border-light dark:divide-border-dark"
    >
      <div
        v-for="item in participant.items"
        :key="item.id"
        class="flex items-center justify-between px-4 py-2.5"
      >
        <div class="flex-1 min-w-0 mr-3">
          <p class="text-body-sm text-text-primary-light dark:text-text-primary-dark truncate">
            {{ item.name }}
          </p>
          <!-- If item is shared: show per-person split -->
          <p v-if="item.sharedWith > 1" class="text-caption text-text-tertiary-light dark:text-text-tertiary-dark">
            1/{{ item.sharedWith }} от {{ formatCurrency(item.lineTotal, currency) }}
          </p>
        </div>
        <span class="text-body-sm font-semibold text-text-primary-light dark:text-text-primary-dark tabular-nums">
          {{ formatCurrency(item.share, currency) }}
        </span>
      </div>
    </div>
  </Transition>

  <!-- Expand toggle button -->
  <button
    type="button"
    class="flex items-center justify-center gap-1 w-full py-2
           border-t border-border-light dark:border-border-dark
           text-text-tertiary-light dark:text-text-tertiary-dark
           text-caption font-medium hover:text-text-secondary-light
           transition-colors duration-150"
    :aria-expanded="isExpanded"
    :aria-label="isExpanded ? `Скрыть позиции ${participant.name}` : `Показать позиции ${participant.name}`"
    @click="isExpanded = !isExpanded"
  >
    {{ isExpanded ? 'Скрыть' : 'Показать позиции' }}
    <UIcon
      :name="isExpanded ? 'expand_less' : 'expand_more'"
      size="xs"
      class="transition-transform duration-200"
      :class="isExpanded && 'rotate-180'"
    />
  </button>

</div>
```

---

### 7.3 Success State After Create

After `handleSubmit` completes successfully:

1. `haptics.success()` is called immediately.
2. A brief full-screen success overlay appears (250ms fade-in):
   ```
   <div class="fixed inset-0 z-50 flex flex-col items-center justify-center
               bg-background-light dark:bg-background-dark
               animate-fadeInUp">
     <div class="w-20 h-20 rounded-full bg-success/20 flex items-center justify-center mb-6
                 animate-scaleIn">
       <UIcon name="receipt_long" size="2xl" class="text-success" />
     </div>
     <h2 class="text-h2 font-bold text-text-primary-light dark:text-text-primary-dark mb-2">
       Готово!
     </h2>
     <p class="text-body text-text-secondary-light dark:text-text-secondary-dark text-center px-8">
       Создано {{ transactionCount }} транзакций
       <template v-if="createDebts"> и {{ debtCount }} долгов</template>
     </p>
   </div>
   ```
3. After 1.5 seconds, the router navigates to `/` (Dashboard) with a `useToast()` toast:
   - `title: 'Чек добавлен'`
   - `description: 'Создано X транзакций'`
   - `variant: 'success'`

---

### 7.4 States Summary — Step 4

| State | Description |
|---|---|
| **ready** | All form fields valid. Create button active. |
| **no-account** | No account selected. Button disabled. Warning: "Выберите счёт". |
| **no-category** | No category selected. Button disabled. Warning: "Выберите категорию". |
| **submitting** | `isSubmitting = true`. Button shows spinner. Form opacified (`opacity-60 pointer-events-none`). |
| **submit-error** | API error. Error message shown above button. `animate-shake` on button. `haptics.error()`. |
| **success** | Full-screen overlay (see 7.3). Auto-navigate after 1.5s. |

---

## 8. Empty States

### 8.1 Step 1 — No Camera/Gallery Support

Shown when the browser does not support file input `capture="environment"` (e.g. desktop):

```
<EmptyState
  variant="inline"
  icon="no_photography"
  title="Камера недоступна"
  description="Откройте приложение на мобильном устройстве, чтобы сфотографировать чек"
/>
```
The gallery ("Выбрать из галереи") button is still shown and functional.

---

### 8.2 Step 2 — Zero Items After OCR

Shown when OCR succeeds but finds no line items:

```
<div class="flex-1 flex flex-col items-center justify-center px-8 gap-5 py-10">

  <div class="w-16 h-16 rounded-full bg-warning-light flex items-center justify-center">
    <UIcon name="receipt" size="xl" class="text-warning" />
  </div>

  <div class="text-center">
    <h3 class="text-body font-semibold text-text-primary-light dark:text-text-primary-dark mb-1">
      Позиции не найдены
    </h3>
    <p class="text-body-sm text-text-secondary-light dark:text-text-secondary-dark">
      Не удалось распознать позиции чека. Добавьте их вручную или переснимите чек.
    </p>
  </div>

  <div class="flex flex-col gap-2 w-full">
    <UButton variant="primary" size="lg" full-width @click="addItem">
      <UIcon name="add" size="sm" class="mr-2" />
      Добавить вручную
    </UButton>
    <UButton variant="ghost" size="md" full-width @click="goBackToStep1">
      Переснять чек
    </UButton>
  </div>

</div>
```

---

### 8.3 Step 3 — No Participants Yet

Shown before any participant has been added:

```
<div class="flex-1 flex flex-col items-center justify-center px-8 gap-5 py-10">

  <div class="w-16 h-16 rounded-full bg-primary-light flex items-center justify-center">
    <UIcon name="group_add" size="xl" class="text-primary" />
  </div>

  <div class="text-center">
    <h3 class="text-body font-semibold text-text-primary-light dark:text-text-primary-dark mb-1">
      Добавьте участников
    </h3>
    <p class="text-body-sm text-text-secondary-light dark:text-text-secondary-dark">
      Укажите, кто участвовал в покупке. Начните с себя.
    </p>
  </div>

  <!-- Quick-add "Я" -->
  <button
    type="button"
    class="flex items-center gap-3 w-full max-w-xs px-5 py-4 rounded-2xl
           bg-primary text-white shadow-md active:scale-[0.97] transition-all"
    @click="addMe"
  >
    <div class="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
      <UIcon name="person" size="md" class="text-white" />
    </div>
    <div class="text-left">
      <p class="text-body font-semibold">Добавить «Я»</p>
      <p class="text-body-sm text-white/70">Я участвовал в покупке</p>
    </div>
    <UIcon name="add" size="sm" class="ml-auto text-white/80" />
  </button>

  <button
    type="button"
    class="text-body-sm text-text-secondary-light dark:text-text-secondary-dark
           underline underline-offset-2"
    @click="openAddParticipantSheet"
  >
    Добавить другого участника
  </button>

</div>
```

---

## 9. Error States

### 9.1 Step 1 — OCR Error

```
<!-- Replaces the loading overlay when OCR fails -->
<div
  class="absolute inset-0 rounded-2xl bg-background-dark/80 backdrop-blur-sm
         flex flex-col items-center justify-center gap-4 px-8"
  role="alert"
  aria-live="assertive"
>
  <div class="w-14 h-14 rounded-full bg-danger-light flex items-center justify-center">
    <UIcon name="error_outline" size="xl" class="text-danger" />
  </div>
  <div class="text-center">
    <p class="text-body font-semibold text-white mb-1">Не удалось распознать</p>
    <p class="text-body-sm text-white/70">
      Убедитесь, что чек хорошо освещён и полностью в кадре
    </p>
  </div>
  <div class="flex flex-col gap-2 w-full">
    <UButton variant="primary" size="md" full-width @click="retryOcr">
      <UIcon name="refresh" size="sm" class="mr-2" />
      Попробовать снова
    </UButton>
    <UButton variant="ghost" size="md" full-width class="text-white/80" @click="resetPhoto">
      Выбрать другое фото
    </UButton>
  </div>
</div>
```

Haptic: `haptics.error()` when the error state is entered.

---

### 9.2 Step 1 — File Validation Errors

Shown as an inline message below the file input area (no preview shown):

```
<!-- File too large: > 10MB -->
<div class="flex items-center gap-2 px-4 py-3 rounded-xl bg-danger-light animate-shake"
     role="alert">
  <UIcon name="warning" size="sm" class="text-danger flex-shrink-0" />
  <p class="text-body-sm text-danger">
    Файл слишком большой. Максимальный размер — 10 МБ.
  </p>
</div>

<!-- Wrong format -->
<div class="flex items-center gap-2 px-4 py-3 rounded-xl bg-danger-light animate-shake"
     role="alert">
  <UIcon name="warning" size="sm" class="text-danger flex-shrink-0" />
  <p class="text-body-sm text-danger">
    Неверный формат файла. Поддерживаются JPG, PNG, HEIC.
  </p>
</div>
```

---

### 9.3 Step 2 — Item Validation

If the user taps "Далее" with an item that has `unitPrice = 0` or empty `name`:

- The offending row highlights with `border-danger/40 bg-danger-light/20` and `animate-shake`.
- An inline error label appears: `text-caption text-danger` — "Укажите название" or "Укажите цену".
- Focus moves to the first invalid field via `nextTick` + `.focus()`.
- Haptic: `haptics.error()`.

---

### 9.4 Step 4 — Submit Error

Described in Section 7.4. Error message appears above the CTA with `animate-shake`, `haptics.error()`.

---

## 10. Accessibility Summary

### 10.1 Focus Management

- When a new step is entered (via forward/back transition), focus is moved to the first interactive element of that step after the `transitionend` event fires. This prevents the focus remaining on a now-hidden element.
- On Step 2, when a new item is added, focus is placed in the `name` input of the new row via `nextTick`.
- On Step 3, when a participant is added, focus returns to the "Добавить" button.
- `UModal` (add participant sheet) uses Reka UI's built-in focus trap.

### 10.2 Screen Reader Announcements

- The `StepProgressIndicator` has `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, and a descriptive `aria-label`.
- The step label change (in the header) is wrapped in a `<span aria-live="polite">` so screen readers announce the new step name.
- The unassigned items warning in Step 3 uses `role="alert"` for immediate announcement.
- The success overlay in Step 4 uses `aria-live="assertive"`.
- All icon-only buttons have explicit `aria-label` describing the action and the relevant item name.
- Toggle switches have `role="switch"` and `aria-checked`.
- Participant assignment chips have `aria-pressed` to reflect current state.

### 10.3 Keyboard Navigation

| Context | Key | Behavior |
|---|---|---|
| Any step | `Tab` | Move focus through interactive elements |
| Any step | `Shift+Tab` | Reverse focus order |
| Step 1 buttons | `Enter` / `Space` | Trigger camera or gallery |
| Step 2 item name | `Enter` | Move focus to qty input in same row |
| Step 2 item qty | `Enter` | Move focus to price input in same row |
| Step 2 item price | `Enter` | Move focus to name input of next row |
| Step 2 add-item button | `Enter` | Add new row, focus lands in new name input |
| Step 3 participant chip | `Enter` / `Space` | Toggle filter |
| Step 3 assignment chip | `Enter` / `Space` | Toggle participant assignment |
| Any modal | `Escape` | Close modal, return focus to trigger |
| CTA button | `Enter` | Advance step / submit |

### 10.4 Touch Targets

All interactive elements comply with the 44×44px minimum touch target:
- Qty +/− buttons: `w-5 h-5` visual with `w-9 h-9` tap area via padding or pseudo-element.
- Delete buttons: `w-7 h-7` with surrounding padding ensuring 44px total tap area.
- Participant chips: minimum `py-2 px-3` giving ~36px height; increased to `py-2.5` where needed.
- Expand/collapse toggles on PersonSummaryCard: `py-2` gives ~40px. Acceptable; tap area is full width.

### 10.5 Reduced Motion

All `transition-*` and `animate-*` classes should be gated behind `prefers-reduced-motion: no-preference`. Add to global styles:

```css
@media (prefers-reduced-motion: reduce) {
  .animate-fadeInUp,
  .animate-scaleIn,
  .animate-slideInFromBottom,
  .animate-shake {
    animation: none !important;
  }
  .step-forward-enter-active,
  .step-forward-leave-active,
  .step-back-enter-active,
  .step-back-leave-active {
    transition: opacity 150ms ease !important;
  }
  .step-forward-enter-from,
  .step-back-enter-from {
    transform: none !important;
  }
}
```

---

## Appendix A: Component File Placement

Following FSD conventions:

```
frontend/src/
├── pages/
│   └── scan-receipt/
│       └── ScanReceiptPage.vue          # Route component, step router
│
└── features/
    └── scan-receipt/
        ├── index.ts                      # Public API
        ├── model/
        │   ├── types.ts                  # ReceiptItem, Participant, AssignmentMap, etc.
        │   ├── useReceiptWizard.ts       # Step state machine, OCR call, submit logic
        │   ├── useOcrUpload.ts           # File validation, FormData, API call
        │   └── useParticipantColors.ts   # Maps participant ID → ENTITY_COLORS index
        └── ui/
            ├── steps/
            │   ├── Step1PhotoCapture.vue
            │   ├── Step2EditItems.vue
            │   ├── Step3AssignParticipants.vue
            │   └── Step4Summary.vue
            ├── ReceiptItemRow.vue
            ├── ParticipantChip.vue
            ├── AssignableItemRow.vue
            ├── PersonSummaryCard.vue
            └── StepProgressIndicator.vue
```

---

## Appendix B: Data Types Reference

```typescript
// features/scan-receipt/model/types.ts

interface ReceiptItem {
  id: string;           // nanoid()
  name: string;
  qty: number;          // default: 1
  unitPrice: number;
  assignedParticipantIds: string[];
}

interface Participant {
  id: string;           // nanoid()
  name: string;         // "Я" for self
  isMe: boolean;
  color: string;        // from ENTITY_COLORS
}

interface ParticipantSummary {
  id: string;
  name: string;
  isMe: boolean;
  color: string;
  itemCount: number;
  total: number;
  items: {
    id: string;
    name: string;
    lineTotal: number;
    share: number;       // lineTotal / sharedWith
    sharedWith: number;
  }[];
}

interface WizardStep {
  step: 1 | 2 | 3 | 4;
  direction: 'forward' | 'back';
}

interface ScanReceiptFormData {
  accountId: string;
  categoryId: string;
  description: string;
  date: number;         // Unix timestamp ms
  createDebts: boolean;
  currency: string;
}
```

---

## Appendix C: Route Registration

```typescript
// frontend/src/app/router/index.ts

{
  path: '/scan-receipt',
  name: 'scan-receipt',
  component: () => import('@/pages/scan-receipt/ScanReceiptPage.vue'),
  meta: {
    requiresAuth: true,
    requiresPremium: true,    // guarded at router level
    title: 'Сканировать чек',
  },
}
```

At the router `beforeEach` guard level, if `requiresPremium` is true and `!isPremium`, redirect to `/` and call `requirePremium('Сканирование чеков')` to open the upgrade modal.
