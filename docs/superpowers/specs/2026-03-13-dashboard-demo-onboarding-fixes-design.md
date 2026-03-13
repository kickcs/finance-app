# Dashboard, Demo Layout, Onboarding Fixes

**Date**: 2026-03-13

## 1. Budget Widget After Recent Transactions (Mobile)

**Problem**: Budget widget shows before transactions in the default mobile dashboard order.

**Solution**: Change `DEFAULT_WIDGET_ORDER` in `frontend/src/shared/config/dashboard.ts`:

```
Before: quick_actions → budget → accounts → top_expenses → transactions → debts → reminders
After:  quick_actions → accounts → top_expenses → transactions → budget → debts → reminders
```

**Files**: `frontend/src/shared/config/dashboard.ts`

**Impact**: Only affects new users or users who haven't customized widget order. Existing users with custom order stored in localStorage are unaffected.

---

## 2. Demo Banner Breaks Sidebar Height (Web)

**Problem**: DemoBanner renders above MainLayout in `App.vue`. MainLayout uses `h-dvh`, so the banner pushes it down and the "Add Transaction" button at the bottom of the sidebar overflows below the viewport.

**Solution**:

1. **App.vue**: Wrap the container holding DemoBanner + RouterView in `h-dvh flex flex-col overflow-hidden` so the banner takes its natural height and content fills the rest.
2. **MainLayout.vue**: Replace `h-dvh` with `flex-1 min-h-0` on the root div, so it fills remaining space after the banner instead of forcing 100dvh.

**Files**:
- `frontend/src/app/App.vue`
- `frontend/src/app/layouts/ui/MainLayout.vue`

---

## 3. Onboarding Welcome Page Slow Loading

**Problem**: All 7 sections render on initial load. Unbounded font blocks rendering via `@import url()`. 50+ v-motion animations and 20+ blur filters initialize simultaneously.

**Solution** (maximum optimization):

### 3a. Font preloading
- Remove `@import url(...)` from `WelcomePage.vue` `<style>` block
- Add `<link rel="preload" as="font" href="..." crossorigin>` in `frontend/index.html` for Unbounded font
- Use `@font-face` with `font-display: swap` directly in WelcomePage styles

### 3b. Lazy section rendering
- Create `useLazySection()` composable — uses IntersectionObserver with `rootMargin: '200px'` to return a reactive boolean and a template ref
- Wrap sections below the fold (MultiCurrencySection through CtaSection) with `v-if="isVisible"` using the composable
- Use `defineAsyncComponent` for each section so their code is also code-split

### 3c. Implementation detail
```
HeroSection        — always rendered (above fold)
MultiCurrencySection — lazy (defineAsyncComponent + v-if)
AnalyticsSection     — lazy
DebtsSection         — lazy
ReceiptScanSection   — lazy
FeaturesSection      — lazy
CtaSection           — lazy
```

Each lazy section gets a sentinel `<div ref="sectionRef" />` that triggers rendering when within 200px of viewport.

**Files**:
- `frontend/index.html`
- `frontend/src/pages/onboarding/welcome/WelcomePage.vue`
- `frontend/src/pages/onboarding/welcome/composables/useLazySection.ts` (new)

---

## 4. Title Overflow on Mobile

**Problem**: "Спроектировано для максимального удобства" with Unbounded font at `text-4xl` overflows on ~375px mobile screens. The word "максимального" (14 chars) is too wide.

**Solution**: Shorten to "Спроектировано для максимум удобства".

**File**: `frontend/src/pages/onboarding/welcome/sections/FeaturesSection.vue` (line 71-79)
