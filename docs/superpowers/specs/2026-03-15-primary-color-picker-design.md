# Primary Color Picker — Design Spec

## Overview

Allow users to change the app's primary (accent) color from a palette of 12 preset colors via a new settings page. The feature is free for all users.

## Decisions

- **Component**: Reka UI `ColorSwatchPicker` (headless, accessible)
- **Palette**: 12 fixed colors, each with 4 precomputed variants (base, hover, pressed, light)
- **Storage**: localStorage only (key `PRIMARY_COLOR`), no backend changes
- **Approach**: Runtime CSS custom property override on `document.documentElement.style`
- **Placement**: New menu item "Основной цвет" in the Settings group on the Profile page, opens a dedicated page at `/settings/color`
- **Application**: Instant (no "Save" button), same UX as theme toggle

## Color Palette

12 colors × 4 variants each. Default: `indigo`.

| Name | Base | Hover | Pressed | Light (12% alpha) |
|------|------|-------|---------|-------------------|
| indigo | `#4F46E5` | `#6366F1` | `#3730A3` | `rgba(79,70,229,0.12)` |
| blue | `#3B82F6` | `#60A5FA` | `#2563EB` | `rgba(59,130,246,0.12)` |
| sky | `#0EA5E9` | `#38BDF8` | `#0284C7` | `rgba(14,165,233,0.12)` |
| cyan | `#06B6D4` | `#22D3EE` | `#0891B2` | `rgba(6,182,212,0.12)` |
| teal | `#14B8A6` | `#2DD4BF` | `#0D9488` | `rgba(20,184,166,0.12)` |
| emerald | `#10B981` | `#34D399` | `#059669` | `rgba(16,185,129,0.12)` |
| lime | `#84CC16` | `#A3E635` | `#65A30D` | `rgba(132,204,22,0.12)` |
| amber | `#F59E0B` | `#FBBF24` | `#D97706` | `rgba(245,158,11,0.12)` |
| orange | `#F97316` | `#FB923C` | `#EA580C` | `rgba(249,115,22,0.12)` |
| red | `#EF4444` | `#F87171` | `#DC2626` | `rgba(239,68,68,0.12)` |
| rose | `#F43F5E` | `#FB7185` | `#E11D48` | `rgba(244,63,94,0.12)` |
| purple | `#A855F7` | `#C084FC` | `#9333EA` | `rgba(168,85,247,0.12)` |

## File Structure (FSD)

```
features/select-primary-color/
├── model/
│   ├── colors.ts            # PRIMARY_COLORS map: name → {base, hover, pressed, light}
│   └── usePrimaryColor.ts   # Singleton composable
└── index.ts                 # Exports: usePrimaryColor, initPrimaryColor, PRIMARY_COLORS

pages/settings/color/
└── PrimaryColorPage.vue     # Route page with ColorSwatchPicker + live preview
```

**Exports from `features/select-primary-color/index.ts`:**
- `usePrimaryColor` — composable for get/set/apply
- `initPrimaryColor` — convenience re-export for App.vue
- `PRIMARY_COLORS` — palette config (used by the page)

## Composable: `usePrimaryColor()`

Singleton pattern (like `useTheme()`).

**Exports:**
- `colorName: Ref<string>` — reactive color name via `useLocalStorage('primary_color', 'indigo')`
- `applyColor(name: string): void` — sets CSS custom properties on `document.documentElement.style`:
  - `--color-primary` → base
  - `--color-primary-hover` → hover
  - `--color-primary-pressed` → pressed
  - `--color-primary-light` → light
  - `--color-info` / `--color-info-light` → same as primary (currently aliased)
  - `:root` variables: `--primary` (RGB space-separated), `--ring` (RGB space-separated)
- `initPrimaryColor(): void` — reads localStorage and applies. Called synchronously in `App.vue`'s `<script setup>` (NOT in `onMounted`) to prevent a flash of the default color on load — same pattern as `initTheme()`

**Hex → RGB conversion**: Utility function `hexToRgbString(hex: string): string` converts `#RRGGBB` → space-separated integers (`"79 70 229"`, NOT `rgb()` syntax). This format is required by shadcn-vue `:root` variables (`--primary`, `--ring`).

## UI: PrimaryColorPage.vue

- `AppHeader` with title "Основной цвет" and back button
- Reka UI `ColorSwatchPicker` with `ColorSwatchPickerItem` for each of 12 colors
  - Circular swatches matching the existing `UColorPicker` sizing/style
  - Check icon on selected color
- Preview section below the picker:
  - `UButton variant="primary"` — shows button color
  - `UBadge` — shows badge color
  - `UProgressBar` — shows progress bar fill
- Selection applies instantly via `applyColor()`

## Profile Page Changes

Add to `settingsGroup` array in `ProfilePage.vue`:

```typescript
// In <script setup>:
const { colorName } = usePrimaryColor();
const currentColor = computed(() => PRIMARY_COLORS[colorName.value]?.base ?? '#4F46E5');

// In settingsGroup array:
{
  id: 'color',
  icon: 'palette',
  label: 'Основной цвет',
  color: currentColor.value,
}
```

The existing menu item template already shows an `IconBadge` with the `color` prop. For the color indicator on the right side, the template will be extended with a small colored circle (`<span>` with `width: 20px; height: 20px; border-radius: 50%; background-color`) rendered conditionally when `item.id === 'color'`, using the current primary color's base hex value.

The `handleMenuClick` case for `'color'` routes to `ROUTE_NAMES.SETTINGS_COLOR`.

## Router Changes

Add route in `app/router/`:
- Name: `ROUTE_NAMES.SETTINGS_COLOR`
- Path: `/settings/color`
- Component: lazy-loaded `PrimaryColorPage`
- Meta: `{ requiresAuth: true }`

## Modified Existing Files

1. `shared/config/storageKeys.ts` — add `PRIMARY_COLOR: 'primary_color'`
2. `app/App.vue` — call `initPrimaryColor()` in setup
3. `pages/profile/ProfilePage.vue` — add menu item + import
4. `shared/config/routeNames.ts` — add `SETTINGS_COLOR` (canonical source, re-exported by `app/router/routeNames.ts`)
5. `app/router/index.ts` — add route

## What Does NOT Change

- `app/styles/index.css` — keeps default indigo values (runtime override takes priority)
- Backend — no API changes, purely client-side
- No premium gating

## Edge Cases

- **First visit / no localStorage**: Default indigo, no style overrides needed (CSS defaults match)
- **Invalid stored value**: Fall back to indigo
- **Theme switch (dark/light)**: Primary color is theme-independent — same in both modes
