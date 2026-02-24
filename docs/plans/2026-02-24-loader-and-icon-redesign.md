# Loader & App Icon Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace skeleton loading screen with animated enso ring loader and update all app icons to the new enso design.

**Architecture:** Two independent changes — (1) replace `index.html` inline skeleton with SVG stroke-dashoffset animation loader on dark bg, (2) generate new icon assets from source PNG and update all references.

**Tech Stack:** Inline CSS/SVG in index.html, `sips` (macOS) for image resizing, `cwebp` or node script for WebP conversion.

---

### Task 1: Generate New Icon Assets

**Files:**
- Source: `7dbbdff7-24ac-4629-84ad-55e858eef6ff_removalai_preview.png` (600x600)
- Overwrite: `frontend/public/logo-192.png`
- Overwrite: `frontend/public/logo-512.png`
- Overwrite: `frontend/public/logo-192.webp`
- Overwrite: `frontend/public/logo-512.webp`

**Step 1: Resize source PNG to 512x512 and 192x192**

```bash
sips -z 512 512 /path/to/source.png --out frontend/public/logo-512.png
sips -z 192 192 /path/to/source.png --out frontend/public/logo-192.png
```

**Step 2: Generate WebP versions**

Use a node one-liner with `sharp` (install temporarily) or check if `cwebp` is available. Fallback: use `sips` to create PNG, then a small node script:

```bash
cd frontend && npx sharp-cli -i public/logo-512.png -o public/logo-512.webp --format webp
npx sharp-cli -i public/logo-192.png -o public/logo-192.webp --format webp
```

If `sharp-cli` unavailable, write a 5-line node script using `sharp` package.

**Step 3: Verify all 4 files exist and look correct**

```bash
ls -la frontend/public/logo-{192,512}.{png,webp}
sips --getProperty pixelWidth --getProperty pixelHeight frontend/public/logo-192.png frontend/public/logo-512.png
```

Expected: 192x192 and 512x512 respectively.

**Step 4: Commit**

```bash
git add frontend/public/logo-{192,512}.{png,webp}
git commit -m "feat: update app icons to enso ring design"
```

---

### Task 2: Update favicon.svg

**Files:**
- Overwrite: `frontend/public/favicon.svg`

**Step 1: Create new favicon.svg**

Replace the current amber-gradient + geometric O with a dark background + gold enso ring. The SVG should:
- Dark background rect with rounded corners (matching the source image aesthetic)
- Gold brush-stroke ring using a thick stroke with round linecap
- Gold gradient from `#c59b3f` to `#e8c865`
- Subtle inner highlight arc for depth

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="ring" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#c59b3f"/>
      <stop offset="50%" stop-color="#e8c865"/>
      <stop offset="100%" stop-color="#c59b3f"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#e8c865" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#09090B" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="#09090B"/>
  <circle cx="256" cy="256" r="120" fill="url(#glow)"/>
  <circle cx="256" cy="256" r="140" fill="none" stroke="url(#ring)" stroke-width="48" stroke-linecap="round" opacity="0.95"/>
  <path d="M 256 140 A 116 116 0 0 1 358 195" fill="none" stroke="#e8c865" stroke-width="6" stroke-linecap="round" opacity="0.4"/>
</svg>
```

**Step 2: Verify favicon renders in browser**

Open `frontend/public/favicon.svg` in browser. Should show gold ring on dark rounded rectangle.

**Step 3: Commit**

```bash
git add frontend/public/favicon.svg
git commit -m "feat: update favicon to enso ring design"
```

---

### Task 3: Replace Loading Skeleton with Animated Ring Loader

**Files:**
- Modify: `frontend/index.html` — replace `.app-loading` CSS + HTML block

**Step 1: Replace the inline CSS**

Remove all `.app-loading .skeleton`, `.app-loading .header`, `.app-loading .balance-card`, `.app-loading .stats-row`, `.app-loading .section-header`, `.app-loading .card`, desktop skeleton styles, and `@keyframes shimmer`.

Replace with new loader CSS:

```css
/* Animated ring loader */
.app-loading {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  z-index: 1000;
  background-color: #09090B;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.5rem;
  transition: opacity 0.4s ease-out;
  opacity: 1;
}

.app-loading .ring-svg {
  width: 120px;
  height: 120px;
}

.app-loading .ring-circle {
  fill: none;
  stroke: url(#loader-ring-gradient);
  stroke-width: 8;
  stroke-linecap: round;
  stroke-dasharray: 565;
  stroke-dashoffset: 565;
  animation: draw-ring 1.2s cubic-bezier(0.65, 0, 0.35, 1) forwards;
  filter: drop-shadow(0 0 12px rgba(232, 200, 101, 0.3));
}

.app-loading .ring-glow {
  fill: none;
  stroke: url(#loader-ring-gradient);
  stroke-width: 8;
  stroke-linecap: round;
  stroke-dasharray: 565;
  stroke-dashoffset: 565;
  animation: draw-ring 1.2s cubic-bezier(0.65, 0, 0.35, 1) forwards;
  filter: blur(8px);
  opacity: 0.5;
}

.app-loading .app-name {
  color: #e8c865;
  font-family: 'Inter Variable', 'Inter', -apple-system, sans-serif;
  font-size: 1.25rem;
  font-weight: 600;
  letter-spacing: 0.15em;
  opacity: 0;
  animation: fade-in 0.5s ease-out 0.9s forwards;
}

@keyframes draw-ring {
  to { stroke-dashoffset: 0; }
}

@keyframes fade-in {
  to { opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .app-loading .ring-circle,
  .app-loading .ring-glow {
    animation: none;
    stroke-dashoffset: 0;
  }
  .app-loading .app-name {
    animation: none;
    opacity: 1;
  }
}

body.app-ready .app-loading {
  opacity: 0;
  pointer-events: none;
}
```

**Step 2: Replace the HTML skeleton block**

Remove the entire `<div class="app-loading">` with its children (mobile skeleton + desktop skeleton). Replace with:

```html
<div class="app-loading" aria-hidden="true">
  <svg class="ring-svg" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="loader-ring-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#c59b3f"/>
        <stop offset="50%" stop-color="#e8c865"/>
        <stop offset="100%" stop-color="#c59b3f"/>
      </linearGradient>
    </defs>
    <circle class="ring-glow" cx="50" cy="50" r="40"/>
    <circle class="ring-circle" cx="50" cy="50" r="40"/>
  </svg>
  <span class="app-name">OURO</span>
</div>
```

**Step 3: Update the critical CSS `html, body, #app` background**

The `html.dark` background stays `#09090B`. The light mode background stays `#FAFAFA`. The loader itself is always dark regardless of theme — this is handled by the `.app-loading` having its own `background-color: #09090B`.

**Step 4: Verify in browser**

Run `cd frontend && bun run dev`, open the app. Should see:
1. Dark screen with gold ring drawing itself
2. "OURO" text fading in
3. Smooth fade to actual app content

**Step 5: Commit**

```bash
git add frontend/index.html
git commit -m "feat: replace skeleton loader with animated enso ring"
```

---

### Task 4: Verify Build

**Step 1: Run frontend build**

```bash
cd frontend && bun run build
```

Expected: Build succeeds with no errors.

**Step 2: Verify PWA manifest includes correct icon paths**

Check the generated `dist/manifest.webmanifest` references the correct icon files.

**Step 3: Commit (if any fixes needed)**

---

### Task Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Generate icon assets from source PNG | `logo-{192,512}.{png,webp}` |
| 2 | Update favicon.svg | `favicon.svg` |
| 3 | Replace skeleton with ring loader | `index.html` |
| 4 | Verify build | — |
