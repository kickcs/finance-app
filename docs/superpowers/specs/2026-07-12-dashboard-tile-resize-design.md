# Дизайн: пользовательский ресайз плиток bento-дашборда

**Дата:** 2026-07-12
**Статус:** одобрен пользователем (UX: drag за уголок как iOS 18; 4 размера + адаптация контента)
**База:** поверх `2026-07-11-dashboard-bento-redesign-design.md` (там ресайз был отложен как YAGNI v1)

## Модель данных

- `TileSize = '1x1' | '2x1' | '1x2' | '2x2'` (cols×rows; максимум 2×2, минимум 1×1, доступны все размеры всем виджетам).
- Персист: `dashboard_settings.tile_sizes?: Partial<Record<WidgetId, TileSize>>` (frontend snake_case) ↔ `tileSizes` (backend camelCase). Без миграций БД (JSON-поле профиля).
- `WIDGET_TILE_SIZES: Record<WidgetId,'sm'|'wide'>` заменяется на `DEFAULT_TILE_SIZES: Record<WidgetId, TileSize>`: quick_actions `2x1`, transactions `2x1`, остальные `1x1` (текущее поведение).
- `mergeTileSizes(saved)` в `shared/config/dashboard.ts` — санитизация: неизвестные id и невалидные значения отбрасываются, недостающие берутся из дефолта (симметрично `mergeWidgetOrder`).
- Backend: `DashboardSettings.tileSizes` в profile.entity + валидация в DTO update-profile (по образцу widget_order) + прокидывание в ProfileResponse и все хендлеры (get-profile, update-profile, create-demo-user — гоча из CLAUDE.md).

## Сетка

- `grid-auto-rows: minmax(104px, auto)` + `grid-auto-flow: dense` (закрывает дыры от row-span; кладётся на обе ветки — static и jiggle, чтобы раскладка совпадала).
- Классы спанов: `1x1` — нет, `2x1` — `col-span-2`, `1x2` — `row-span-2`, `2x2` — `col-span-2 row-span-2`. Desktop (4 колонки) — те же спаны.
- Источник размеров: static — `tileSizes` из профиля через dashboardContext; jiggle — `jiggle.localSizes` (паттерн localOrder/localHidden: watch-синхронизация с guard `!isJiggling && !dirty`, сохранение через общий debounce/saveNow).

## Ресайз-жест (jiggle mode)

- У каждой видимой плитки в jiggle — уголок-манипулятор внизу справа (круглый бейдж, зеркальный ✕-бейджу, иконка resize).
- `pointerdown` на манипуляторе: `setPointerCapture` + `stopPropagation` + `preventDefault` (SortableJS не должен начать drag), `touch-action: none` на самом манипуляторе.
- `pointermove`: плитка живо растягивается инлайн-стилями (width/height = базовый rect + delta, cap ~2 ячеек, z-поверх соседей + тень); при пересечении середины ячейки — снап: коммит нового размера (span-классы), haptic `selection`. Дельта всегда считается от исходной базы pointerdown (без перебазирования — визуал непрерывно следует за пальцем).
- Снап-математика — чистая функция `computeSpans(dx, dy, baseRect, currentSpans, metrics) → {cols, rows}` (clamp 1..2), юнит = собственный rect ячейки / текущие спаны (самокалибровка, не зависит от брейкпоинта). Покрывается юнит-тестами.
- Соседи при снапе переезжают FLIP-анимацией: хелпер `useFlipReflow(containerRef)` — снимок rect'ов ячеек до коммита, инверсия через `el.animate` с `SPRING_EASING`/`MORPH_DURATION_MS` из `shared/config/motion.ts`, уважает `prefers-reduced-motion`.
- `pointerup`: снять инлайн-стили, haptic `light`, `setTileSize(id, size)` → общий debounce-персист jiggle.

## Адаптация контента плиток

Плитки получают prop `size: TileSize` (слот BentoGrid прокидывает). Матрица:

| Плитка | 1×1 | 2×1 | 1×2 | 2×2 |
|---|---|---|---|---|
| quick_actions | 4 слота компактно 2×2, только иконки | 4 слота в ряд (текущее) | 4 слота 2×2 с подписями | до 8 слотов (2 ряда) |
| transactions | 2 строки компактно | 3 строки (текущее) | 5 строк | 6 строк |
| top_expenses | топ-3 (текущее) | топ-3 крупнее | топ-5 | топ-6 |
| accounts | сумма+счётчик (текущее) | + топ-2 счёта | список 3 счетов | 4 счёта с балансами |
| budget | кольцо+остаток (текущее) | кольцо слева, потрачено/лимит справа | крупное кольцо + строки | крупное кольцо + потрачено/лимит/дни |
| debts | сальдо (текущее) | + разбивка «вам/вы должны» | топ-2 персоны | топ-3 персоны |
| goals | ближайшая цель (текущее) | цель + сумма крупнее | 2 цели | 3 цели |
| subscriptions | ближайшее списание (текущее) | + сумма/дата крупнее | 2 списания | до 4 списаний |

Пустые состояния не меняются. Раскрытие плитки (overlay) не зависит от размера.

## Ошибки/edge cases

- Невалидный `tile_sizes` из профиля → mergeTileSizes откатывает к дефолту.
- Ресайз во время активного Sortable-drag невозможен (манипулятор — отдельный элемент, drag начинается только с тела плитки).
- Скрытые плитки (footer) — без манипулятора.

## Тестирование

- Юнит: mergeTileSizes, computeSpans, useJiggleMode (localSizes/setTileSize/персист).
- Page spec: манипулятор рендерится в jiggle, отсутствует в static/footer; span-классы применяются из настроек.
- Гейты: `bunx vitest run src/pages/dashboard src/shared/config` + `bun run build` (+ backend `bun run build` при изменении backend).

## Фазы

1. Модель данных end-to-end (backend + типы + merge + jiggle-персист + span-рендер).
2. Жест ресайза (манипулятор, computeSpans, FLIP-reflow, haptics).
3. Адаптация контента 8 плиток + changelog.
