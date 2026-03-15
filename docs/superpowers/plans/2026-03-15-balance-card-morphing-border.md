# BalanceCard Morphing Border Effect Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace BalanceCard's two glow blobs with a morphing blob background + animated rotating border using CSS pseudo-elements.

**Architecture:** Two pseudo-elements on the card root (`::before` for morphing blob, `::after` for conic-gradient border). All animations in pure CSS. Old glow keyframes removed from global styles.

**Tech Stack:** Vue 3 `<style scoped>`, Tailwind CSS v4, CSS `@property`, `color-mix()`, `mask-composite`

---

## Chunk 1: Implementation

### Task 1: Remove old glow keyframes from index.css

**Files:**
- Modify: `frontend/src/app/styles/index.css:294-334`

- [ ] **Step 1: Remove old glow animations**

Remove lines 294-334 (the `/* Ambient glow animation for BalanceCard */` section including `glow-orbit-1`, `glow-pulse-1`, `glow-orbit-2`, `glow-pulse-2` keyframes, `.animate-glow-1`, `.animate-glow-2` classes, and the `prefers-reduced-motion` block for those classes).

- [ ] **Step 2: Add new keyframes and @property**

Insert at the same location (after `.animate-shake`):

```css
/* BalanceCard morphing blob + rotating border */
@property --border-angle {
  syntax: "<angle>";
  initial-value: 0deg;
  inherits: false;
}

@keyframes morph-blob {
  0%, 100% { border-radius: 30% 70% 70% 30% / 30% 52% 48% 70%; }
  17%      { border-radius: 50% 50% 20% 80% / 25% 80% 20% 75%; }
  33%      { border-radius: 67% 33% 47% 53% / 37% 20% 80% 63%; }
  50%      { border-radius: 100%; }
  67%      { border-radius: 50% 50% 53% 47% / 26% 22% 78% 74%; }
  83%      { border-radius: 20% 80% 20% 80% / 20% 80% 20% 80%; }
}

@keyframes rotate-border {
  to { --border-angle: 360deg; }
}
```

- [ ] **Step 3: Verify build**

Run: `cd /Users/hamkorlab/WebstormProjects/finance-app/frontend && bun run build`
Expected: Build passes with no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/styles/index.css
git commit -m "refactor: replace glow keyframes with morph-blob and rotate-border animations"
```

---

### Task 2: Update BalanceCard template and add scoped styles

**Files:**
- Modify: `frontend/src/widgets/balance-card/ui/BalanceCard.vue`

- [ ] **Step 1: Update template — remove glow divs, remove border class, add balance-card class**

In the template, make these changes:
1. Add `balance-card` class to root `<div>`
2. Remove `border border-border-light dark:border-border-dark` from root `<div>` classes
3. Remove the two glow `<div>`s (lines 22-28)

The root div classes become:
```
class="balance-card relative overflow-hidden rounded-[2rem] bg-card-light dark:bg-card-dark p-6 sm:p-8 shadow-sm hover:shadow-md transition-all duration-300 md:hover:-translate-y-1"
```

- [ ] **Step 2: Add `<style scoped>` block with pseudo-element rules**

Add at the end of the file:

```vue
<style scoped>
.balance-card::before {
  content: "";
  position: absolute;
  top: 50%;
  left: 50%;
  width: 65%;
  height: 65%;
  translate: -50% -50%;
  background: radial-gradient(
    circle,
    color-mix(in srgb, var(--color-primary) 15%, transparent),
    color-mix(in srgb, var(--color-primary) 5%, transparent)
  );
  filter: blur(45px);
  opacity: 0.5;
  border-radius: 30% 70% 70% 30% / 30% 52% 48% 70%;
  animation: morph-blob 12s ease-in-out infinite;
  will-change: transform;
  transform: translateZ(0);
  pointer-events: none;
}

:where(.dark) .balance-card::before {
  background: radial-gradient(
    circle,
    color-mix(in srgb, var(--color-primary) 25%, transparent),
    color-mix(in srgb, var(--color-primary) 10%, transparent)
  );
  opacity: 0.6;
}

.balance-card::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 2rem;
  padding: 1.5px;
  background: conic-gradient(
    from var(--border-angle),
    transparent 0%,
    color-mix(in srgb, var(--color-primary) 30%, transparent) 25%,
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

:where(.dark) .balance-card::after {
  background: conic-gradient(
    from var(--border-angle),
    transparent 0%,
    color-mix(in srgb, var(--color-primary) 40%, transparent) 25%,
    transparent 50%
  );
}

@media (prefers-reduced-motion: reduce) {
  .balance-card::before,
  .balance-card::after {
    animation: none;
  }
}
</style>
```

- [ ] **Step 3: Verify build**

Run: `cd /Users/hamkorlab/WebstormProjects/finance-app/frontend && bun run build`
Expected: Build passes with no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/widgets/balance-card/ui/BalanceCard.vue
git commit -m "feat: add morphing blob and rotating border to BalanceCard"
```

---

### Task 3: Visual verification

- [ ] **Step 1: Start dev server and verify visually**

Run: `cd /Users/hamkorlab/WebstormProjects/finance-app/frontend && bun run dev`

Check in browser:
1. Morphing blob visible behind card content (soft primary-colored glow)
2. Rotating border animates smoothly around card edges
3. Card content (balance, buttons) is fully interactive above the effects
4. Toggle dark mode — blob should be slightly brighter, border more visible
5. No layout shifts or overflow issues
