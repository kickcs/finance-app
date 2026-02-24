# Loader & App Icon Redesign

**Date:** 2026-02-24

## Overview

Replace skeleton loading screen with animated "drawing ring" loader and update app icon to new enso-style gold ring on dark background.

## 1. First-Load Loader — "Drawing Ring"

### Current State
- Skeleton shimmer blocks in `index.html` mimicking page layout (mobile + desktop variants)
- Hides via `body.app-ready` class with opacity transition

### New Design
- Full-screen dark background (`#09090B`) centered loader
- SVG gold enso ring drawn via `stroke-dashoffset` animation (~1.2s)
- After ring completes: subtle gold glow effect around the ring
- "Ouro" text fades in below the ring
- On `body.app-ready`: entire loader fades out (0.3s)
- Same presentation on mobile and desktop (centered, no layout-specific skeletons)
- `prefers-reduced-motion`: static ring, no animation

### Implementation
- All inline in `index.html` (CSS + SVG, no JS dependencies)
- Replaces current `.app-loading` block and associated CSS
- SVG ring styled to match the enso brush-stroke aesthetic from the provided image
- Gold gradient: `#c59b3f` to `#e8c865` (from the image)
- Ring stroke-width ~40-50 with round linecap for brush feel

## 2. App Icon Update

### Current State
- `favicon.svg`: amber gradient background + geometric "O" ring
- `logo-192.png`, `logo-512.png`: rasterized versions
- `logo-192.webp`, `logo-512.webp`: referenced in manifest but may not exist
- Manifest and `index.html` reference these files

### New Design
- Source: provided PNG image (enso gold ring on dark background with rounded corners)
- Generate from source: `logo-192.png`, `logo-512.png`, `logo-192.webp`, `logo-512.webp`
- New `favicon.svg`: dark background + gold enso ring SVG
- Update `apple-touch-icon` reference
- Splash screens: unchanged (separate task)
