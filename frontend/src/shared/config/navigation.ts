export interface NavItem {
  id: string;
  icon: string;
  path: string;
  label: string;
}

export const MAIN_NAV_ITEMS: NavItem[] = [
  { id: 'home', icon: 'home', path: '/', label: 'Главная' },
  { id: 'analytics', icon: 'pie_chart', path: '/analytics', label: 'Аналитика' },
  { id: 'history', icon: 'history', path: '/history', label: 'История' },
  { id: 'profile', icon: 'person', path: '/profile', label: 'Профиль' },
];

/**
 * Maps child route prefixes to their parent nav item id.
 * Used by BottomNav to highlight the correct tab on sub-pages.
 */
export const CHILD_ROUTE_MAP: Record<string, string> = {
  '/accounts': 'home',
  '/debts': 'home',
  '/reminders': 'home',
  '/dashboard/settings': 'home',
  '/settings': 'profile',
  '/changelog': 'profile',
  '/people': 'profile',
};
