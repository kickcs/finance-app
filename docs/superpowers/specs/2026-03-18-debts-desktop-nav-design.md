# Долги в десктопной навигации

**Дата:** 2026-03-18
**Ветка:** feature/debts-pages-redesign

## Цель

Добавить "Долги" как самостоятельный пункт в боковую панель навигации десктопной версии приложения. Мобильная BottomNav остаётся без изменений.

## Контекст

- `MAIN_NAV_ITEMS` используется совместно `SidebarNav` (десктоп) и `BottomNav` (мобайл)
- "Долги" сейчас — вторичная страница, в `CHILD_ROUTE_MAP` сопоставлена с `home`
- `DebtsListPage` уже имеет `MasterDetailLayout` и полностью готова к десктопному использованию
- Мобильный BottomNav переполнится при добавлении 5-го пункта, поэтому изменения только для десктопа

## Решение

**Вариант А — раздельные конфиги навигации.**

Вводим отдельный массив `DESKTOP_NAV_ITEMS` для сайдбара, не трогая `MAIN_NAV_ITEMS`.

## Изменения

### `frontend/src/shared/config/navigation.ts`

Добавить экспорт `DESKTOP_NAV_ITEMS`:

```ts
export const DESKTOP_NAV_ITEMS: NavItem[] = [
  { id: 'home',      icon: 'home',       path: '/',          label: 'Главная' },
  { id: 'analytics', icon: 'pie_chart',  path: '/analytics', label: 'Аналитика' },
  { id: 'history',   icon: 'history',    path: '/history',   label: 'История' },
  { id: 'debts',     icon: 'handshake',  path: '/debts',     label: 'Долги' },
  { id: 'profile',   icon: 'person',     path: '/profile',   label: 'Профиль' },
];
```

Убрать запись `/debts: 'home'` из `CHILD_ROUTE_MAP` — на десктопе сайдбар находит активный пункт напрямую по `route.path.startsWith('/debts')`.

### `frontend/src/widgets/sidebar-nav/ui/SidebarNav.vue`

Заменить импорт `MAIN_NAV_ITEMS` на `DESKTOP_NAV_ITEMS`.

### `frontend/src/widgets/bottom-nav/ui/BottomNav.vue`

Без изменений — продолжает использовать `MAIN_NAV_ITEMS`.

## Поведение после изменений

| Контекст | Поведение |
|---|---|
| Десктоп, `/debts` | Сайдбар подсвечивает "Долги" |
| Десктоп, `/debts/:id` | Сайдбар подсвечивает "Долги" |
| Мобайл, `/debts` | BottomNav подсвечивает "Главная" (через CHILD_ROUTE_MAP) |

## Чеклист после реализации

- [ ] `/simplify` — проверить упрощение кода
- [ ] `/crq` — code review изменений
