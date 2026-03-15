# BalanceCard Ambient Glow Animation

## Overview

Add ambient "breathing" animation to the two decorative glow circles in `BalanceCard.vue`. The card should feel alive without being distracting. Target audience is primarily mobile users.

## Approach

**Layered CSS keyframes** — each glow circle gets two independent CSS animations:
- **Orbit** — `transform: translate()` movement along a 4-point trajectory
- **Pulse** — `opacity` breathing effect

Different durations per circle create an organic, non-repeating pattern. Only `transform` and `opacity` are animated — both are compositor-only properties (no layout/paint). The existing `blur-[50px]` stays as a static Tailwind class unchanged.

## Animation Specification

### Upper-right glow circle

| Animation       | Property               | Duration | Easing      | Loop     |
|-----------------|------------------------|----------|-------------|----------|
| `glow-orbit-1`  | transform (translate) | 12s      | ease-in-out | infinite |
| `glow-pulse-1`  | opacity               | 6s       | ease-in-out | infinite |

**Orbit keyframes (`glow-orbit-1`):**
- 0%, 100%: `translate(0, 0)`
- 25%: `translate(14px, -8px)`
- 50%: `translate(6px, 10px)`
- 75%: `translate(-8px, 4px)`

**Pulse keyframes (`glow-pulse-1`):**
- 0%, 100%: `opacity: 1`
- 50%: `opacity: 0.7`

### Lower-left glow circle

| Animation       | Property               | Duration | Easing      | Loop     |
|-----------------|------------------------|----------|-------------|----------|
| `glow-orbit-2`  | transform (translate) | 14s      | ease-in-out | infinite |
| `glow-pulse-2`  | opacity               | 8s       | ease-in-out | infinite |

**Orbit keyframes (`glow-orbit-2`):**
- 0%, 100%: `translate(0, 0)`
- 25%: `translate(-10px, 6px)`
- 50%: `translate(8px, -12px)`
- 75%: `translate(12px, 8px)`

**Pulse keyframes (`glow-pulse-2`):**
- 0%, 100%: `opacity: 1`
- 50%: `opacity: 0.75`

### Pattern non-repetition

LCM of orbit durations: lcm(12, 14) = 84s. Combined with pulse offsets (6s, 8s) with lcm(6, 8) = 24s, the full visual pattern repeats after lcm(84, 24) = 168s (nearly 3 minutes) — effectively non-repeating to the human eye.

## Utility Classes

```css
.animate-glow-1 {
  animation: glow-orbit-1 12s ease-in-out infinite,
             glow-pulse-1 6s ease-in-out infinite;
  will-change: transform, opacity;
}

.animate-glow-2 {
  animation: glow-orbit-2 14s ease-in-out infinite,
             glow-pulse-2 8s ease-in-out infinite;
  will-change: transform, opacity;
}
```

## Accessibility

- `@media (prefers-reduced-motion: reduce)` disables all glow animations and removes `will-change`
- Only `transform` and `opacity` are animated — both compositor-only, no layout/paint triggers

## Performance

- Pure CSS, GPU-accelerated via compositor (`transform` + `opacity` only)
- `will-change: transform, opacity` promotes glow divs to their own compositing layer, avoiding mid-animation jank
- No JavaScript overhead
- Modern browsers automatically throttle CSS animations in background tabs, so no extra `visibilitychange` handling needed for PWA battery life

## Template Changes (before → after)

### Upper-right glow div

**Before:**
```html
<div
  class="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-primary/10 dark:bg-primary/20 blur-[50px] pointer-events-none group-hover:bg-primary/15 dark:group-hover:bg-primary/25 transition-colors duration-500 ease-out"
></div>
```

**After:**
```html
<div
  class="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-primary/10 dark:bg-primary/20 blur-[50px] pointer-events-none animate-glow-1"
></div>
```

Removed: `group-hover:bg-primary/15 dark:group-hover:bg-primary/25 transition-colors duration-500 ease-out` (hover irrelevant on mobile, conflicts with ambient animation).

### Lower-left glow div

**Before:**
```html
<div
  class="absolute -bottom-16 -left-16 w-40 h-40 rounded-full bg-primary/10 dark:bg-primary/10 blur-[50px] pointer-events-none group-hover:bg-primary/15 dark:group-hover:bg-primary/15 transition-colors duration-500 ease-out"
></div>
```

**After:**
```html
<div
  class="absolute -bottom-16 -left-16 w-40 h-40 rounded-full bg-primary/10 dark:bg-primary/10 blur-[50px] pointer-events-none animate-glow-2"
></div>
```

Removed: `group-hover:bg-primary/15 dark:group-hover:bg-primary/15 transition-colors duration-500 ease-out`.

## Files to modify

1. **`frontend/src/app/styles/index.css`** — Add 4 `@keyframes` + 2 utility classes + `prefers-reduced-motion` query in the ANIMATIONS section (after existing `shake`).

2. **`frontend/src/widgets/balance-card/ui/BalanceCard.vue`** — Update glow div classes as specified in Template Changes above.

## What NOT to change

- Hover effects on the card container itself (`hover:shadow-md`, `md:hover:-translate-y-1`) — keep as-is
- Balance fade-in `<Transition>` — unrelated
- Button hover transitions — unrelated
- `blur-[50px]` on glow divs — stays as static Tailwind class
