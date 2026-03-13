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

**Solution**: Keep App.vue unchanged. Fix inside MainLayout only:

1. **MainLayout.vue**: The root div already uses `h-dvh`. When a DemoBanner is present above it in the DOM, the total page height exceeds the viewport. Solution: set a CSS custom property `--banner-height` on the DemoBanner, and in MainLayout use `h-[calc(100dvh-var(--banner-height,0px))]` so it subtracts the banner height when present.

2. **Alternative (simpler)**: In `App.vue`, wrap only the inner content div (line 83) conditionally: when `isDemo` is true, add `h-dvh flex flex-col overflow-hidden` so only demo users get the flex layout. MainLayout then uses `flex-1 min-h-0` when inside the demo wrapper, keeping `h-dvh` as fallback otherwise. Non-demo routes (WelcomePage, LoginPage) are unaffected.

**Chosen approach**: Use a conditional wrapper. Add a `demo-layout` class to the outer div in App.vue when `isDemo` is true. MainLayout detects the demo context and adjusts accordingly.

**Implementation**:
- `App.vue`: When `isDemo`, the outer div gets additional classes `h-dvh flex flex-col overflow-hidden`
- `MainLayout.vue`: Replace `h-dvh` with `h-dvh demo-layout:flex-1 demo-layout:h-auto demo-layout:min-h-0`. Since Tailwind arbitrary variants are complex here, simpler approach: inject `isDemo` via provide/inject and conditionally apply classes.

**Files**:
- `frontend/src/app/App.vue`
- `frontend/src/app/layouts/ui/MainLayout.vue`

---

## 3. Onboarding Welcome Page Slow Loading

**Problem**: All 7 sections render on initial load. Unbounded font blocks rendering via `@import url()`. 50+ v-motion animations and 20+ blur filters initialize simultaneously.

**Solution** (maximum optimization):

### 3a. Font loading fix
- Remove `@import url(...)` from `WelcomePage.vue` `<style>` block
- Replace with `@font-face` declarations using `font-display: swap` directly in WelcomePage's `<style>` block
- Extract font URLs from the Google Fonts CSS response
- No changes to `index.html` — font is only needed on /welcome, not globally

### 3b. Lazy section rendering
- Extend existing `useSectionAnimation()` composable (in `composables/useScrollAnimations.ts`) with a `rootMargin` option (default `'200px'`) and a separate `shouldRender` ref that triggers before `isVisible`
- Wrap sections below the fold with `v-if="shouldRender"` so they mount only when near viewport
- Use `defineAsyncComponent` for each below-fold section for code-splitting
- Update the barrel export in `sections/index.ts` accordingly (keep static exports but WelcomePage imports async versions directly)
- Note: this creates a dual-observer pattern (one for mount, one for animation) which is intentional — mount happens at 200px margin, animation triggers at 20% visibility

### 3c. Implementation detail
```
HeroSection          — always rendered (above fold), static import
MultiCurrencySection — lazy (defineAsyncComponent + v-if shouldRender)
AnalyticsSection     — lazy
DebtsSection         — lazy
ReceiptScanSection   — lazy
FeaturesSection      — lazy
CtaSection           — lazy
```

Each lazy section gets a sentinel `<div ref="sectionRef" />` that triggers rendering when within 200px of viewport. No loading skeleton needed — the 200px margin ensures content loads before user reaches it.

**Files**:
- `frontend/src/pages/onboarding/welcome/WelcomePage.vue`
- `frontend/src/pages/onboarding/welcome/composables/useScrollAnimations.ts`

---

## 4. Title Overflow on Mobile

**Problem**: "Спроектировано для максимального удобства" with Unbounded font at `text-4xl` (36px) overflows on ~375px mobile screens.

**Solution**: CSS-only fix — reduce base font size on mobile. Keep text unchanged.

Change `text-4xl ... sm:text-5xl lg:text-6xl` → `text-3xl sm:text-4xl lg:text-5xl`

**File**: `frontend/src/pages/onboarding/welcome/sections/FeaturesSection.vue` (line 71)
