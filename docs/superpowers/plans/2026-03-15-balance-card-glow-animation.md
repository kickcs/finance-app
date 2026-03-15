# BalanceCard Ambient Glow Animation — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add ambient "breathing" animation to the two decorative glow circles in BalanceCard.

**Architecture:** Pure CSS keyframes — 4 `@keyframes` (orbit + pulse per circle) in global styles, 2 utility classes applied in the Vue template. Compositor-only properties (`transform`, `opacity`) for GPU acceleration.

**Tech Stack:** CSS animations, Tailwind CSS v4

**Spec:** `docs/superpowers/specs/2026-03-15-balance-card-glow-animation-design.md`

---

## Chunk 1: Implementation

### Task 1: Add keyframes and utility classes to global CSS

**Files:**
- Modify: `frontend/src/app/styles/index.css:292` (after `.animate-shake` block)

- [ ] **Step 1: Add 4 @keyframes + 2 utility classes + reduced-motion query**

Insert after line 292 (after `.animate-shake` closing brace), before `/* Safe area utilities */`:

```css
/* Ambient glow animation for BalanceCard */
@keyframes glow-orbit-1 {
  0%, 100% { transform: translate(0, 0); }
  25% { transform: translate(14px, -8px); }
  50% { transform: translate(6px, 10px); }
  75% { transform: translate(-8px, 4px); }
}

@keyframes glow-pulse-1 {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

@keyframes glow-orbit-2 {
  0%, 100% { transform: translate(0, 0); }
  25% { transform: translate(-10px, 6px); }
  50% { transform: translate(8px, -12px); }
  75% { transform: translate(12px, 8px); }
}

@keyframes glow-pulse-2 {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.75; }
}

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

@media (prefers-reduced-motion: reduce) {
  .animate-glow-1,
  .animate-glow-2 {
    animation: none;
    will-change: auto;
  }
}
```

- [ ] **Step 2: Verify CSS is valid**

Run: `cd /Users/hamkorlab/WebstormProjects/finance-app/frontend && bun run build`
Expected: Build succeeds with no errors.

### Task 2: Update BalanceCard template

**Files:**
- Modify: `frontend/src/widgets/balance-card/ui/BalanceCard.vue:20-28`

- [ ] **Step 3: Replace upper-right glow div classes (line 24)**

Replace:
```
class="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-primary/10 dark:bg-primary/20 blur-[50px] pointer-events-none group-hover:bg-primary/15 dark:group-hover:bg-primary/25 transition-colors duration-500 ease-out"
```

With:
```
class="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-primary/10 dark:bg-primary/20 blur-[50px] pointer-events-none animate-glow-1"
```

- [ ] **Step 4: Replace lower-left glow div classes (line 27)**

Replace:
```
class="absolute -bottom-16 -left-16 w-40 h-40 rounded-full bg-primary/10 dark:bg-primary/10 blur-[50px] pointer-events-none group-hover:bg-primary/15 dark:group-hover:bg-primary/15 transition-colors duration-500 ease-out"
```

With:
```
class="absolute -bottom-16 -left-16 w-40 h-40 rounded-full bg-primary/10 dark:bg-primary/10 blur-[50px] pointer-events-none animate-glow-2"
```

- [ ] **Step 5: Clean up stale `group` class on container div (line 20)**

The unnamed `group` class on the container was only used by the glow divs' `group-hover:` classes. After removal, only named groups (`group/btn`, `group/nav`) remain. Remove `group` from:
```
class="relative overflow-hidden rounded-[2rem] bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark p-6 sm:p-8 shadow-sm group hover:shadow-md transition-all duration-300 md:hover:-translate-y-1"
```

Change to:
```
class="relative overflow-hidden rounded-[2rem] bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark p-6 sm:p-8 shadow-sm hover:shadow-md transition-all duration-300 md:hover:-translate-y-1"
```

- [ ] **Step 6: Verify build passes**

Run: `cd /Users/hamkorlab/WebstormProjects/finance-app/frontend && bun run build`
Expected: Build succeeds with no errors.

- [ ] **Step 7: Visual verification**

Run: `cd /Users/hamkorlab/WebstormProjects/finance-app/frontend && bun run dev`
Manually check in browser:
1. BalanceCard glow circles slowly drift and pulse
2. Animation is smooth (no jank)
3. Card hover effects still work on desktop

- [ ] **Step 8: Commit**

```bash
git add frontend/src/app/styles/index.css frontend/src/widgets/balance-card/ui/BalanceCard.vue
git commit -m "feat(frontend): add ambient glow animation to BalanceCard"
```
