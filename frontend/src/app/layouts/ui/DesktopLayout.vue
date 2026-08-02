<script setup lang="ts">
import { useRouter } from 'vue-router';
import { SidebarNav } from '@/widgets/sidebar-nav';
import { ROUTE_NAMES } from '@/app/router/routeNames';
import { useLayoutData } from '../model/useLayoutData';
import AppShell from './AppShell.vue';

const router = useRouter();
const { userName, greeting, totalBalance, currency, isHidden, toggleHidden, isLoading } =
  useLayoutData();

function handleAddTransaction() {
  router.push({ name: ROUTE_NAMES.NEW_TRANSACTION });
}
</script>

<template>
  <AppShell supports-overlay-routes>
    <template #nav-side>
      <SidebarNav
        class="flex shrink-0 z-50"
        :user-name="userName"
        :greeting="greeting"
        :total-balance="totalBalance"
        :currency="currency"
        :is-hidden="isHidden"
        :loading="isLoading"
        @toggle-hidden="toggleHidden"
        @add-click="handleAddTransaction"
      />
    </template>
  </AppShell>
</template>
