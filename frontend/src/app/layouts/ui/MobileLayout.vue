<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import BottomNav from '@/widgets/bottom-nav/ui/BottomNav.vue';
import { ROUTE_NAMES } from '@/app/router/routeNames';
import { useNavbarStyle } from '@/shared/lib/composables';
import { useFeatureHints } from '@/features/feature-hints';
import AppShell from './AppShell.vue';

const LiquidGlassBottomNav = defineAsyncComponent({
  loader: () => import('@/widgets/bottom-nav/ui/LibLiquidGlassBottomNav.vue'),
  errorComponent: BottomNav,
  timeout: 10000,
});

const { isDotDismissed, dismissDot } = useFeatureHints();
const showAddDot = computed(() => !isDotDismissed('add-button'));

const router = useRouter();
const route = useRoute();
const { style: navbarStyle } = useNavbarStyle();

/**
 * Сфокусированные полноэкранные сценарии прячут нижнюю навигацию: иначе она
 * висит поверх их собственных действий внизу экрана.
 */
const FULLSCREEN_FLOWS: string[] = [
  ROUTE_NAMES.SCAN_RECEIPT,
  ROUTE_NAMES.IMPORT_CONFIRM,
  ROUTE_NAMES.IMPORT_INBOX,
  ROUTE_NAMES.NEW_TRANSACTION,
];

const hideBottomNav = computed(() => FULLSCREEN_FLOWS.includes(route.name as string));

function handleAddTransaction() {
  router.push({ name: ROUTE_NAMES.NEW_TRANSACTION });
}
</script>

<template>
  <AppShell>
    <template #nav-bottom>
      <template v-if="!hideBottomNav">
        <LiquidGlassBottomNav
          v-if="navbarStyle === 'liquid-glass'"
          data-testid="bottom-nav"
          :show-add-dot="showAddDot"
          @add-click="handleAddTransaction"
          @add-dot-dismiss="dismissDot('add-button')"
        />
        <div
          v-else
          data-testid="bottom-nav"
          class="shrink-0 border-t border-border-light dark:border-border-dark relative z-40 bg-background-light dark:bg-background-dark"
        >
          <BottomNav
            :show-add-dot="showAddDot"
            @add-click="handleAddTransaction"
            @add-dot-dismiss="dismissDot('add-button')"
          />
        </div>
      </template>
    </template>
  </AppShell>
</template>
