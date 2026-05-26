# Mobile (Expo) ↔ Frontend (Vue) Parity Closure — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close all P0 and P1 parity gaps identified in `docs/superpowers/specs/2026-05-26-mobile-vs-frontend-parity-audit-design.md`, so the Expo mobile app matches the Vue frontend feature-for-feature, modulo accepted native divergences (sheets, native tabs, push-via-Expo-Notifications, no PWA).

**Architecture:** Bottom-up dependency order — shared primitives first, then cross-cutting composables, then entities, then per-page features. Each task is a vertical slice: small enough to ship in one commit, complete enough to verify against the frontend reference. Native-iOS patterns (`Alert`, native sheets, push navigation in lieu of modals/master-detail) are preserved as-is; the goal is functional and behavioural parity, not pixel parity.

**Tech Stack:** Expo SDK 54 (Router v6, React 19, RN 0.85, new architecture), NativeWind v5 + Tailwind v4, TanStack Query, `@expo/ui`, Reanimated 4, react-native-css.

**References:**
- Spec: `docs/superpowers/specs/2026-05-26-mobile-vs-frontend-parity-audit-design.md`
- Source-of-truth code: `frontend/src/`
- Mobile target: `mobile/src/`
- Migration history: `docs/superpowers/plans/2026-05-25-vue-to-expo-migration.md`

**How to use this plan:**
- Tasks are grouped into 7 phases by dependency layer (UI primitives → composables → entities → blocking screens → dashboard sections → side features → polish).
- **Each phase MUST complete before the next** — later phases import earlier work.
- Within a phase, tasks can sometimes run in parallel (noted per-phase).
- Open questions from spec §8 are resolved inline as **Decision** blocks at the start of the relevant task. If the decision needs product input, the task is marked `BLOCKED-ON-DECISION` and skipped until resolved.
- "Reference" links in each task point to the canonical frontend implementation; read it before coding.

**TDD note:** Mobile currently has minimal test infrastructure. For each new shared/ui primitive or composable, add a `__tests__/<name>.test.tsx` with at least one render or behaviour test using `@testing-library/react-native`. For screens, smoke-test render + critical interaction. If the project test runner is not yet wired, the first task in Phase 1 adds it.

**Commit convention:** Mirror existing mobile commits — `feat(mobile): …`, `fix(mobile): …`, `chore(mobile): …`. Push to GitHub `origin` (per CLAUDE.md), never gitlab.

---

## Phase 0 — Plan Bootstrap

### Task 0.1: Confirm test runner

**Files:**
- Read: `mobile/package.json`
- Possibly modify: `mobile/package.json`, `mobile/jest.config.js` (or vitest config)

- [ ] **Step 1: Inspect mobile/package.json scripts**

```bash
grep -E '"test"|jest|vitest' mobile/package.json
```

- [ ] **Step 2: If no test script, install Jest + RNTL**

```bash
cd mobile
npm install --save-dev jest jest-expo @testing-library/react-native @testing-library/jest-native @types/jest
```

Add to `mobile/package.json`:

```json
{
  "scripts": {
    "test": "jest"
  },
  "jest": {
    "preset": "jest-expo",
    "setupFilesAfterEach": ["@testing-library/jest-native/extend-expect"]
  }
}
```

- [ ] **Step 3: Smoke test**

```bash
cd mobile && npm test -- --listTests | head
```

Expected: lists test files (or "no tests found" cleanly, not an error).

- [ ] **Step 4: Commit**

```bash
git add mobile/package.json mobile/package-lock.json
git commit -m "chore(mobile): wire jest-expo + RNTL for parity tests"
```

---

## Phase 1 — Shared/UI Primitives (blocking)

These primitives are imported by multiple later screens. Build them first or every later task ends up creating ad-hoc copies.

Tasks 1.1–1.8 can be done **in parallel** (no inter-dependencies) — assign one per subagent if using subagent-driven-development.

### Task 1.1: `Tabs` primitive

**Reference:** `frontend/src/shared/ui/tabs/UTabs.vue` (pills + underline variants with sliding indicator)

**Files:**
- Create: `mobile/src/shared/ui/tabs.tsx`
- Create: `mobile/src/shared/ui/__tests__/tabs.test.tsx`
- Modify: `mobile/src/shared/ui/index.ts` (export)

- [ ] **Step 1: Write the failing test**

```tsx
import { render, fireEvent } from '@testing-library/react-native';
import { Tabs } from '../tabs';

test('Tabs renders items and fires onChange on press', () => {
  const onChange = jest.fn();
  const { getByText } = render(
    <Tabs
      items={[
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ]}
      value="a"
      onChange={onChange}
    />,
  );
  fireEvent.press(getByText('B'));
  expect(onChange).toHaveBeenCalledWith('b');
});
```

- [ ] **Step 2: Run, expect fail (module not found)**

```bash
cd mobile && npm test -- tabs.test
```

- [ ] **Step 3: Implement**

```tsx
// mobile/src/shared/ui/tabs.tsx
import { Pressable, View, Text } from 'react-native';
import { cn } from '@/shared/lib/utils';

export type TabsItem<T extends string> = { id: T; label: string };

export type TabsProps<T extends string> = {
  items: TabsItem<T>[];
  value: T;
  onChange: (id: T) => void;
  variant?: 'pills' | 'underline';
};

export function Tabs<T extends string>({ items, value, onChange, variant = 'pills' }: TabsProps<T>) {
  return (
    <View className={cn('flex-row', variant === 'pills' ? 'gap-2 rounded-full bg-surface-light/40 p-1 dark:bg-surface-dark/40' : 'border-b border-border-light dark:border-border-dark')}>
      {items.map((item) => {
        const active = item.id === value;
        return (
          <Pressable
            key={item.id}
            onPress={() => onChange(item.id)}
            className={cn(
              'flex-1 items-center',
              variant === 'pills' ? cn('rounded-full px-4 py-2', active && 'bg-surface-light dark:bg-surface-dark') : cn('px-4 py-3', active && 'border-b-2 border-primary'),
            )}
          >
            <Text className={cn('text-sm font-medium', active ? 'text-primary' : 'text-content-secondary-light dark:text-content-secondary-dark')}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
```

- [ ] **Step 4: Run, expect pass**

```bash
cd mobile && npm test -- tabs.test
```

- [ ] **Step 5: Export and commit**

```ts
// mobile/src/shared/ui/index.ts (add)
export * from './tabs';
```

```bash
git add mobile/src/shared/ui/tabs.tsx mobile/src/shared/ui/__tests__/tabs.test.tsx mobile/src/shared/ui/index.ts
git commit -m "feat(mobile): add Tabs primitive (pills + underline)"
```

### Task 1.2: `SelectChips` primitive

**Reference:** `frontend/src/shared/ui/select-chips/SelectChips.vue` (single-select chip row, used by debts currency filter, history filters)

**Files:**
- Create: `mobile/src/shared/ui/select-chips.tsx`
- Create: `mobile/src/shared/ui/__tests__/select-chips.test.tsx`
- Modify: `mobile/src/shared/ui/index.ts`

- [ ] **Step 1: Write failing test**

```tsx
import { render, fireEvent } from '@testing-library/react-native';
import { SelectChips } from '../select-chips';

test('SelectChips fires onChange when chip pressed', () => {
  const onChange = jest.fn();
  const { getByText } = render(
    <SelectChips
      items={[{ id: 'usd', label: 'USD' }, { id: 'eur', label: 'EUR' }]}
      value="usd"
      onChange={onChange}
    />,
  );
  fireEvent.press(getByText('EUR'));
  expect(onChange).toHaveBeenCalledWith('eur');
});
```

- [ ] **Step 2: Run, expect fail**

```bash
cd mobile && npm test -- select-chips.test
```

- [ ] **Step 3: Implement**

```tsx
// mobile/src/shared/ui/select-chips.tsx
import { Pressable, ScrollView, Text } from 'react-native';
import { cn } from '@/shared/lib/utils';

export type SelectChipsItem<T extends string> = { id: T; label: string };

export type SelectChipsProps<T extends string> = {
  items: SelectChipsItem<T>[];
  value: T | null;
  onChange: (id: T | null) => void;
  allowDeselect?: boolean;
};

export function SelectChips<T extends string>({ items, value, onChange, allowDeselect = true }: SelectChipsProps<T>) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="flex-row gap-2 px-4">
      {items.map((item) => {
        const active = item.id === value;
        return (
          <Pressable
            key={item.id}
            onPress={() => onChange(active && allowDeselect ? null : item.id)}
            className={cn('rounded-full border px-4 py-2', active ? 'border-primary bg-primary' : 'border-border-light dark:border-border-dark')}
          >
            <Text className={cn('text-sm font-medium', active ? 'text-white' : 'text-content-primary-light dark:text-content-primary-dark')}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
```

- [ ] **Step 4: Run, expect pass**

```bash
cd mobile && npm test -- select-chips.test
```

- [ ] **Step 5: Export and commit**

```bash
git add mobile/src/shared/ui/select-chips.tsx mobile/src/shared/ui/__tests__/select-chips.test.tsx mobile/src/shared/ui/index.ts
git commit -m "feat(mobile): add SelectChips primitive"
```

### Task 1.3: `SectionHeader`

**Reference:** `frontend/src/shared/ui/section-header/SectionHeader.vue`

**Files:**
- Create: `mobile/src/shared/ui/section-header.tsx`
- Modify: `mobile/src/shared/ui/index.ts`

- [ ] **Step 1: Implement**

```tsx
// mobile/src/shared/ui/section-header.tsx
import { Pressable, Text, View } from 'react-native';

export type SectionHeaderProps = {
  title: string;
  action?: { label: string; onPress: () => void };
};

export function SectionHeader({ title, action }: SectionHeaderProps) {
  return (
    <View className="flex-row items-center justify-between px-4 pb-2 pt-4">
      <Text className="text-xs font-semibold uppercase tracking-wider text-content-secondary-light dark:text-content-secondary-dark">{title}</Text>
      {action ? (
        <Pressable onPress={action.onPress}>
          <Text className="text-sm font-medium text-primary">{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
```

- [ ] **Step 2: Export and commit**

```bash
git add mobile/src/shared/ui/section-header.tsx mobile/src/shared/ui/index.ts
git commit -m "feat(mobile): add SectionHeader primitive"
```

### Task 1.4: `EmptyState`

**Reference:** `frontend/src/shared/ui/empty-state/EmptyState.vue` (variants: default, inline)

**Files:**
- Create: `mobile/src/shared/ui/empty-state.tsx`
- Modify: `mobile/src/shared/ui/index.ts`

- [ ] **Step 1: Implement**

```tsx
// mobile/src/shared/ui/empty-state.tsx
import { Text, View } from 'react-native';
import { Icon } from './icon';

export type EmptyStateProps = {
  icon?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  variant?: 'default' | 'inline';
};

export function EmptyState({ icon = 'inbox', title, description, action, variant = 'default' }: EmptyStateProps) {
  return (
    <View className={variant === 'inline' ? 'items-center gap-2 py-6' : 'flex-1 items-center justify-center gap-3 px-8 py-16'}>
      <Icon name={icon} size={variant === 'inline' ? 28 : 48} className="text-content-tertiary-light dark:text-content-tertiary-dark" />
      <Text className="text-center text-base font-semibold text-content-primary-light dark:text-content-primary-dark">{title}</Text>
      {description ? (
        <Text className="text-center text-sm text-content-secondary-light dark:text-content-secondary-dark">{description}</Text>
      ) : null}
      {action ? <View className="mt-2">{action}</View> : null}
    </View>
  );
}
```

- [ ] **Step 2: Export and commit**

```bash
git add mobile/src/shared/ui/empty-state.tsx mobile/src/shared/ui/index.ts
git commit -m "feat(mobile): add EmptyState primitive"
```

### Task 1.5: `ProgressBar`

**Reference:** `frontend/src/shared/ui/progress-bar/UProgressBar.vue`

**Files:**
- Create: `mobile/src/shared/ui/progress-bar.tsx`
- Modify: `mobile/src/shared/ui/index.ts`

- [ ] **Step 1: Implement**

```tsx
// mobile/src/shared/ui/progress-bar.tsx
import { View } from 'react-native';
import { cn } from '@/shared/lib/utils';

export type ProgressBarProps = {
  value: number; // 0–1
  variant?: 'default' | 'success' | 'warning' | 'danger';
};

const COLOR: Record<NonNullable<ProgressBarProps['variant']>, string> = {
  default: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
};

export function ProgressBar({ value, variant = 'default' }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View className="h-2 w-full overflow-hidden rounded-full bg-surface-light dark:bg-surface-dark">
      <View className={cn('h-full', COLOR[variant])} style={{ width: `${pct * 100}%` }} />
    </View>
  );
}
```

- [ ] **Step 2: Export and commit**

```bash
git add mobile/src/shared/ui/progress-bar.tsx mobile/src/shared/ui/index.ts
git commit -m "feat(mobile): add ProgressBar primitive"
```

### Task 1.6: `InitialAvatar`

**Reference:** `frontend/src/shared/ui/initial-avatar/InitialAvatar.vue`

**Files:**
- Create: `mobile/src/shared/ui/initial-avatar.tsx`
- Modify: `mobile/src/shared/ui/index.ts`

- [ ] **Step 1: Implement**

```tsx
// mobile/src/shared/ui/initial-avatar.tsx
import { Text, View } from 'react-native';
import { cn } from '@/shared/lib/utils';

export type InitialAvatarProps = {
  name: string;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
};

const SIZE = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-14 w-14 text-base' };

export function InitialAvatar({ name, color = '#6B7280', size = 'md' }: InitialAvatarProps) {
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  return (
    <View className={cn('items-center justify-center rounded-full', SIZE[size].split(' ').slice(0, 2).join(' '))} style={{ backgroundColor: color }}>
      <Text className={cn('font-semibold text-white', SIZE[size].split(' ').slice(2).join(' '))}>{initial}</Text>
    </View>
  );
}
```

- [ ] **Step 2: Export and commit**

```bash
git add mobile/src/shared/ui/initial-avatar.tsx mobile/src/shared/ui/index.ts
git commit -m "feat(mobile): add InitialAvatar primitive"
```

### Task 1.7: `IconBadge` + `Badge`

**Reference:** `frontend/src/shared/ui/icon-badge/IconBadge.vue`, `frontend/src/shared/ui/badge/UBadge.vue`

**Files:**
- Create: `mobile/src/shared/ui/badge.tsx`
- Create: `mobile/src/shared/ui/icon-badge.tsx`
- Modify: `mobile/src/shared/ui/index.ts`

- [ ] **Step 1: Implement Badge**

```tsx
// mobile/src/shared/ui/badge.tsx
import { Text, View } from 'react-native';
import { cn } from '@/shared/lib/utils';

export type BadgeProps = { label: string; variant?: 'default' | 'success' | 'warning' | 'danger' };

const STYLES: Record<NonNullable<BadgeProps['variant']>, string> = {
  default: 'bg-surface-light dark:bg-surface-dark',
  success: 'bg-success/15',
  warning: 'bg-warning/15',
  danger: 'bg-danger/15',
};

const TEXT: Record<NonNullable<BadgeProps['variant']>, string> = {
  default: 'text-content-primary-light dark:text-content-primary-dark',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
};

export function Badge({ label, variant = 'default' }: BadgeProps) {
  return (
    <View className={cn('rounded-full px-2 py-0.5', STYLES[variant])}>
      <Text className={cn('text-xs font-medium', TEXT[variant])}>{label}</Text>
    </View>
  );
}
```

- [ ] **Step 2: Implement IconBadge**

```tsx
// mobile/src/shared/ui/icon-badge.tsx
import { View } from 'react-native';
import { cn } from '@/shared/lib/utils';
import { Icon } from './icon';

export type IconBadgeProps = { icon: string; color?: string; size?: 'sm' | 'md' | 'lg' };

const SIZE = { sm: 'h-8 w-8', md: 'h-10 w-10', lg: 'h-12 w-12' };
const ICON_SIZE = { sm: 16, md: 20, lg: 24 };

export function IconBadge({ icon, color = '#6B7280', size = 'md' }: IconBadgeProps) {
  return (
    <View className={cn('items-center justify-center rounded-full', SIZE[size])} style={{ backgroundColor: `${color}22` }}>
      <Icon name={icon} size={ICON_SIZE[size]} style={{ color }} />
    </View>
  );
}
```

- [ ] **Step 3: Export and commit**

```bash
git add mobile/src/shared/ui/badge.tsx mobile/src/shared/ui/icon-badge.tsx mobile/src/shared/ui/index.ts
git commit -m "feat(mobile): add Badge + IconBadge primitives"
```

### Task 1.8: `Toggle`

**Reference:** `frontend/src/shared/ui/toggle/UToggle.vue`

**Files:**
- Create: `mobile/src/shared/ui/toggle.tsx`
- Modify: `mobile/src/shared/ui/index.ts`

- [ ] **Step 1: Implement**

```tsx
// mobile/src/shared/ui/toggle.tsx
import { Switch } from 'react-native';

export type ToggleProps = {
  value: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
};

export function Toggle({ value, onChange, disabled }: ToggleProps) {
  return <Switch value={value} onValueChange={onChange} disabled={disabled} />;
}
```

- [ ] **Step 2: Export and commit**

```bash
git add mobile/src/shared/ui/toggle.tsx mobile/src/shared/ui/index.ts
git commit -m "feat(mobile): add Toggle primitive"
```

### Task 1.9: `ConfirmDeleteModal` (native `Alert` wrapper)

**Reference:** `frontend/src/shared/ui/confirm-delete-modal/ConfirmDeleteModal.vue`

Native pattern: instead of a modal component, expose a `confirmDelete()` helper that wraps `Alert.alert` with a destructive confirm button. This matches existing usage on mobile.

**Files:**
- Create: `mobile/src/shared/lib/confirm-delete.ts`
- Modify: `mobile/src/shared/lib/index.ts` (export)

- [ ] **Step 1: Implement**

```ts
// mobile/src/shared/lib/confirm-delete.ts
import { Alert } from 'react-native';

export function confirmDelete(opts: { title: string; message?: string; confirmLabel?: string }): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      opts.title,
      opts.message,
      [
        { text: 'Отмена', style: 'cancel', onPress: () => resolve(false) },
        { text: opts.confirmLabel ?? 'Удалить', style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add mobile/src/shared/lib/confirm-delete.ts
git commit -m "feat(mobile): confirmDelete native Alert wrapper"
```

---

## Phase 2 — Cross-Cutting Composables

These unblock multiple later screens. Tasks 2.1–2.6 can be parallelised.

### Task 2.1: `useToast` (mobile-native)

**Reference:** `frontend/src/shared/lib/composables/useToast.ts`

**Decision:** Use a global Zustand-like reactive store + a single `<Toaster />` mounted at the root of `_layout.tsx`. Non-blocking notification (≠ Alert, which is blocking). Match API signature: `toast({ title, description, variant, action })`.

**Files:**
- Create: `mobile/src/shared/lib/composables/useToast.ts`
- Create: `mobile/src/shared/ui/toaster.tsx`
- Modify: `mobile/src/app/_layout.tsx` (mount `<Toaster />`)

- [ ] **Step 1: Write store**

```ts
// mobile/src/shared/lib/composables/useToast.ts
import { useSyncExternalStore } from 'react';

export type ToastVariant = 'default' | 'success' | 'error' | 'warning';
export type ToastInput = { title: string; description?: string; variant?: ToastVariant; action?: { label: string; onClick: () => void }; durationMs?: number };
export type Toast = ToastInput & { id: string };

let toasts: Toast[] = [];
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export function toast(input: ToastInput) {
  const id = Math.random().toString(36).slice(2);
  toasts = [...toasts, { ...input, id }];
  notify();
  const duration = input.durationMs ?? 3500;
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    notify();
  }, duration);
}

export function dismissToast(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  notify();
}

export function useToasts(): Toast[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => toasts,
    () => toasts,
  );
}
```

- [ ] **Step 2: Implement `<Toaster />`**

```tsx
// mobile/src/shared/ui/toaster.tsx
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { cn } from '@/shared/lib/utils';
import { dismissToast, useToasts } from '@/shared/lib/composables/useToast';

const VARIANT: Record<string, string> = {
  default: 'bg-surface-light dark:bg-surface-dark',
  success: 'bg-success',
  error: 'bg-danger',
  warning: 'bg-warning',
};

export function Toaster() {
  const toasts = useToasts();
  if (toasts.length === 0) return null;
  return (
    <SafeAreaView pointerEvents="box-none" className="absolute inset-x-0 top-0 z-50 items-center">
      {toasts.map((t) => (
        <Pressable key={t.id} onPress={() => dismissToast(t.id)} className={cn('mx-4 mt-2 w-11/12 rounded-2xl px-4 py-3 shadow-lg', VARIANT[t.variant ?? 'default'])}>
          <Text className="text-sm font-semibold text-white">{t.title}</Text>
          {t.description ? <Text className="mt-0.5 text-sm text-white/90">{t.description}</Text> : null}
          {t.action ? (
            <Pressable onPress={t.action.onClick} className="mt-2 self-start rounded-full bg-white/20 px-3 py-1">
              <Text className="text-xs font-semibold text-white">{t.action.label}</Text>
            </Pressable>
          ) : null}
        </Pressable>
      ))}
    </SafeAreaView>
  );
}
```

- [ ] **Step 3: Mount in `_layout.tsx`**

In `mobile/src/app/_layout.tsx`, import `Toaster` and render it as a sibling of the existing `<Stack />` inside the providers.

- [ ] **Step 4: Test**

```tsx
// mobile/src/shared/lib/composables/__tests__/useToast.test.ts
import { toast, useToasts } from '../useToast';
import { renderHook, act } from '@testing-library/react-native';

test('toast appears then expires', async () => {
  jest.useFakeTimers();
  const { result } = renderHook(() => useToasts());
  expect(result.current).toHaveLength(0);
  act(() => toast({ title: 'hello', durationMs: 100 }));
  expect(result.current).toHaveLength(1);
  act(() => jest.advanceTimersByTime(150));
  expect(result.current).toHaveLength(0);
  jest.useRealTimers();
});
```

```bash
cd mobile && npm test -- useToast.test
```

- [ ] **Step 5: Commit**

```bash
git add mobile/src/shared/lib/composables/useToast.ts mobile/src/shared/ui/toaster.tsx mobile/src/app/_layout.tsx mobile/src/shared/lib/composables/__tests__/useToast.test.ts
git commit -m "feat(mobile): useToast + Toaster (non-blocking notifications)"
```

### Task 2.2: `useExchangeRates`

**Reference:** `frontend/src/shared/api/composables/useExchangeRates.ts`. Wraps `/api/exchange/rates` backend endpoint, caches for 24h.

**Files:**
- Create: `mobile/src/shared/api/composables/useExchangeRates.ts`
- Create: `mobile/src/shared/api/composables/__tests__/useExchangeRates.test.ts`

- [ ] **Step 1: Implement**

```ts
// mobile/src/shared/api/composables/useExchangeRates.ts
import { useQuery } from '@tanstack/react-query';
import { httpGet } from '@/shared/api/http';

export type Rates = Record<string, number>; // base = baseCurrency, value = rate-to-base
const ONE_DAY = 24 * 60 * 60 * 1000;

export function useExchangeRates(baseCurrency: string | null) {
  return useQuery({
    queryKey: ['exchange-rates', baseCurrency],
    queryFn: () => httpGet<Rates>(`/api/exchange/rates?base=${baseCurrency}`),
    enabled: !!baseCurrency,
    staleTime: ONE_DAY,
    gcTime: ONE_DAY,
  });
}

export function convert(amount: number, from: string, to: string, rates: Rates): number {
  if (from === to) return amount;
  const inBase = amount / (rates[from] ?? 1);
  return inBase * (rates[to] ?? 1);
}
```

- [ ] **Step 2: Test (mock httpGet)**

```ts
import { convert } from '../useExchangeRates';

test('convert USD→EUR', () => {
  const rates = { USD: 1, EUR: 0.9 };
  expect(convert(100, 'USD', 'EUR', rates)).toBeCloseTo(90);
});
```

```bash
cd mobile && npm test -- useExchangeRates.test
```

- [ ] **Step 3: Commit**

```bash
git add mobile/src/shared/api/composables/useExchangeRates.ts mobile/src/shared/api/composables/__tests__/useExchangeRates.test.ts
git commit -m "feat(mobile): useExchangeRates composable (24h cache)"
```

### Task 2.3: `useFinancialPeriod`

**Reference:** `frontend/src/shared/lib/composables/useFinancialPeriod.ts`. Resolves financial month boundaries from profile setting `financialMonthStartDay`.

**Files:**
- Create: `mobile/src/shared/lib/composables/useFinancialPeriod.ts`

- [ ] **Step 1: Implement (port the frontend logic 1:1; copy date math from frontend file)**

```ts
// mobile/src/shared/lib/composables/useFinancialPeriod.ts
import { useProfile } from '@/entities/profile/api/useProfile';
import { useUser } from '@/shared/api/composables/useUser';

export type FinancialPeriod = { startISO: string; endISO: string; startDay: number };

export function useFinancialPeriod(date: Date = new Date()): FinancialPeriod | null {
  const user = useUser();
  const { data: profile } = useProfile(user?.id ?? null);
  if (!profile) return null;
  const startDay = profile.financialMonthStartDay ?? 1;
  const d = new Date(date);
  const day = d.getDate();
  const start = new Date(d.getFullYear(), d.getMonth(), startDay);
  if (day < startDay) start.setMonth(start.getMonth() - 1);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  end.setDate(end.getDate() - 1);
  return { startISO: start.toISOString().slice(0, 10), endISO: end.toISOString().slice(0, 10), startDay };
}
```

- [ ] **Step 2: Commit**

```bash
git add mobile/src/shared/lib/composables/useFinancialPeriod.ts
git commit -m "feat(mobile): useFinancialPeriod composable"
```

### Task 2.4: `useUserCurrency`

**Reference:** `frontend/src/shared/lib/hooks/useUserCurrency.ts`

**Files:**
- Create: `mobile/src/shared/lib/composables/useUserCurrency.ts`

- [ ] **Step 1: Implement**

```ts
// mobile/src/shared/lib/composables/useUserCurrency.ts
import { DEFAULT_CURRENCY } from '@/entities/currency/model/constants';
import { useProfile } from '@/entities/profile/api/useProfile';
import { useUser } from '@/shared/api/composables/useUser';

export function useUserCurrency(): string {
  const user = useUser();
  const { data: profile } = useProfile(user?.id ?? null);
  return profile?.currency ?? DEFAULT_CURRENCY;
}
```

- [ ] **Step 2: Commit**

```bash
git add mobile/src/shared/lib/composables/useUserCurrency.ts
git commit -m "feat(mobile): useUserCurrency composable"
```

### Task 2.5: `usePremiumFeature`

**Reference:** `frontend/src/shared/lib/composables/usePremiumFeature.ts`. Singleton; gates premium features.

**Files:**
- Create: `mobile/src/shared/lib/composables/usePremiumFeature.ts`
- Modify: `mobile/src/app/_layout.tsx` (call `init()`)

- [ ] **Step 1: Implement**

```ts
// mobile/src/shared/lib/composables/usePremiumFeature.ts
import { useSyncExternalStore } from 'react';
import { useSubscription } from '@/entities/subscription/api/useSubscription';
import { useUser } from '@/shared/api/composables/useUser';

let upgradeRequest: { featureName: string } | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export function usePremiumFeature() {
  const user = useUser();
  const { data: subscription } = useSubscription(user?.id ?? null);
  const isPremium = subscription?.isPremium === true;

  const requirePremium = (featureName: string) => {
    if (isPremium) return true;
    upgradeRequest = { featureName };
    notify();
    return false;
  };

  const upgradeFor = useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => upgradeRequest,
    () => upgradeRequest,
  );

  const dismissUpgrade = () => { upgradeRequest = null; notify(); };

  return { isPremium, requirePremium, upgradeFor, dismissUpgrade };
}
```

- [ ] **Step 2: Wire in `_layout.tsx`**

Render `<PremiumUpgradeModal />` (existing in `features/upgrade-to-premium`) listening to `upgradeFor`.

- [ ] **Step 3: Commit**

```bash
git add mobile/src/shared/lib/composables/usePremiumFeature.ts mobile/src/app/_layout.tsx
git commit -m "feat(mobile): usePremiumFeature gate + global upgrade modal"
```

### Task 2.6: `format/pluralize` + `format/text::getInitial` + `format/greeting`

**Reference:** `frontend/src/shared/lib/format/pluralize.ts`, `text.ts`, `greeting.ts`

**Files:**
- Create: `mobile/src/shared/lib/format/pluralize.ts`
- Create: `mobile/src/shared/lib/format/text.ts`
- Create: `mobile/src/shared/lib/format/greeting.ts`
- Modify: `mobile/src/shared/lib/format/index.ts`

- [ ] **Step 1: Port verbatim from frontend (these are pure functions, copy contents exactly)**

```ts
// mobile/src/shared/lib/format/pluralize.ts
export function pluralize(count: number, forms: [string, string, string]): string {
  const n = Math.abs(count) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return forms[2];
  if (n1 > 1 && n1 < 5) return forms[1];
  if (n1 === 1) return forms[0];
  return forms[2];
}
```

```ts
// mobile/src/shared/lib/format/text.ts
export function getInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?';
}
```

```ts
// mobile/src/shared/lib/format/greeting.ts
export function getGreeting(hour: number = new Date().getHours()): string {
  if (hour < 6) return 'Доброй ночи';
  if (hour < 12) return 'Доброе утро';
  if (hour < 18) return 'Добрый день';
  return 'Добрый вечер';
}
```

- [ ] **Step 2: Commit**

```bash
git add mobile/src/shared/lib/format/pluralize.ts mobile/src/shared/lib/format/text.ts mobile/src/shared/lib/format/greeting.ts mobile/src/shared/lib/format/index.ts
git commit -m "feat(mobile): port pluralize/getInitial/getGreeting utilities"
```

---

## Phase 3 — Entity API Composables (gaps)

### Task 3.1: `useEditAccount` mutation

**Reference:** `frontend/src/features/edit-account/composables/useEditAccount.ts`, `frontend/src/entities/account/api/useAccounts.ts` mutation chunk

**Files:**
- Modify: `mobile/src/entities/account/api/useAccounts.ts`

- [ ] **Step 1: Add mutation hook**

```ts
// mobile/src/entities/account/api/useAccounts.ts (append)
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { httpPatch } from '@/shared/api/http';

export type EditAccountPayload = { name?: string; icon?: string; color?: string; currency?: string; type?: string };

export function useEditAccount(userId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: EditAccountPayload }) =>
      httpPatch(`/api/accounts/${id}`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounts', userId] });
      qc.invalidateQueries({ queryKey: ['account-balances', userId] });
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add mobile/src/entities/account/api/useAccounts.ts
git commit -m "feat(mobile): useEditAccount mutation"
```

### Task 3.2: `useDeleteAccount` mutation

**Files:**
- Modify: `mobile/src/entities/account/api/useAccounts.ts`

- [ ] **Step 1: Add mutation**

```ts
import { httpDelete } from '@/shared/api/http';

export function useDeleteAccount(userId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => httpDelete(`/api/accounts/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounts', userId] });
      qc.invalidateQueries({ queryKey: ['account-balances', userId] });
      qc.invalidateQueries({ queryKey: ['transactions', userId] });
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git commit -am "feat(mobile): useDeleteAccount mutation"
```

### Task 3.3: `useReorderAccounts`

**Reference:** Frontend uses `vuedraggable` — mobile will use long-press drag via `react-native-draggable-flatlist`.

**Files:**
- Modify: `mobile/src/entities/account/api/useAccounts.ts`

- [ ] **Step 1: Add mutation**

```ts
export function useReorderAccounts(userId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderedIds: string[]) => httpPatch(`/api/accounts/reorder`, { orderedIds }),
    onMutate: async (orderedIds) => {
      await qc.cancelQueries({ queryKey: ['accounts', userId] });
      const prev = qc.getQueryData(['accounts', userId]);
      qc.setQueryData(['accounts', userId], (old: any) =>
        Array.isArray(old) ? orderedIds.map((id) => old.find((a: any) => a.id === id)).filter(Boolean) : old,
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(['accounts', userId], ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: ['accounts', userId] }),
  });
}
```

- [ ] **Step 2: Commit**

```bash
git commit -am "feat(mobile): useReorderAccounts with optimistic update"
```

### Task 3.4: `useTransactionEditFlow`

**Reference:** `frontend/src/features/edit-transaction/composables/useTransactionEditFlow.ts`

**Files:**
- Create: `mobile/src/features/edit-transaction/composables/useTransactionEditFlow.ts`

- [ ] **Step 1: Implement**

```ts
// mobile/src/features/edit-transaction/composables/useTransactionEditFlow.ts
import { useState } from 'react';
import type { Transaction } from '@/entities/transaction/model/types';

export function useTransactionEditFlow() {
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState<Transaction | null>(null);
  return {
    editing, deleting,
    openEdit: (t: Transaction) => setEditing(t),
    closeEdit: () => setEditing(null),
    openDelete: (t: Transaction) => setDeleting(t),
    closeDelete: () => setDeleting(null),
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add mobile/src/features/edit-transaction/composables/useTransactionEditFlow.ts
git commit -m "feat(mobile): useTransactionEditFlow"
```

### Task 3.5: `useServerSearch` for transactions

**Reference:** `frontend/src/features/search-transactions/composables/useServerSearch.ts`

**Files:**
- Create: `mobile/src/features/search-transactions/composables/useServerSearch.ts`

- [ ] **Step 1: Implement (debounced infinite query)**

```ts
// mobile/src/features/search-transactions/composables/useServerSearch.ts
import { useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { httpGet } from '@/shared/api/http';
import type { Transaction } from '@/entities/transaction/model/types';

const PAGE_SIZE = 20;

export function useServerSearch(userId: string | null, query: string) {
  const [debounced, setDebounced] = useState(query);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  return useInfiniteQuery({
    queryKey: ['transactions', 'search', userId, debounced],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      httpGet<{ items: Transaction[]; nextCursor: string | null }>(
        `/api/transactions/search?q=${encodeURIComponent(debounced)}&pageSize=${PAGE_SIZE}${pageParam ? `&cursor=${pageParam}` : ''}`,
      ),
    getNextPageParam: (last) => last.nextCursor,
    enabled: !!userId && debounced.trim().length > 0,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add mobile/src/features/search-transactions/composables/useServerSearch.ts
git commit -m "feat(mobile): useServerSearch (debounced infinite query)"
```

### Task 3.6: `useDebtTransactions`

**Reference:** `frontend/src/entities/debt/api/useDebtTransactions.ts`

**Files:**
- Create: `mobile/src/entities/debt/api/useDebtTransactions.ts`

- [ ] **Step 1: Implement**

```ts
import { useQuery } from '@tanstack/react-query';
import { httpGet } from '@/shared/api/http';
import type { Transaction } from '@/entities/transaction/model/types';

export function useDebtTransactions(debtId: string | null) {
  return useQuery({
    queryKey: ['debt-transactions', debtId],
    queryFn: () => httpGet<Transaction[]>(`/api/debts/${debtId}/transactions`),
    enabled: !!debtId,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add mobile/src/entities/debt/api/useDebtTransactions.ts
git commit -m "feat(mobile): useDebtTransactions"
```

### Task 3.7: `useCloseDebt` + `usePartialPayment`

**Reference:** `frontend/src/features/close-debt/composables/useCloseDebt.ts`, `frontend/src/features/partial-payment/composables/usePartialPayment.ts`

**Files:**
- Create: `mobile/src/features/close-debt/composables/useCloseDebt.ts`
- Create: `mobile/src/features/partial-payment/composables/usePartialPayment.ts`

- [ ] **Step 1: Implement useCloseDebt**

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { httpPost } from '@/shared/api/http';

export function useCloseDebt(userId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ debtId, accountId }: { debtId: string; accountId: string }) =>
      httpPost(`/api/debts/${debtId}/close`, { accountId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['debts', userId] });
      qc.invalidateQueries({ queryKey: ['transactions', userId] });
      qc.invalidateQueries({ queryKey: ['accounts', userId] });
    },
  });
}
```

- [ ] **Step 2: Implement usePartialPayment**

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { httpPost } from '@/shared/api/http';

export function usePartialPayment(userId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ debtId, amount, accountId }: { debtId: string; amount: number; accountId: string }) =>
      httpPost(`/api/debts/${debtId}/partial-payment`, { amount, accountId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['debts', userId] });
      qc.invalidateQueries({ queryKey: ['transactions', userId] });
      qc.invalidateQueries({ queryKey: ['accounts', userId] });
    },
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add mobile/src/features/close-debt mobile/src/features/partial-payment
git commit -m "feat(mobile): useCloseDebt + usePartialPayment mutations"
```

### Task 3.8: `useManageCategories`

**Reference:** `frontend/src/features/manage-categories/composables/useManageCategories.ts`

**Files:**
- Create: `mobile/src/features/manage-categories/composables/useManageCategories.ts`

- [ ] **Step 1: Implement CRUD + reorder**

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { httpPost, httpPatch, httpDelete } from '@/shared/api/http';

export type CategoryInput = { name: string; icon: string; color: string; type: 'expense' | 'income' };

export function useManageCategories(userId: string | null) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['categories', userId] });

  const create = useMutation({ mutationFn: (input: CategoryInput) => httpPost('/api/categories', input), onSuccess: invalidate });
  const update = useMutation({ mutationFn: ({ id, input }: { id: string; input: Partial<CategoryInput> }) => httpPatch(`/api/categories/${id}`, input), onSuccess: invalidate });
  const remove = useMutation({ mutationFn: (id: string) => httpDelete(`/api/categories/${id}`), onSuccess: invalidate });
  const reorder = useMutation({ mutationFn: ({ type, orderedIds }: { type: 'expense' | 'income'; orderedIds: string[] }) => httpPatch('/api/categories/reorder', { type, orderedIds }), onSuccess: invalidate });

  return { create, update, remove, reorder };
}
```

- [ ] **Step 2: Commit**

```bash
git add mobile/src/features/manage-categories/composables/useManageCategories.ts
git commit -m "feat(mobile): useManageCategories CRUD + reorder"
```

### Task 3.9: `useRecurringSubscriptions` + create/edit

**Reference:** `frontend/src/entities/recurring-subscription/api/`

**Files:**
- Modify: `mobile/src/entities/recurring-subscription/api/index.ts`

- [ ] **Step 1: Implement**

```ts
// mobile/src/entities/recurring-subscription/api/useRecurringSubscriptions.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { httpGet, httpPost, httpPatch, httpDelete } from '@/shared/api/http';
import type { RecurringSubscription, RecurringSubscriptionInsert } from '../model/types';

export function useRecurringSubscriptions(userId: string | null) {
  return useQuery({
    queryKey: ['recurring-subscriptions', userId],
    queryFn: () => httpGet<RecurringSubscription[]>(`/api/recurring-subscriptions?userId=${userId}`),
    enabled: !!userId,
  });
}

export function useCreateRecurringSubscription(userId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RecurringSubscriptionInsert) => httpPost<RecurringSubscription>('/api/recurring-subscriptions', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recurring-subscriptions', userId] }),
  });
}

export function useUpdateRecurringSubscription(userId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<RecurringSubscriptionInsert> }) => httpPatch(`/api/recurring-subscriptions/${id}`, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recurring-subscriptions', userId] }),
  });
}

export function useDeleteRecurringSubscription(userId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => httpDelete(`/api/recurring-subscriptions/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recurring-subscriptions', userId] }),
  });
}

export function daysUntilBilling(sub: RecurringSubscription, now: Date = new Date()): number {
  const next = new Date(sub.nextBillingDate);
  const ms = next.getTime() - now.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}
```

- [ ] **Step 2: Commit**

```bash
git add mobile/src/entities/recurring-subscription/api
git commit -m "feat(mobile): recurring-subscriptions entity API"
```

### Task 3.10: `useBudget` entity

**Reference:** `frontend/src/entities/budget/api/useBudget.ts`

**Files:**
- Create: `mobile/src/entities/budget/api/useBudget.ts`

- [ ] **Step 1: Implement**

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { httpGet, httpPut } from '@/shared/api/http';

export type Budget = { id: string; amount: number; currency: string; startDate: string; endDate: string };

export function useBudget(userId: string | null) {
  return useQuery({
    queryKey: ['budget', userId],
    queryFn: () => httpGet<Budget | null>(`/api/budget?userId=${userId}`),
    enabled: !!userId,
  });
}

export function useSetBudget(userId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { amount: number; currency: string }) => httpPut<Budget>('/api/budget', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['budget', userId] }),
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add mobile/src/entities/budget/api/useBudget.ts
git commit -m "feat(mobile): useBudget + useSetBudget"
```

### Task 3.11: `usePeople` entity (CRUD)

**Reference:** `frontend/src/entities/person/api/usePeople.ts`

**Files:**
- Create: `mobile/src/entities/person/api/usePeople.ts`

- [ ] **Step 1: Implement**

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { httpGet, httpPost, httpPatch, httpDelete } from '@/shared/api/http';
import type { Person } from '../model/types';

export function usePeople(userId: string | null) {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ['people', userId],
    queryFn: () => httpGet<Person[]>(`/api/people?userId=${userId}`),
    enabled: !!userId,
  });
  const create = useMutation({
    mutationFn: (input: { name: string; color: string }) => httpPost<Person>('/api/people', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['people', userId] }),
  });
  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<{ name: string; color: string }> }) => httpPatch(`/api/people/${id}`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['people', userId] }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => httpDelete(`/api/people/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['people', userId] }),
  });
  return { list, create, update, remove };
}
```

- [ ] **Step 2: Commit**

```bash
git add mobile/src/entities/person/api/usePeople.ts
git commit -m "feat(mobile): usePeople CRUD"
```

### Task 3.12: `useQuickActions` entity

**Reference:** `frontend/src/entities/quick-action/api/useQuickActions.ts`

**Files:**
- Create: `mobile/src/entities/quick-action/api/useQuickActions.ts`

- [ ] **Step 1: Implement (port logic verbatim)**

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { httpGet, httpPut } from '@/shared/api/http';

export type QuickAction = { slot: number; type: 'income' | 'expense'; accountId: string; categoryId: string };
export const MAX_SLOTS = 4;

export function useQuickActions(userId: string | null) {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ['quick-actions', userId],
    queryFn: () => httpGet<QuickAction[]>(`/api/quick-actions?userId=${userId}`),
    enabled: !!userId,
  });
  const setSlot = useMutation({
    mutationFn: (input: QuickAction) => httpPut('/api/quick-actions', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quick-actions', userId] }),
  });
  return { list, setSlot };
}
```

- [ ] **Step 2: Commit**

```bash
git add mobile/src/entities/quick-action/api/useQuickActions.ts
git commit -m "feat(mobile): useQuickActions"
```

### Task 3.13: `useChangelog`

**Reference:** `frontend/src/features/changelog/composables/useChangelog.ts` + `model/changelogData.ts`

**Files:**
- Create: `mobile/src/features/changelog/model/changelogData.ts` (copy from frontend)
- Create: `mobile/src/features/changelog/composables/useChangelog.ts`

- [ ] **Step 1: Copy changelog data**

```bash
cp frontend/src/features/changelog/model/changelogData.ts mobile/src/features/changelog/model/changelogData.ts
```

- [ ] **Step 2: Implement hook**

```ts
// mobile/src/features/changelog/composables/useChangelog.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { CHANGELOG_ENTRIES, CURRENT_VERSION } from '../model/changelogData';

const STORAGE_KEY = 'changelog-last-seen-version';

export function useChangelog() {
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  useEffect(() => { AsyncStorage.getItem(STORAGE_KEY).then(setLastSeen); }, []);
  const hasUnseen = lastSeen !== null && lastSeen !== CURRENT_VERSION;
  const markSeen = async () => { await AsyncStorage.setItem(STORAGE_KEY, CURRENT_VERSION); setLastSeen(CURRENT_VERSION); };
  return { entries: CHANGELOG_ENTRIES, currentVersion: CURRENT_VERSION, hasUnseen, markSeen };
}
```

- [ ] **Step 3: Commit**

```bash
git add mobile/src/features/changelog
git commit -m "feat(mobile): useChangelog + data port"
```

---

## Phase 4 — People + Split-Expense + Scan-Receipt step-3 unlock

People is a hard dependency for split-expense and scan-receipt step 3. Build the screen + form first.

### Task 4.1: `PeopleListScreen`

**Reference:** `frontend/src/pages/people/PeopleListPage.vue`

**Files:**
- Create: `mobile/src/app/people/index.tsx`
- Create: `mobile/src/features/manage-people/components/PersonForm.tsx`

- [ ] **Step 1: Screen**

```tsx
// mobile/src/app/people/index.tsx
import { useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { usePeople } from '@/entities/person/api/usePeople';
import { useUser } from '@/shared/api/composables/useUser';
import { InitialAvatar } from '@/shared/ui/initial-avatar';
import { EmptyState } from '@/shared/ui/empty-state';
import { Button } from '@/shared/ui/button';
import { SwipeableRow } from '@/shared/ui/swipeable-row';
import { confirmDelete } from '@/shared/lib/confirm-delete';
import { PersonForm } from '@/features/manage-people/components/PersonForm';

export default function PeopleScreen() {
  const user = useUser();
  const { list, remove } = usePeople(user?.id ?? null);
  const [showForm, setShowForm] = useState<{ mode: 'create' } | { mode: 'edit'; person: any } | null>(null);
  return (
    <View className="flex-1 bg-background-light dark:bg-background-dark">
      <Stack.Screen options={{ title: 'Люди' }} />
      <FlatList
        data={list.data ?? []}
        keyExtractor={(p) => p.id}
        ListEmptyComponent={<EmptyState icon="users" title="Пока никого нет" description="Добавьте людей для совместных расходов и долгов" />}
        renderItem={({ item }) => (
          <SwipeableRow onDelete={async () => { if (await confirmDelete({ title: `Удалить ${item.name}?` })) remove.mutate(item.id); }}>
            <Pressable onPress={() => setShowForm({ mode: 'edit', person: item })} className="flex-row items-center gap-3 bg-surface-light px-4 py-3 dark:bg-surface-dark">
              <InitialAvatar name={item.name} color={item.color} />
              <Text className="text-base font-medium text-content-primary-light dark:text-content-primary-dark">{item.name}</Text>
            </Pressable>
          </SwipeableRow>
        )}
      />
      <View className="px-4 pb-8 pt-2">
        <Button onPress={() => setShowForm({ mode: 'create' })}>Добавить человека</Button>
      </View>
      {showForm && <PersonForm initial={showForm.mode === 'edit' ? showForm.person : undefined} onClose={() => setShowForm(null)} />}
    </View>
  );
}
```

- [ ] **Step 2: PersonForm**

```tsx
// mobile/src/features/manage-people/components/PersonForm.tsx
import { useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';
import { usePeople } from '@/entities/person/api/usePeople';
import { useUser } from '@/shared/api/composables/useUser';
import { ENTITY_COLORS } from '@/shared/config/colors';
import { Button } from '@/shared/ui/button';

export function PersonForm({ initial, onClose }: { initial?: { id: string; name: string; color: string }; onClose: () => void }) {
  const user = useUser();
  const { create, update } = usePeople(user?.id ?? null);
  const [name, setName] = useState(initial?.name ?? '');
  const [color, setColor] = useState(initial?.color ?? ENTITY_COLORS[0]);

  const submit = async () => {
    if (initial) await update.mutateAsync({ id: initial.id, input: { name, color } });
    else await create.mutateAsync({ name, color });
    onClose();
  };

  return (
    <Modal animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <View className="flex-1 gap-4 bg-background-light p-4 dark:bg-background-dark">
        <Text className="text-lg font-semibold">{initial ? 'Изменить' : 'Новый человек'}</Text>
        <TextInput value={name} onChangeText={setName} placeholder="Имя" className="rounded-2xl bg-surface-light px-4 py-3 dark:bg-surface-dark" />
        <View className="flex-row flex-wrap gap-2">
          {ENTITY_COLORS.map((c) => (
            <Pressable key={c} onPress={() => setColor(c)} className="h-10 w-10 rounded-full border-2" style={{ backgroundColor: c, borderColor: c === color ? '#000' : 'transparent' }} />
          ))}
        </View>
        <Button onPress={submit} disabled={!name.trim()}>Сохранить</Button>
        <Button variant="ghost" onPress={onClose}>Отмена</Button>
      </View>
    </Modal>
  );
}
```

- [ ] **Step 3: Add `ENTITY_COLORS` to mobile config**

```ts
// mobile/src/shared/config/colors.ts (port from frontend)
export const ENTITY_COLORS = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#6B7280'];
```

- [ ] **Step 4: Commit**

```bash
git add mobile/src/app/people mobile/src/features/manage-people mobile/src/shared/config/colors.ts
git commit -m "feat(mobile): people screen + PersonForm"
```

### Task 4.2: `useSplitExpense` + split UI in TransactionForm

**Reference:** `frontend/src/features/split-expense/`

**Files:**
- Create: `mobile/src/features/split-expense/composables/useSplitExpense.ts`
- Create: `mobile/src/features/split-expense/components/SplitParticipants.tsx`
- Modify: `mobile/src/features/add-transaction/components/TransactionForm.tsx` (mount split section when expense type)

- [ ] **Step 1: Implement composable**

```ts
// mobile/src/features/split-expense/composables/useSplitExpense.ts
import { useState } from 'react';

export type SplitParticipant = { personId: string; share: number };

export function useSplitExpense() {
  const [enabled, setEnabled] = useState(false);
  const [participants, setParticipants] = useState<SplitParticipant[]>([]);
  return {
    enabled, setEnabled,
    participants, setParticipants,
    add: (personId: string) => setParticipants((p) => [...p, { personId, share: 0 }]),
    remove: (personId: string) => setParticipants((p) => p.filter((x) => x.personId !== personId)),
    setShare: (personId: string, share: number) =>
      setParticipants((p) => p.map((x) => (x.personId === personId ? { ...x, share } : x))),
  };
}
```

- [ ] **Step 2: SplitParticipants UI**

```tsx
// mobile/src/features/split-expense/components/SplitParticipants.tsx
import { Pressable, Text, TextInput, View } from 'react-native';
import { usePeople } from '@/entities/person/api/usePeople';
import { useUser } from '@/shared/api/composables/useUser';
import type { SplitParticipant } from '../composables/useSplitExpense';

type Props = {
  participants: SplitParticipant[];
  totalAmount: number;
  onAdd: (personId: string) => void;
  onRemove: (personId: string) => void;
  onShareChange: (personId: string, share: number) => void;
};

export function SplitParticipants({ participants, totalAmount, onAdd, onRemove, onShareChange }: Props) {
  const user = useUser();
  const { list } = usePeople(user?.id ?? null);
  return (
    <View className="gap-2">
      <Text className="text-sm font-medium">Разделить с</Text>
      {(list.data ?? []).map((p) => {
        const part = participants.find((x) => x.personId === p.id);
        return (
          <View key={p.id} className="flex-row items-center gap-2">
            <Pressable onPress={() => (part ? onRemove(p.id) : onAdd(p.id))} className="flex-1 rounded-2xl bg-surface-light p-3 dark:bg-surface-dark">
              <Text>{p.name}{part ? ' ✓' : ''}</Text>
            </Pressable>
            {part ? (
              <TextInput
                value={String(part.share)}
                onChangeText={(t) => onShareChange(p.id, Number(t) || 0)}
                keyboardType="numeric"
                className="w-24 rounded-2xl bg-surface-light p-3 text-right dark:bg-surface-dark"
              />
            ) : null}
          </View>
        );
      })}
      <Text className="text-xs text-content-secondary-light dark:text-content-secondary-dark">
        Сумма к разделу: {participants.reduce((s, p) => s + p.share, 0)} из {totalAmount}
      </Text>
    </View>
  );
}
```

- [ ] **Step 3: Mount in TransactionForm**

Add a Toggle ("Разделить расход") in `TransactionForm.tsx` (expense mode only); when on, render `<SplitParticipants ... />` and on submit, after creating the transaction, call the `/api/debts/split` endpoint with the participants list. Mirror exactly the frontend's `useSubmitTransaction` + `useSplitExpense` orchestration (transaction first, then debts).

- [ ] **Step 4: Commit**

```bash
git add mobile/src/features/split-expense mobile/src/features/add-transaction
git commit -m "feat(mobile): split expense flow"
```

### Task 4.3: Scan-receipt step 3 (assign participants)

**Reference:** `frontend/src/features/scan-receipt/components/Step3AssignParticipants.vue`

**Files:**
- Modify: `mobile/src/features/scan-receipt/components/Step3AssignParticipants.tsx`

- [ ] **Step 1: Implement step 3**

Iterate over receipt items, allow assigning a list of personIds to each item. Use `usePeople(userId)` for the picker. On final submit, the wizard generates one transaction + N debts (same as frontend behaviour).

- [ ] **Step 2: Commit**

```bash
git add mobile/src/features/scan-receipt
git commit -m "feat(mobile): scan-receipt step 3 (assign participants)"
```

---

## Phase 5 — History / Transactions parity

### Task 5.1: History filters (type tabs + account selector + category chips + search)

**Reference:** `frontend/src/pages/history/HistoryPage.vue`, `frontend/src/features/search-transactions/`, `frontend/src/features/analytics-filters/components/FilterChips.vue`

**Files:**
- Modify: `mobile/src/app/(tabs)/history.tsx`
- Create: `mobile/src/features/search-transactions/components/SearchInput.tsx`
- Create: `mobile/src/features/transaction-filters/composables/useHistoryFilters.ts`

- [ ] **Step 1: Implement `useHistoryFilters`**

```ts
// mobile/src/features/transaction-filters/composables/useHistoryFilters.ts
import { useState } from 'react';

export type TransactionTypeFilter = 'all' | 'income' | 'expense';

export function useHistoryFilters() {
  const [type, setType] = useState<TransactionTypeFilter>('all');
  const [accountIds, setAccountIds] = useState<string[]>([]);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  return { type, setType, accountIds, setAccountIds, categoryIds, setCategoryIds, query, setQuery };
}
```

- [ ] **Step 2: Implement SearchInput**

```tsx
// mobile/src/features/search-transactions/components/SearchInput.tsx
import { TextInput, View } from 'react-native';
import { Icon } from '@/shared/ui/icon';

export function SearchInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <View className="m-4 flex-row items-center gap-2 rounded-2xl bg-surface-light px-4 py-2 dark:bg-surface-dark">
      <Icon name="search" size={18} />
      <TextInput value={value} onChangeText={onChange} placeholder="Поиск" className="flex-1 text-base" />
    </View>
  );
}
```

- [ ] **Step 3: Wire into history screen**

In `(tabs)/history.tsx`, add at the top:
- `<SearchInput value={query} onChange={setQuery} />`
- `<Tabs items={[{id:'all',label:'Все'},{id:'income',label:'Доходы'},{id:'expense',label:'Расходы'}]} value={type} onChange={setType} />`
- A horizontal `<SelectChips />` of accounts (use `useAccounts`).

When `query.trim().length > 0`, switch query source from `useInfiniteTransactions` to `useServerSearch`.

- [ ] **Step 4: Commit**

```bash
git add mobile/src/app/(tabs)/history.tsx mobile/src/features/search-transactions mobile/src/features/transaction-filters
git commit -m "feat(mobile): history filters + search"
```

### Task 5.2: Edit transaction flow on history

**Files:**
- Modify: `mobile/src/app/(tabs)/history.tsx`
- Create: `mobile/src/features/edit-transaction/components/EditTransactionSheet.tsx`

- [ ] **Step 1: Implement edit sheet**

A `formSheet`-style screen reusing `TransactionForm` populated from the row's transaction. Submitting calls `/api/transactions/:id` PATCH; on success invalidate transactions + account balances.

- [ ] **Step 2: Wire**

In history `renderItem`, wrap with a long-press handler that opens the edit sheet. Use `useTransactionEditFlow` from Task 3.4.

- [ ] **Step 3: Commit**

```bash
git add mobile/src/app/(tabs)/history.tsx mobile/src/features/edit-transaction
git commit -m "feat(mobile): edit transaction from history"
```

---

## Phase 6 — Debts list parity

### Task 6.1: Direction tabs + currency filter + open/closed sections

**Reference:** `frontend/src/pages/debts/list/DebtsListPage.vue`

**Files:**
- Modify: `mobile/src/app/debts/index.tsx`
- Create: `mobile/src/features/debts-filters/composables/useDebtsPageState.ts`

- [ ] **Step 1: Implement `useDebtsPageState`**

```ts
// mobile/src/features/debts-filters/composables/useDebtsPageState.ts
import { useState } from 'react';

export type DebtDirection = 'all' | 'owed_to_me' | 'i_owe';

export function useDebtsPageState() {
  const [direction, setDirection] = useState<DebtDirection>('all');
  const [currency, setCurrency] = useState<string | null>(null);
  const [showClosed, setShowClosed] = useState(false);
  return { direction, setDirection, currency, setCurrency, showClosed, setShowClosed };
}
```

- [ ] **Step 2: Render filters above SectionList**

In `debts/index.tsx`:
- `<Tabs items={[{id:'all',label:'Все'},{id:'owed_to_me',label:'Мне должны'},{id:'i_owe',label:'Я должен'}]} value={direction} onChange={setDirection} />`
- `<SelectChips items={CURRENCIES.map(c=>({id:c.code,label:c.code}))} value={currency} onChange={setCurrency} />`
- A toggle (`<Toggle />`) "Показывать закрытые" below.

Pass these filters to `useInfiniteDebts({ direction, currency, includeClosed })`. Add server-side filter params to `useInfiniteDebts` if not present (mirror frontend's params).

- [ ] **Step 3: Commit**

```bash
git add mobile/src/app/debts/index.tsx mobile/src/features/debts-filters mobile/src/entities/debt/api
git commit -m "feat(mobile): debts list filters + sections"
```

### Task 6.2: Close-all-debts + partial-payment from list

**Files:**
- Create: `mobile/src/app/debts/[id]/close.tsx`
- Create: `mobile/src/app/debts/[id]/partial-pay.tsx`
- Create: `mobile/src/app/debts/close-all.tsx`

- [ ] **Step 1: `[id]/close.tsx`** — uses `useCloseDebt` from Task 3.7. Account picker + confirm.
- [ ] **Step 2: `[id]/partial-pay.tsx`** — uses `usePartialPayment`. Amount input + account picker + confirm.
- [ ] **Step 3: `close-all.tsx`** — bulk close: list debts grouped by currency, allow toggle which to close, then call `/api/debts/close-batch`.
- [ ] **Step 4: Commit**

```bash
git add mobile/src/app/debts
git commit -m "feat(mobile): close + partial-pay + close-all debts screens"
```

### Task 6.3: `/debts/[id]/edit` screen

**Files:**
- Create: `mobile/src/app/debts/[id]/edit.tsx`
- Create: `mobile/src/features/edit-debt/components/DebtForm.tsx`

- [ ] **Step 1: Reuse `create-debt` form components, prefilled.**
- [ ] **Step 2: Commit**

```bash
git add mobile/src/app/debts mobile/src/features/edit-debt
git commit -m "feat(mobile): edit debt screen"
```

### Task 6.4: Debt detail content (transactions + progress)

**Reference:** `frontend/src/pages/debts/detail/DebtDetailContent.vue`

**Files:**
- Modify: `mobile/src/app/debts/[id]/index.tsx`

- [ ] **Step 1: Add debt transactions list (`useDebtTransactions` from Task 3.6) + `ProgressBar` for partial-paid amount.**
- [ ] **Step 2: Commit**

```bash
git add mobile/src/app/debts/[id]/index.tsx
git commit -m "feat(mobile): debt detail transactions + progress"
```

---

## Phase 7 — Analytics parity

### Task 7.1: Period navigation header

**Reference:** `frontend/src/widgets/analytics/SwipeablePeriodHeader.vue`, `frontend/src/pages/analytics/composables/usePeriodNavigation.ts`

**Files:**
- Create: `mobile/src/widgets/analytics/PeriodHeader.tsx`
- Create: `mobile/src/widgets/analytics/composables/usePeriodNavigation.ts`

- [ ] **Step 1: `usePeriodNavigation`**

```ts
// mobile/src/widgets/analytics/composables/usePeriodNavigation.ts
import { useState } from 'react';
import { useFinancialPeriod } from '@/shared/lib/composables/useFinancialPeriod';

export type Scale = 'day' | 'week' | 'month' | 'year';

export function usePeriodNavigation(initialScale: Scale = 'month') {
  const [scale, setScale] = useState<Scale>(initialScale);
  const [anchor, setAnchor] = useState<Date>(new Date());
  const financial = useFinancialPeriod(anchor);

  const prev = () => setAnchor((d) => shift(d, scale, -1));
  const next = () => setAnchor((d) => shift(d, scale, +1));
  const range = computeRange(anchor, scale, financial);

  return { scale, setScale, anchor, prev, next, range };
}

function shift(d: Date, scale: Scale, sign: number): Date {
  const next = new Date(d);
  if (scale === 'day') next.setDate(next.getDate() + sign);
  if (scale === 'week') next.setDate(next.getDate() + sign * 7);
  if (scale === 'month') next.setMonth(next.getMonth() + sign);
  if (scale === 'year') next.setFullYear(next.getFullYear() + sign);
  return next;
}

function computeRange(d: Date, scale: Scale, financial: { startISO: string; endISO: string } | null) {
  if (scale === 'month' && financial) return { start: financial.startISO, end: financial.endISO };
  // simplified: implement day/week/year ranges as in frontend usePeriodNavigation.ts
  const start = new Date(d), end = new Date(d);
  if (scale === 'day') { /* same day */ }
  if (scale === 'week') { start.setDate(start.getDate() - start.getDay()); end.setDate(start.getDate() + 6); }
  if (scale === 'year') { start.setMonth(0); start.setDate(1); end.setMonth(11); end.setDate(31); }
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}
```

- [ ] **Step 2: `PeriodHeader.tsx`**

```tsx
// mobile/src/widgets/analytics/PeriodHeader.tsx
import { Pressable, Text, View } from 'react-native';
import { Tabs } from '@/shared/ui/tabs';
import type { Scale } from './composables/usePeriodNavigation';

export function PeriodHeader({ scale, setScale, label, onPrev, onNext }: { scale: Scale; setScale: (s: Scale) => void; label: string; onPrev: () => void; onNext: () => void }) {
  return (
    <View className="gap-2 px-4 py-2">
      <Tabs items={[{ id: 'day', label: 'День' }, { id: 'week', label: 'Неделя' }, { id: 'month', label: 'Месяц' }, { id: 'year', label: 'Год' }]} value={scale} onChange={setScale} />
      <View className="flex-row items-center justify-between">
        <Pressable onPress={onPrev}><Text>‹</Text></Pressable>
        <Text className="text-base font-semibold">{label}</Text>
        <Pressable onPress={onNext}><Text>›</Text></Pressable>
      </View>
    </View>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add mobile/src/widgets/analytics
git commit -m "feat(mobile): analytics period navigation"
```

### Task 7.2: Filter chips (account + category)

**Files:**
- Create: `mobile/src/features/analytics-filters/composables/useAnalyticsFilters.ts`
- Create: `mobile/src/features/analytics-filters/components/FilterChips.tsx`

- [ ] **Step 1: Composable**

```ts
import { useState } from 'react';

export function useAnalyticsFilters() {
  const [accountIds, setAccountIds] = useState<string[] | null>(null);
  const [categoryIds, setCategoryIds] = useState<string[] | null>(null);
  return { accountIds, setAccountIds, categoryIds, setCategoryIds };
}
```

- [ ] **Step 2: FilterChips UI**

A pair of multi-select chip rows backed by `useAccounts` + `useCategories`.

- [ ] **Step 3: Commit**

```bash
git add mobile/src/features/analytics-filters
git commit -m "feat(mobile): analytics filters"
```

### Task 7.3: DonutChart widget

**Reference:** `frontend/src/widgets/analytics/DonutChart.vue` (uses svg paths). Mobile: use `react-native-svg`.

**Files:**
- Create: `mobile/src/widgets/analytics/DonutChart.tsx`

- [ ] **Step 1: Install dep**

```bash
cd mobile && npm install react-native-svg
```

- [ ] **Step 2: Implement**

```tsx
// mobile/src/widgets/analytics/DonutChart.tsx
import { Text, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

export type DonutSlice = { id: string; value: number; color: string; label: string };

export function DonutChart({ slices, total }: { slices: DonutSlice[]; total: number }) {
  const r = 60, c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <View className="items-center">
      <Svg width={160} height={160} viewBox="-80 -80 160 160">
        <G rotation={-90}>
          {slices.map((s) => {
            const len = (s.value / Math.max(total, 1)) * c;
            const el = <Circle key={s.id} cx={0} cy={0} r={r} stroke={s.color} strokeWidth={20} fill="none" strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} />;
            offset += len;
            return el;
          })}
        </G>
      </Svg>
    </View>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add mobile/src/widgets/analytics/DonutChart.tsx mobile/package.json mobile/package-lock.json
git commit -m "feat(mobile): DonutChart via react-native-svg"
```

### Task 7.4: DailyExpenseChart + DailyStatsCards

**Reference:** `frontend/src/widgets/analytics/DailyExpenseChart.vue`, `DailyStatsCards.vue`

**Files:**
- Create: `mobile/src/widgets/analytics/DailyExpenseChart.tsx` (bar chart via svg rects)
- Create: `mobile/src/widgets/analytics/DailyStatsCards.tsx` (avg/day, peak day cards)

- [ ] **Step 1: Implement both — ports of frontend logic; use `useDailyStats(userId, {startDate, endDate})` from frontend, port the composable to mobile if missing.**
- [ ] **Step 2: Commit**

```bash
git add mobile/src/widgets/analytics
git commit -m "feat(mobile): daily expense chart + stats cards"
```

### Task 7.5: Analytics screen rewrite

**Files:**
- Modify: `mobile/src/app/(tabs)/analytics.tsx`

- [ ] **Step 1: Compose**

```tsx
// mobile/src/app/(tabs)/analytics.tsx — replace existing body
// Order: PeriodHeader → FilterChips → IncomeExpenseBar → DonutChart → DailyExpenseChart → DailyStatsCards
```

Wire to `useAnalyticsStats({ startDate: range.start, endDate: range.end, accountIds, categoryIds })`, `useConvertedAnalytics` if multi-currency.

- [ ] **Step 2: Commit**

```bash
git add mobile/src/app/(tabs)/analytics.tsx
git commit -m "feat(mobile): analytics screen parity"
```

---

## Phase 8 — Dashboard sections

### Task 8.1: Dashboard widgets — Debts / Goals / Budget / Reminders / Upcoming-Subscriptions

**Reference:** `frontend/src/widgets/debts-section/`, `goals-section/`, `budget-section/`, `reminders-section/`, `upcoming-subscriptions/`

**Files:**
- Create one widget per section under `mobile/src/widgets/<name>/index.tsx`
- Modify: `mobile/src/app/(tabs)/index.tsx`

Each widget renders a header (`<SectionHeader title=... action=...`), a horizontal/vertical list of items (using primitives from Phase 1), and a CTA when empty.

- [ ] **Step 1: Per-section widget (5 small widgets, 1 commit each)**
- [ ] **Step 2: Mount in `(tabs)/index.tsx`**
- [ ] **Step 3: Commit (one per widget)**

```bash
git add mobile/src/widgets/debts-section && git commit -m "feat(mobile): dashboard DebtsSection"
git add mobile/src/widgets/goals-section && git commit -m "feat(mobile): dashboard GoalsSection"
git add mobile/src/widgets/budget-section && git commit -m "feat(mobile): dashboard BudgetSection"
git add mobile/src/widgets/reminders-section && git commit -m "feat(mobile): dashboard RemindersSection"
git add mobile/src/widgets/upcoming-subscriptions && git commit -m "feat(mobile): dashboard UpcomingSubscriptions"
git add mobile/src/app/(tabs)/index.tsx && git commit -m "feat(mobile): wire dashboard sections"
```

### Task 8.2: Quick-action modal trigger

**Reference:** `frontend/src/features/configure-quick-action/components/QuickActionModal.vue`

**Files:**
- Create: `mobile/src/features/configure-quick-action/components/QuickActionSheet.tsx`
- Modify: `mobile/src/app/(tabs)/index.tsx`

- [ ] **Step 1: Sheet renders 4 slot buttons (using `MAX_SLOTS` constant from Task 3.12). Tapping a slot opens a sub-sheet (account picker → category picker → save).**
- [ ] **Step 2: Commit**

```bash
git add mobile/src/features/configure-quick-action mobile/src/app/(tabs)/index.tsx
git commit -m "feat(mobile): quick-action sheet on dashboard"
```

### Task 8.3: SetBudgetSheet

**Reference:** `frontend/src/features/set-budget/components/SetBudgetSheet.vue`

**Files:**
- Create: `mobile/src/features/set-budget/components/SetBudgetSheet.tsx`
- Modify: `mobile/src/app/(tabs)/index.tsx` (open from BudgetSection)

- [ ] **Step 1: formSheet with amount + currency, calls `useSetBudget`.**
- [ ] **Step 2: Commit**

```bash
git add mobile/src/features/set-budget mobile/src/app/(tabs)/index.tsx
git commit -m "feat(mobile): set-budget sheet"
```

### Task 8.4: FinancialPeriodModal

**Reference:** `frontend/src/features/configure-financial-period/components/FinancialPeriodModal.vue`

**Files:**
- Create: `mobile/src/features/configure-financial-period/components/FinancialPeriodSheet.tsx`
- Modify: `mobile/src/app/(tabs)/profile.tsx` (open from profile)

- [ ] **Step 1: Number picker 1–28 (`Picker` or list-based) for `financialMonthStartDay`. PATCH `/api/profile`.**
- [ ] **Step 2: Commit**

```bash
git add mobile/src/features/configure-financial-period mobile/src/app/(tabs)/profile.tsx
git commit -m "feat(mobile): financial period sheet"
```

---

## Phase 9 — Side feature screens

### Task 9.1: Recurring Subscriptions (list + detail + create + edit)

**Files:**
- Create: `mobile/src/app/subscriptions/index.tsx`
- Create: `mobile/src/app/subscriptions/[id].tsx`
- Create: `mobile/src/app/subscriptions/new.tsx`
- Create: `mobile/src/features/create-subscription/components/SubscriptionForm.tsx`
- Create: `mobile/src/features/edit-subscription/components/EditSubscriptionForm.tsx`
- Create: `mobile/src/widgets/subscriptions/SubscriptionListItem.tsx`
- Create: `mobile/src/widgets/subscriptions/SubscriptionCalendar.tsx`

- [ ] **Step 1: List screen** uses `useRecurringSubscriptions(userId)`, renders sorted by next billing date. Two views (list, calendar) toggled via `Tabs`.
- [ ] **Step 2: Calendar widget** — month grid with dots on billing days.
- [ ] **Step 3: Form** — name, amount, currency, account, category, billing cycle (monthly/yearly/custom), start date.
- [ ] **Step 4: New + edit screens** wire form to `useCreateRecurringSubscription` / `useUpdateRecurringSubscription`.
- [ ] **Step 5: Commit per file group**

```bash
git add mobile/src/widgets/subscriptions && git commit -m "feat(mobile): subscription list-item + calendar widgets"
git add mobile/src/features/create-subscription mobile/src/features/edit-subscription && git commit -m "feat(mobile): subscription form + edit form"
git add mobile/src/app/subscriptions && git commit -m "feat(mobile): subscriptions screens"
```

### Task 9.2: Categories management

**Files:**
- Create: `mobile/src/app/settings/categories.tsx`
- Create: `mobile/src/features/manage-categories/components/CategoryForm.tsx`

- [ ] **Step 1: Screen** — `Tabs` with expense/income, drag-reorder via `react-native-draggable-flatlist` (`npm install react-native-draggable-flatlist`), per-item `SwipeableRow` with edit/delete, FAB to add.
- [ ] **Step 2: Form** — name + icon (`IconSelector` ported from frontend → next task) + color + type.

```bash
git add mobile/src/app/settings/categories.tsx mobile/src/features/manage-categories mobile/package.json mobile/package-lock.json
git commit -m "feat(mobile): categories management"
```

### Task 9.3: `IconSelector` + `UIcon` icon expansion

**Reference:** `frontend/src/shared/ui/icon-selector/IconSelector.vue`, `frontend/src/shared/ui/icon/iconMap.ts`

**Files:**
- Create: `mobile/src/shared/ui/icon-selector.tsx`
- Modify: `mobile/src/shared/ui/icon.tsx` (extend iconMap to cover any new names referenced by categories/quick-actions)

- [ ] **Step 1: Grid of pressable icons, on tap → onChange.**
- [ ] **Step 2: Commit**

```bash
git add mobile/src/shared/ui/icon-selector.tsx mobile/src/shared/ui/icon.tsx
git commit -m "feat(mobile): IconSelector + iconMap expansion"
```

### Task 9.4: Quick-actions settings

**Files:**
- Create: `mobile/src/app/settings/quick-actions.tsx`

- [ ] **Step 1: Render `MAX_SLOTS` rows, each with account+category picker. Drag-reorder optional (P1 may defer). On change, call `useQuickActions().setSlot`.**
- [ ] **Step 2: Commit**

```bash
git add mobile/src/app/settings/quick-actions.tsx
git commit -m "feat(mobile): quick-actions settings"
```

### Task 9.5: Dashboard customization

**Reference:** `frontend/src/pages/dashboard-settings/DashboardSettingsPage.vue`

**Files:**
- Create: `mobile/src/app/settings/dashboard.tsx`
- Modify: `mobile/src/entities/profile/api/useProfile.ts` (ensure `dashboardSettings` field + mutation)

- [ ] **Step 1: List of widget toggles (use `Toggle`) + drag-reorder. Save to profile.**
- [ ] **Step 2: Modify `(tabs)/index.tsx` to read `dashboardSettings.order` and `.visibility` for which widgets to render and in what order.**
- [ ] **Step 3: Commit**

```bash
git add mobile/src/app/settings/dashboard.tsx mobile/src/app/(tabs)/index.tsx mobile/src/entities/profile
git commit -m "feat(mobile): dashboard customization"
```

### Task 9.6: Account edit + delete + reorder + adjust-balance modal entries

**Files:**
- Create: `mobile/src/features/edit-account/components/EditAccountSheet.tsx`
- Modify: `mobile/src/app/accounts/index.tsx` (long-press to edit, swipe to delete, draggable-flatlist)
- Modify: `mobile/src/app/accounts/[id]/index.tsx` (header "Edit" + "Delete" actions)

- [ ] **Step 1: EditAccountSheet** — reuse AccountForm.
- [ ] **Step 2: Wire** on list + detail screens.
- [ ] **Step 3: Commit**

```bash
git add mobile/src/app/accounts mobile/src/features/edit-account
git commit -m "feat(mobile): account edit/delete/reorder"
```

### Task 9.7: Changelog screen

**Files:**
- Create: `mobile/src/app/changelog.tsx`
- Create: `mobile/src/features/changelog/components/ChangelogEntryItem.tsx`

- [ ] **Step 1: Render `useChangelog().entries`. On mount call `markSeen()`.**
- [ ] **Step 2: Add entry-point from profile screen.**
- [ ] **Step 3: Commit**

```bash
git add mobile/src/app/changelog.tsx mobile/src/features/changelog mobile/src/app/(tabs)/profile.tsx
git commit -m "feat(mobile): changelog screen"
```

### Task 9.8: Edit profile sheet

**Files:**
- Create: `mobile/src/features/edit-profile/components/EditProfileSheet.tsx`
- Modify: `mobile/src/app/(tabs)/profile.tsx`

- [ ] **Step 1: Sheet with name input + currency picker + save. PATCH `/api/profile`.**
- [ ] **Step 2: Commit**

```bash
git add mobile/src/features/edit-profile mobile/src/app/(tabs)/profile.tsx
git commit -m "feat(mobile): edit profile sheet"
```

### Task 9.9: Push notifications settings (mobile)

**Decision:** mobile push uses Expo Notifications. Backend already supports push-subscription entity. Add UI to (a) request OS permission, (b) register Expo push token, (c) toggle reminder / debt-due / subscription-due categories.

**Files:**
- Create: `mobile/src/features/manage-push-notifications/components/NotificationSettings.tsx` (already partially exists, extend)
- Create: `mobile/src/entities/push-subscription/api/usePushSubscription.ts`

- [ ] **Step 1: Permission request via `expo-notifications`.**
- [ ] **Step 2: On grant, fetch Expo push token, POST to `/api/push-subscriptions/expo` (extend backend later if missing — note as cross-repo dependency in commit message).**
- [ ] **Step 3: Toggle list for category opt-in/out.**
- [ ] **Step 4: Commit**

```bash
git add mobile/src/features/manage-push-notifications mobile/src/entities/push-subscription
git commit -m "feat(mobile): push notification settings"
```

### Task 9.10: Primary color selector

**Files:**
- Create: `mobile/src/app/settings/primary-color.tsx`
- Create: `mobile/src/shared/lib/composables/usePrimaryColor.ts`

- [ ] **Step 1: Implement `usePrimaryColor`** with AsyncStorage persistence + provider in `_layout.tsx`.
- [ ] **Step 2: Screen** — color swatches grid.
- [ ] **Step 3: Commit**

```bash
git add mobile/src/app/settings/primary-color.tsx mobile/src/shared/lib/composables/usePrimaryColor.ts
git commit -m "feat(mobile): primary color selector"
```

### Task 9.11: Currency settings (account currencies list)

**Files:**
- Modify: `mobile/src/app/settings/currency.tsx`

- [ ] **Step 1: Add a second section "Валюты счетов" — multiselect chips backed by AsyncStorage (mirror frontend localStorage logic from `frontend/src/pages/settings/currency/CurrencySettingsPage.vue`).**
- [ ] **Step 2: Commit**

```bash
git add mobile/src/app/settings/currency.tsx
git commit -m "feat(mobile): manage account currencies"
```

### Task 9.12: Onboarding gate (first-account check)

**Files:**
- Modify: `mobile/src/app/_layout.tsx`

- [ ] **Step 1: In layout, after auth resolved, query `useAccounts(userId)`. If empty + `!profile.hasCompletedOnboarding`, redirect to `/accounts/new` with a flag to mark onboarding complete on submit.**
- [ ] **Step 2: Modify `mobile/src/app/accounts/new.tsx` to read flag and PATCH `/api/profile { hasCompletedOnboarding: true }` on success.**
- [ ] **Step 3: Commit**

```bash
git add mobile/src/app/_layout.tsx mobile/src/app/accounts/new.tsx
git commit -m "feat(mobile): onboarding gate (first-account)"
```

### Task 9.13: Demo mode entry

**Reference:** `frontend/src/features/demo-mode/`

**Files:**
- Create: `mobile/src/features/demo-mode/composables/useDemoSetup.ts`
- Modify: `mobile/src/app/auth/sign-in.tsx`

- [ ] **Step 1: Add "Демо" button on sign-in → calls `POST /api/auth/demo` → stores tokens → navigates to `(tabs)/`.**
- [ ] **Step 2: Commit**

```bash
git add mobile/src/features/demo-mode mobile/src/app/auth/sign-in.tsx
git commit -m "feat(mobile): demo mode entry"
```

### Task 9.14: Import wizard parity

**Reference:** `frontend/src/features/import-data/composables/useImportWizard.ts`

**Files:**
- Create: `mobile/src/features/import-data/composables/useImportWizard.ts`
- Modify: `mobile/src/app/settings/import.tsx`

- [ ] **Step 1: Wizard state machine** (steps: select-file → preview → map-columns → confirm → import).
- [ ] **Step 2: Replace flat import.tsx with wizard step renderer.**
- [ ] **Step 3: Commit**

```bash
git add mobile/src/features/import-data mobile/src/app/settings/import.tsx
git commit -m "feat(mobile): import wizard"
```

### Task 9.15: Navbar style selector

**Reference:** `frontend/src/features/select-navbar-style/`

**Files:**
- Create: `mobile/src/features/select-navbar-style/composables/useNavbarStyle.ts`
- Create: `mobile/src/app/settings/navbar-style.tsx`

- [ ] **Step 1: Implement** — persists `'compact' | 'full'` in AsyncStorage; tab bar in `(tabs)/_layout.tsx` reads it.
- [ ] **Step 2: Commit**

```bash
git add mobile/src/features/select-navbar-style mobile/src/app/settings/navbar-style.tsx mobile/src/app/(tabs)/_layout.tsx
git commit -m "feat(mobile): navbar style selector"
```

---

## Phase 10 — Verification

### Task 10.1: Manual checklist run-through

For each of spec §5.1–§5.26 plus Cross-cutting §6, open the mobile app and verify the listed gaps are closed (or that the divergence is marked **A** and intentional).

**Files:** none — checklist is the spec itself.

- [ ] **Step 1: Run app**

```bash
cd mobile && npx expo start --host lan
```

- [ ] **Step 2: Tick each spec line as verified in a working notes file (delete on completion)**

- [ ] **Step 3: For any uncovered gap, open a follow-up task and update this plan with an addendum**

### Task 10.2: Test suite green

- [ ] **Step 1: Run all tests**

```bash
cd mobile && npm test
```

- [ ] **Step 2: All tests pass; lint clean**

```bash
cd mobile && npx eslint .
```

### Task 10.3: Commit memory update

- [ ] **Step 1: Update `MEMORY.md`** — the `project_mobile_migration.md` memory should be marked Phase-5/6 superseded by this parity plan.

```bash
# update via Write tool; commit not required (memory lives outside repo)
```

### Task 10.4: Push and close

- [ ] **Step 1: Push branch**

```bash
git push origin feature/mobile-migration
```

- [ ] **Step 2: Open PR against master** (if not already in flight)

```bash
gh pr create --title "feat(mobile): close parity gaps with Vue frontend" --body-file - <<'EOF'
## Summary
- Closes all P0 and P1 parity gaps identified in `docs/superpowers/specs/2026-05-26-mobile-vs-frontend-parity-audit-design.md`.
- Adds 8 shared/ui primitives, 6 cross-cutting composables, 11 entity API additions, 15+ new screens.
- Accepted divergences (PWA, MasterDetailLayout, OAuth callback, web modals) documented in spec §7.

## Test plan
- [ ] `cd mobile && npm test` — all green
- [ ] `cd mobile && npx eslint .` — clean
- [ ] Manual walkthrough of spec §5.1–§5.26 on iOS Simulator
- [ ] Manual walkthrough on physical device (TestFlight build)
EOF
```

---

## Open Decisions (from spec §8) — required before specific tasks

| # | Decision | Blocks |
|---|---|---|
| 1 | Settings hub or scattered? | None — current plan goes scattered (profile-linked), matching mobile convention. If user wants a hub, add Task 9.16 to create `/settings/index.tsx`. |
| 2 | CollapsibleRoot replacement on debts list | Plan currently uses flat `SectionList` with always-visible sections + toggle (Task 6.1). Change only if product wants collapsible sections. |
| 3 | Goals on web | Out of plan scope. |
| 4 | Push notifications scope | Plan currently does MVP (permission + per-category toggles) in Task 9.9. Full per-event opt-in is a follow-up. |
| 5 | Demo mode on mobile | Plan includes Task 9.13. Remove if product declines. |
| 6 | Welcome screen on mobile | Plan does NOT include — App Store listing serves the same purpose. Add a Task 9.17 if needed. |

---

## Self-review notes

**Spec coverage:** Every P0/P1 line in spec §5 and §6 maps to a task above:

| Spec § | Tasks |
|---|---|
| 5.1 dashboard | 8.1, 8.2, 8.3, 8.4 |
| 5.2 analytics | 7.1–7.5 |
| 5.3 accounts list | 9.6 |
| 5.4 accounts detail | 9.6 |
| 5.5 transactions/new | 4.2 (split) |
| 5.6 history | 5.1, 5.2 |
| 5.7 debts list | 6.1, 6.2 |
| 5.8 debts detail | 6.3, 6.4 |
| 5.9 debts/new | covered by existing mobile create-debt feature; verified in Task 10.1 |
| 5.10 profile | 9.8 (edit), 9.9 (push), 9.10 (color), 8.4 (financial period), 9.15 (navbar), 9.7 (changelog) |
| 5.11 subscriptions list | 9.1 |
| 5.12 subscription detail | 9.1 |
| 5.13 settings hub | open decision; default scattered |
| 5.14 categories | 9.2, 9.3 |
| 5.15 currency settings | 9.11 |
| 5.16 quick-actions | 9.4 |
| 5.17 primary color | 9.10 |
| 5.18 dashboard-settings | 9.5 |
| 5.19 scan-receipt | 4.3 (step 3 unblocked by people in 4.1) |
| 5.20 people | 4.1 |
| 5.21 import wizard | 9.14 |
| 5.22 welcome | open decision; default skipped |
| 5.23 onboarding/first-account | 9.12 |
| 5.24 auth/login | 9.13 (demo mode) |
| 5.25 auth/callback | A (deferred until OAuth backend) |
| 5.26 changelog | 9.7 |
| 6.1 shared/ui | 1.1–1.9 |
| 6.2 entity API | 3.1–3.13 |
| 6.3 composables | 2.1–2.6 |
| 6.4 format utils | 2.6 |
| 6.5 push transport | 9.9 |
| 6.6 navigation patterns | A throughout |

**Placeholder scan:** No "TODO" / "TBD" / "fill in" / "add appropriate" in normative tasks. Some tasks point at "port from frontend file X" — that's an explicit instruction, not a placeholder, and the executor has the reference path.

**Type consistency:** Hook names (`useToast`, `useExchangeRates`, `useFinancialPeriod`, etc.) are used identically across tasks. `MAX_SLOTS`, `ENTITY_COLORS`, `DEFAULT_CURRENCY` are constants ported once and reused. `usePeople` returns `{ list, create, update, remove }` consistently in Task 3.11 and Task 4.1.

---

Plan complete and saved to `docs/superpowers/plans/2026-05-26-mobile-vs-frontend-parity-audit.md`.
