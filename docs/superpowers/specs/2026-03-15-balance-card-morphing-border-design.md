# BalanceCard Morphing Border Effect

## Overview

Replace the two existing glow blobs (`animate-glow-1`, `animate-glow-2`) in BalanceCard with a morphing blob background + animated rotating border, inspired by [CodePen](https://codepen.io/sparklingman/pen/MWjGBXv).

## Decisions

- **Effect type**: Combo — morphing blob behind the card + animated border around it
- **Color palette**: Primary-based from design system tokens
- **Intensity**: Medium — 10-15s cycle, moderate opacity
- **Current glows**: Remove both, replace entirely with new effect
- **Approach**: Pseudo-elements (`::before` for blob, `::after` for border)
- **Existing `border` class**: Remove from card root — `::after` fully replaces it
- **CSS location**: Keyframes in `index.css` (global, consistent with current approach), pseudo-element styles in `<style scoped>` within `BalanceCard.vue`

## Architecture

### DOM Structure

```
<div class="balance-card" (position: relative, overflow: hidden)>
  ::before  — morphing blob (background glow)
  ::after   — animated border (thin glowing frame, inside overflow boundary)

  <div class="relative z-10">  — card content (above everything)
    ...balance info...
  </div>
</div>
```

No additional DOM elements needed. The two existing glow `<div>`s are removed. The existing Tailwind `border border-border-light dark:border-border-dark` is removed from the card root — `::after` replaces it entirely.

### `::before` — Morphing Blob

- Position: absolute, centered, ~60-70% of card size
- Background: `radial-gradient(circle, color-mix(in srgb, var(--color-primary) 20%, transparent), color-mix(in srgb, var(--color-primary) 5%, transparent))`
- Filter: `blur(45px)` for soft glow
- `will-change: transform` + `transform: translateZ(0)` for GPU layer promotion
- Animation: `border-radius` morphing via keyframes (12s cycle)
- No `box-shadow` — with `blur(45px)` applied, inset shadows are invisible. Dropped for performance.

**Keyframes** (adapted from CodePen, simplified to 6 steps):

```css
@keyframes morph-blob {
  0%, 100% { border-radius: 30% 70% 70% 30% / 30% 52% 48% 70%; }
  17%      { border-radius: 50% 50% 20% 80% / 25% 80% 20% 75%; }
  33%      { border-radius: 67% 33% 47% 53% / 37% 20% 80% 63%; }
  50%      { border-radius: 100%; }
  67%      { border-radius: 50% 50% 53% 47% / 26% 22% 78% 74%; }
  83%      { border-radius: 20% 80% 20% 80% / 20% 80% 20% 80%; }
}
```

### `::after` — Animated Border

Uses `conic-gradient` with `@property` for rotation, masked to show only the border area:

```css
@property --border-angle {
  syntax: "<angle>";
  initial-value: 0deg;
  inherits: false;
}

@keyframes rotate-border {
  to { --border-angle: 360deg; }
}

.balance-card::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 2rem;
  padding: 1.5px; /* border thickness */
  background: conic-gradient(
    from var(--border-angle),
    transparent 0%,
    color-mix(in srgb, var(--color-primary) 40%, transparent) 25%,
    transparent 50%
  );
  mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  -webkit-mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  mask-composite: exclude;
  -webkit-mask-composite: xor;
  animation: rotate-border 10s linear infinite;
  pointer-events: none;
}
```

**`@property` fallback** (Firefox <128 and older browsers):

```css
/* When @property is not supported, --border-angle won't animate.
   The ::after renders a static gradient border at 0deg.
   This is acceptable — the morphing blob still provides the main visual effect.
   No additional fallback border needed since the static conic-gradient
   already renders a subtle partial border. */
```

### Dark/Light Mode

| Mode  | Blob `background` | Blob `opacity` | Border gradient peak |
|-------|-------------------|---------------|---------------------|
| Light | `radial-gradient(circle, color-mix(in srgb, var(--color-primary) 15%, transparent), color-mix(in srgb, var(--color-primary) 5%, transparent))` | `0.5` | `color-mix(in srgb, var(--color-primary) 30%, transparent)` |
| Dark  | `radial-gradient(circle, color-mix(in srgb, var(--color-primary) 25%, transparent), color-mix(in srgb, var(--color-primary) 10%, transparent))` | `0.6` | `color-mix(in srgb, var(--color-primary) 40%, transparent)` |

> Note: `color-mix()` is used because `--color-primary` is defined as hex (`#4f46e5`), not as oklch/rgb components. `color-mix(in srgb, ...)` has 95%+ browser support (Chrome 111+, Safari 16.2+, Firefox 113+).

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  .balance-card::before,
  .balance-card::after {
    animation: none;
  }
}
```

### Existing Hover Effects

The card's `hover:shadow-md` and `md:hover:-translate-y-1` with `transition-all` are preserved. Since pseudo-elements don't inherit `transition-all`, there is no conflict. The `transition-all` on the root only affects the root element's own properties (shadow, transform).

## Performance Considerations

- `border-radius` animation: low cost (repaint only, no layout)
- `filter: blur()`: moderate (GPU-accelerated)
- No `drop-shadow` filters (expensive in original CodePen — intentionally removed)
- No `box-shadow` on blob — invisible under blur, removed for performance
- `will-change: transform` on `::before` for proper GPU layer promotion
- One blob replaces two existing blobs — net GPU load stays the same or decreases
- BalanceCard is on the dashboard (landing page). Two CSS animations on a single card are lightweight. Battery impact is negligible for a single element, but if performance issues arise in future, `IntersectionObserver` can pause animations when off-screen.

## Files to Modify

1. `frontend/src/widgets/balance-card/ui/BalanceCard.vue`:
   - Remove two glow `<div>`s
   - Remove `border border-border-light dark:border-border-dark` from root classes
   - Add `<style scoped>` with `::before` and `::after` rules
2. `frontend/src/app/styles/index.css`:
   - Remove `animate-glow-1`/`animate-glow-2` classes and their keyframes (`glow-orbit-1`, `glow-orbit-2`, `glow-pulse-1`, `glow-pulse-2`)
   - Add `@property --border-angle`, `@keyframes morph-blob`, `@keyframes rotate-border`

## Out of Scope

- IntersectionObserver pause (overkill for single element, can add later if needed)
- Additional color themes beyond primary
- JavaScript-driven animations
