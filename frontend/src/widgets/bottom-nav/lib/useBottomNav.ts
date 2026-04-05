import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useHaptics } from '@/shared/lib/haptics';
import { MAIN_NAV_ITEMS, CHILD_ROUTE_MAP, type NavItem } from '@/shared/config/navigation';

const midpoint = Math.floor(MAIN_NAV_ITEMS.length / 2);
const navItems: NavItem[] = [
  ...MAIN_NAV_ITEMS.slice(0, midpoint),
  { id: 'add', icon: 'add', path: '', label: 'Добавить' },
  ...MAIN_NAV_ITEMS.slice(midpoint),
];

export function useBottomNav(emit: { (e: 'add-click'): void; (e: 'add-dot-dismiss'): void }) {
  const { trigger } = useHaptics();
  const route = useRoute();
  const router = useRouter();

  const activeItem = computed(() => {
    const direct = navItems.find((item) => {
      if (item.path === '') return false;
      if (item.path === '/') return route.path === '/';
      return route.path.startsWith(item.path);
    });
    if (direct) return direct.id;

    const childMatch = Object.entries(CHILD_ROUTE_MAP).find(([prefix]) =>
      route.path.startsWith(prefix),
    );
    if (childMatch) return childMatch[1];

    return null;
  });

  function handleAddClick() {
    emit('add-dot-dismiss');
    trigger('selection');
    emit('add-click');
  }

  function handleNavClick(item: (typeof navItems)[0]) {
    if (item.path === '') return;
    if (item.id === activeItem.value && item.id !== 'home') return;
    trigger('selection');
    router.push(item.path);
  }

  return { navItems, activeItem, handleAddClick, handleNavClick };
}
