# BalanceCard Morphing Border Effect

## Overview

Replace the two existing glow blobs (`animate-glow-1`, `animate-glow-2`) in BalanceCard with a morphing blob background + animated rotating border, inspired by [CodePen](https://codepen.io/sparklingman/pen/MWjGBXv).

## Decisions

- **Effect type**: Combo — morphing blob behind the card + animated border around it
- **Color palette**: Primary-based from design system tokens
- **Intensity**: Medium — 10-15s cycle, moderate opacity
- **Current glows**: Remove both, replace entirely with new effect
- **Approach**: Pseudo-elements (`::before` for blob, `::after` for border)

## Architecture

### DOM Structure

```
<div class="balance-card" (position: relative, overflow: hidden)>
  ::before  — morphing blob (background glow)
  ::after   — animated border (thin glowing frame)

  <div class="relative z-10">  — card content (above everything)
    ...balance info...
  </div>
</div>
```

No additional DOM elements needed. The two existing glow `<div>`s are removed.

### `::before` — Morphing Blob

- Position: absolute, centered, ~60-70% of card size
- Background: `radial-gradient()` using `primary/20` → `primary/10`
- Filter: `blur(40-50px)` for soft glow
- Animation: `border-radius` morphing via keyframes (12-15s cycle), adapted from CodePen's 10-step shape transformation
- Box-shadow: 2-3 `inset` values using primary color variants (simplified from CodePen's 4 values)
- Opacity: 0.5-0.6 — subtle, doesn't overpower content
- Performance: `will-change: border-radius`

### `::after` — Animated Border

- Position: `inset: 0`, matches card's `border-radius: 2rem`
- Border: `1.5-2px solid transparent`
- Background: `conic-gradient(from var(--angle), primary/0, primary/40, primary/0)` with CSS mask to show only border area
- Animation: `@property --angle` rotation (10s linear infinite cycle)
- Fallback: static subtle border for browsers without `@property` support

### Dark/Light Mode

| Mode  | Blob opacity | Blob color     | Border intensity |
|-------|-------------|----------------|------------------|
| Light | `primary/15` | Weak blur     | Subtle           |
| Dark  | `primary/25` | More saturated | More visible     |

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  .balance-card::before,
  .balance-card::after {
    animation: none;
  }
}
```

## Performance Considerations

- `border-radius` animation: low cost (repaint only, no layout)
- `box-shadow inset`: moderate (repaint per frame, single element)
- `filter: blur()`: moderate (GPU-accelerated)
- No `drop-shadow` filters (expensive in original CodePen — intentionally removed)
- One blob replaces two existing blobs — net GPU load stays the same or decreases
- `will-change: border-radius` hints GPU layer promotion

## Files to Modify

1. `frontend/src/widgets/balance-card/ui/BalanceCard.vue` — remove glow divs, add pseudo-element classes
2. `frontend/src/app/styles/index.css` — remove `animate-glow-1`/`animate-glow-2` keyframes, add new morphing + border keyframes

## Out of Scope

- IntersectionObserver pause (overkill for single element)
- Additional color themes beyond primary
- JavaScript-driven animations
