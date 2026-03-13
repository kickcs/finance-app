# Demo Setup Screen Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the demo button spinner with a fullscreen animated stepper that shows preparation progress.

**Architecture:** New `DemoSetupScreen.vue` component in `features/demo-mode/ui/`. It runs fake timed steps in parallel with the real API call. LoginPage delegates demo flow to this component via `:visible` prop and `@complete`/`@error` events.

**Tech Stack:** Vue 3 Composition API, `useTimeoutFn` from `@vueuse/core`, `UProgressBar`/`UIcon` from `shared/ui`, Tailwind CSS v4 design tokens.

**Spec:** `docs/superpowers/specs/2026-03-13-demo-setup-screen-design.md`

---

## Chunk 1: DemoSetupScreen Component

### Task 1: Create DemoSetupScreen.vue

**Files:**
- Create: `frontend/src/features/demo-mode/ui/DemoSetupScreen.vue`

- [ ] **Step 1: Create the component file with full implementation**

```vue
<script setup lang="ts">
import { ref, watch, computed, onUnmounted } from 'vue';
import { useTimeoutFn } from '@vueuse/core';
import { UProgressBar, UIcon } from '@/shared/ui';
import { useAuth } from '@/shared/api/composables/useAuth';

const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  (e: 'complete'): void;
  (e: 'error', message: string): void;
}>();

const { signInAnonymously } = useAuth();

const STEPS = [
  { title: 'Создаём профиль', subtitle: 'Ваш аккаунт готов' },
  { title: 'Добавляем счета', subtitle: 'Кошелёк, карты, накопления' },
  { title: 'Генерируем историю', subtitle: 'Транзакции за последний месяц' },
  { title: 'Финальные штрихи', subtitle: 'Долги, напоминания, контакты' },
] as const;

const STEP_INTERVAL = 600;
const COMPLETE_DELAY = 400;

const currentStep = ref(1);
const apiDone = ref(false);
const allDone = ref(false);

// Timers for steps 2, 3, 4 (step 1 shows immediately)
const stepTimer2 = useTimeoutFn(() => { currentStep.value = 2; }, STEP_INTERVAL, { immediate: false });
const stepTimer3 = useTimeoutFn(() => { currentStep.value = 3; }, STEP_INTERVAL * 2, { immediate: false });
const stepTimer4 = useTimeoutFn(() => { currentStep.value = 4; tryComplete(); }, STEP_INTERVAL * 3, { immediate: false });
const completeTimer = useTimeoutFn(() => { emit('complete'); }, COMPLETE_DELAY, { immediate: false });

const stepTimers = [stepTimer2, stepTimer3, stepTimer4];

function stopAllTimers() {
  stepTimers.forEach((t) => t.stop());
  completeTimer.stop();
}

function tryComplete() {
  if (currentStep.value >= STEPS.length && apiDone.value) {
    allDone.value = true;
    completeTimer.start();
  }
}

const progress = computed(() => {
  if (allDone.value) return 100;
  // Step 1: 25%, Step 2: 50%, Step 3: 75%, Step 4 active: 88%
  const stepProgress = [25, 50, 75, 88];
  return stepProgress[currentStep.value - 1] ?? 0;
});

const currentStepData = computed(() => STEPS[currentStep.value - 1]);

watch(
  () => props.visible,
  async (show) => {
    if (!show) {
      stopAllTimers();
      return;
    }

    // Reset state
    currentStep.value = 1;
    apiDone.value = false;
    allDone.value = false;

    // Start fake stepper timers
    stepTimers.forEach((t) => t.start());

    // Start real API call in parallel
    try {
      await signInAnonymously();
      apiDone.value = true;
      tryComplete();
    } catch (err) {
      // signInAnonymously() already settled — isLoading is false
      stopAllTimers();
      const message =
        err instanceof Error && err.message.includes('429')
          ? 'Слишком много запросов. Попробуйте позже.'
          : 'Не удалось запустить демо режим';
      emit('error', message);
    }
  },
);

onUnmounted(() => stopAllTimers());
</script>

<template>
  <Transition name="demo-overlay">
    <div
      v-if="visible"
      class="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background-light dark:bg-background-dark"
    >
      <!-- Content container -->
      <div class="flex flex-col items-center gap-8 px-6 w-full max-w-sm">
        <!-- Stepper circles -->
        <div class="flex items-center gap-0">
          <template v-for="(step, index) in STEPS" :key="index">
            <!-- Connector line (before each step except first) -->
            <div
              v-if="index > 0"
              class="w-8 h-0.5 transition-colors duration-300"
              :class="
                currentStep > index
                  ? 'bg-success'
                  : 'bg-border-light dark:bg-border-dark'
              "
            />

            <!-- Step circle -->
            <div
              class="relative flex items-center justify-center w-7 h-7 rounded-full transition-all duration-300 shrink-0"
              :class="[
                currentStep > index + 1 || (index + 1 === STEPS.length && allDone)
                  ? 'bg-success'
                  : currentStep === index + 1
                    ? 'border-2 border-primary'
                    : 'border-2 border-border-light dark:border-border-dark',
              ]"
            >
              <!-- Completed: checkmark -->
              <UIcon
                v-if="currentStep > index + 1 || (index + 1 === STEPS.length && allDone)"
                name="check"
                size="xs"
                class="text-white"
              />
              <!-- Active: pulsing dot -->
              <div
                v-else-if="currentStep === index + 1"
                class="w-[7px] h-[7px] rounded-full bg-primary animate-pulse"
              />
              <!-- Pending: empty -->
            </div>
          </template>
        </div>

        <!-- Step text with fade transition -->
        <div class="text-center min-h-[56px] flex flex-col items-center justify-center">
          <Transition name="step-text" mode="out-in">
            <div :key="currentStep" class="flex flex-col items-center gap-1">
              <p
                class="text-body-lg font-semibold text-text-primary-light dark:text-text-primary-dark"
              >
                {{ currentStepData.title }}
              </p>
              <p class="text-body-sm text-text-secondary-light dark:text-text-secondary-dark">
                {{ currentStepData.subtitle }}
              </p>
            </div>
          </Transition>
        </div>

        <!-- Progress bar -->
        <div class="w-full max-w-[200px]">
          <UProgressBar :value="progress" size="sm" color="primary" />
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* Overlay appear/disappear */
.demo-overlay-enter-active {
  transition: opacity 0.2s ease-out;
}
.demo-overlay-leave-active {
  transition: opacity 0.15s ease-in;
}
.demo-overlay-enter-from,
.demo-overlay-leave-to {
  opacity: 0;
}

/* Step text crossfade */
.step-text-enter-active {
  transition: all 0.2s ease-out;
}
.step-text-leave-active {
  transition: all 0.15s ease-in;
}
.step-text-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.step-text-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `cd frontend && npx vue-tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to DemoSetupScreen

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/demo-mode/ui/DemoSetupScreen.vue
git commit -m "feat(demo): add DemoSetupScreen fullscreen stepper component"
```

---

### Task 2: Export DemoSetupScreen from feature barrel

**Files:**
- Modify: `frontend/src/features/demo-mode/index.ts`

- [ ] **Step 1: Add export**

Add after the DemoBanner export:
```ts
export { default as DemoSetupScreen } from './ui/DemoSetupScreen.vue';
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/demo-mode/index.ts
git commit -m "feat(demo): export DemoSetupScreen from feature barrel"
```

---

### Task 3: Integrate DemoSetupScreen into LoginPage

**Files:**
- Modify: `frontend/src/pages/auth/LoginPage.vue`

- [ ] **Step 1: Update imports**

Add `DemoSetupScreen` to imports at top of `<script setup>`:
```ts
import { DemoSetupScreen } from '@/features/demo-mode';
```

- [ ] **Step 2: Replace demo mode logic and clean up imports (atomic — apply steps 2, 3, 5 together)**

Replace the entire demo mode section (lines 188-222) AND update imports AND simplify button template in one atomic edit to avoid intermediate broken state.

First, update the `useAuth()` destructuring (line 13):
```ts
// Before:
const { signIn, signUp, signInAnonymously, isLoading, error: _error } = useAuth();
// After:
const { signIn, signUp, isLoading, error: _error } = useAuth();
```

Then replace the demo mode section (lines 188-222):

```ts
// Old code to remove:
// Demo mode
const isDemoLoading = ref(false);

// Combined loading state - blocks all buttons when any action is in progress
const isAnyLoading = computed(() => isLoading.value || isDemoLoading.value);

async function handleDemoMode() {
  if (isDemoLoading.value) return;
  try {
    isDemoLoading.value = true;
    localError.value = null;

    const { user } = await signInAnonymously();

    if (user) {
      localStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETE, 'true');
      localStorage.setItem(STORAGE_KEYS.SELECTED_CURRENCY, DEFAULT_CURRENCY);
      router.push({ name: ROUTE_NAMES.DASHBOARD });
    }
  } catch (err) {
    console.error('Demo mode error:', err);
    if (err instanceof Error && err.message.includes('429')) {
      localError.value = 'Слишком много запросов. Попробуйте позже.';
    } else {
      localError.value = 'Не удалось запустить демо режим';
    }
  } finally {
    isDemoLoading.value = false;
  }
}
```

Replace with:

```ts
// Demo mode
const showDemoSetup = ref(false);

// Combined loading state - blocks all buttons when any action is in progress
const isAnyLoading = computed(() => isLoading.value || showDemoSetup.value);

function handleDemoMode() {
  if (showDemoSetup.value) return;
  localError.value = null;
  showDemoSetup.value = true;
}

function onDemoComplete() {
  showDemoSetup.value = false;
  localStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETE, 'true');
  localStorage.setItem(STORAGE_KEYS.SELECTED_CURRENCY, DEFAULT_CURRENCY);
  router.push({ name: ROUTE_NAMES.DASHBOARD });
}

function onDemoError(error: string) {
  showDemoSetup.value = false;
  localError.value = error;
}
```

Then update the demo button template — remove the inline SVG spinner and `isDemoLoading` references, replace with simpler version since loading is now handled by the overlay:

```vue
<button
  :disabled="isAnyLoading"
  class="group w-full flex items-center justify-between px-4 h-14 rounded-xl border border-primary/30 hover:border-primary/60 hover:bg-primary/5 transition-all duration-300 disabled:opacity-50 disabled:pointer-events-none"
  @click="handleDemoMode"
>
  <span class="flex items-center gap-3">
    <div
      class="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors duration-300"
    >
      <UIcon name="play_arrow" size="sm" />
    </div>
    <span
      class="text-text-primary-light dark:text-text-primary-dark font-bold text-base"
    >
      Попробовать демо
    </span>
  </span>
  <UIcon
    name="arrow_forward"
    size="sm"
    class="text-text-tertiary-light dark:text-text-tertiary-dark group-hover:text-primary transition-colors"
  />
</button>
```

Then add `<DemoSetupScreen>` right before the closing `</div>` of the root element:

```vue
    <!-- Demo Setup Overlay -->
    <DemoSetupScreen
      :visible="showDemoSetup"
      @complete="onDemoComplete"
      @error="onDemoError"
    />
  </div>
</template>
```

- [ ] **Step 3: Verify build**

Run: `cd frontend && bun run build 2>&1 | tail -10`
Expected: Build succeeds with no errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/auth/LoginPage.vue
git commit -m "feat(demo): integrate DemoSetupScreen into LoginPage

Replace button spinner with fullscreen stepper overlay for demo creation.
Demo API call now runs inside DemoSetupScreen in parallel with animated steps."
```

---

## Chunk 2: Changelog & Verification

### Task 4: Update changelog

**Files:**
- Modify: `frontend/src/features/changelog/model/changelogData.ts`

- [ ] **Step 1: Bump version and add entry**

Update `CURRENT_VERSION` from `'1.0.32'` to `'1.0.33'`.

Add at top of `CHANGELOG_ENTRIES` array:

```ts
{
  version: '1.0.33',
  date: '2026-03-13',
  title: 'Улучшение демо-режима',
  items: [
    {
      type: 'improvement',
      text: 'Новый экран подготовки демо с пошаговым прогрессом вместо простого спиннера',
    },
  ],
},
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/changelog/model/changelogData.ts
git commit -m "chore: bump version to 1.0.33, add demo setup screen changelog"
```

---

### Task 5: Final verification

- [ ] **Step 1: Run full type check**

Run: `cd frontend && bun run build`
Expected: Build succeeds

- [ ] **Step 2: Manual test**

Open `http://localhost:5173`, click "Попробовать демо":
- Fullscreen overlay appears immediately
- 4 steps animate with ~600ms intervals
- Progress bar fills smoothly
- After API response + all steps shown → redirects to dashboard
- Dark mode: verify colors match design tokens
