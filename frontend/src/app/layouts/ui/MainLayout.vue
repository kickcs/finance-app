<script setup lang="ts">
import { RouterView, useRouter } from 'vue-router';
import { SidebarNav } from '@/widgets/sidebar-nav';
import { BottomNav } from '@/widgets/bottom-nav';
import { transitionName } from '@/app/router';
import { useLayoutData } from '../model/useLayoutData';

const router = useRouter();
const { userName, greeting, totalBalance, currency, isHidden, toggleHidden, isLoading } =
  useLayoutData();

function handleAddTransaction() {
  router.push('/transactions/new');
}
</script>

<template>
  <div class="h-dvh w-full flex overflow-hidden bg-background-light dark:bg-background-dark">
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
        class="md:hidden shrink-0 border-t border-border-light dark:border-border-dark relative z-40 bg-background-light dark:bg-background-dark"
      >
        <BottomNav @add-click="handleAddTransaction" />
      </div>
    </div>
  </div>
</template>
