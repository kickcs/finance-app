# Android Liquid Glass Fallback — Design Spec

**Date:** 2026-04-06
**Problem:** `@wxperia/liquid-glass-vue` causes jank on Android due to software-rendered SVG filters (3x `feDisplacementMap`), heavy `backdrop-filter: blur + saturate`, and per-frame `getBoundingClientRect()` calls. iOS/macOS handle this with hardware GPU compositing; Android does not.

**Solution:** On Android, automatically fall back to the classic navbar. Users can manually re-enable liquid glass but see a performance warning.

## Changes

### 1. `useNavbarStyle.ts` — Android detection + auto-reset

- Detect Android via `navigator.userAgent` check (`/Android/.test(navigator.userAgent)`)
- Expose `isAndroid` as a `boolean` (not reactive — userAgent doesn't change)
- On module init: if `isAndroid && localStorage value === 'liquid-glass'` → reset to `'classic'`
- Change default from `'liquid-glass'` to a computed value: `isAndroid ? 'classic' : 'liquid-glass'`
- Existing API (`style`, `isLiquidGlass`) unchanged

### 2. `NavbarStyleSelector.vue` — warning on Android

- Import `isAndroid` from `useNavbarStyle`
- When `isAndroid` is true, show hint text below the toggle:
  `«Может замедлить работу на этом устройстве»`
- Styling: `text-xs text-text-tertiary-light dark:text-text-tertiary-dark mt-1`

### 3. `MainLayout.vue` — no changes

Already switches between `BottomNav` and `LiquidGlassBottomNav` based on `navbarStyle` value. No additional logic needed.

## Files Modified

| File | Change |
|------|--------|
| `frontend/src/shared/lib/composables/useNavbarStyle.ts` | Add Android detection, auto-reset, conditional default |
| `frontend/src/features/select-navbar-style/ui/NavbarStyleSelector.vue` | Add warning text for Android |

## Not Changed

- `LibLiquidGlassBottomNav.vue` — no modifications to the component itself
- `BottomNav.vue` — no modifications
- `MainLayout.vue` — no modifications
- No new dependencies added
