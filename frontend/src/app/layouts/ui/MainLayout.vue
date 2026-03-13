<script setup lang="ts">
import { RouterView, useRouter } from 'vue-router';
import { SidebarNav } from '@/widgets/sidebar-nav';
import { BottomNav } from '@/widgets/bottom-nav';
import { transitionName } from '@/app/router';
import { ROUTE_NAMES } from '@/app/router/routeNames';
import { useLayoutData } from '../model/useLayoutData';

import { computed, inject, ref } from 'vue';
import { useRoute } from 'vue-router';
import type { Ref } from 'vue';

const isDemo = inject<Ref<boolean>>('isDemo', ref(false));

const router = useRouter();
const route = useRoute();
const { userName, greeting, totalBalance, currency, isHidden, toggleHidden, isLoading } =
  useLayoutData();

const hideBottomNav = computed(() => route.name === ROUTE_NAMES.SCAN_RECEIPT);

function handleAddTransaction() {
  router.push({ name: ROUTE_NAMES.NEW_TRANSACTION });
}
</script>

<template>
  <div
    :class="[
      'w-full flex overflow-hidden bg-background-light dark:bg-background-dark',
      isDemo ? 'flex-1 min-h-0' : 'h-dvh',
    ]"
  >
    <!-- Skip navigation link -->
    <a
      href="#main-content"
      class="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-4 focus:left-4 focus:px-4 focus:py-2 focus:bg-primary focus:text-white focus:rounded-lg focus:shadow-lg"
    >
      Перейти к содержимому
    </a>
    <!-- Desktop Sidebar -->
    <SidebarNav
      class="hidden md:flex shrink-0 z-50"
      :user-name="userName"
      :greeting="greeting"
      :total-balance="totalBalance"
      :currency="currency"
      :is-hidden="isHidden"
      :loading="isLoading"
      @toggle-hidden="toggleHidden"
      @add-click="handleAddTransaction"
    />

    <!-- Main Content Area -->
    <div
      id="main-content"
      class="flex-1 flex flex-col min-w-0 h-full relative bg-background-light dark:bg-background-dark"
    >
      <div class="flex-1 relative overflow-hidden flex flex-col">
        <RouterView v-slot="{ Component, route }">
          <div
            v-if="transitionName === 'none'"
            :key="route.path"
            class="w-full h-full flex flex-col"
          >
            <component :is="Component" />
          </div>
          <Transition v-else :name="transitionName">
            <div :key="route.path" class="absolute inset-0 w-full h-full flex flex-col">
              <component :is="Component" />
            </div>
          </Transition>
        </RouterView>
      </div>

      <!-- Bottom Navigation (Mobile Only) -->
      <div
        v-if="!hideBottomNav"
        class="md:hidden shrink-0 border-t border-border-light dark:border-border-dark relative z-40 bg-background-light dark:bg-background-dark"
      >
        <BottomNav @add-click="handleAddTransaction" />
      </div>
    </div>
  </div>
</template>
