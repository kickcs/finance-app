<script setup lang="ts">
import { computed, inject, ref } from 'vue';
import type { Ref } from 'vue';
import type { User } from '@/shared/api/composables/useAuth';
import { useRouter } from 'vue-router';
import { AppHeader } from '@/widgets/header';
import { BottomNav } from '@/widgets/bottom-nav';
import { UButton, UIcon, UCard, UModal, IconBadge } from '@/shared/ui';
import { getCurrencyByCode } from '@/entities/currency';
import { useAuth, useProfile } from '@/shared/api';
import { EditProfileModal } from '@/features/edit-profile';
import { useChangelog } from '@/features/changelog';
import { InstallPwaModal, usePwaInstall } from '@/features/install-pwa';
import { useUserCurrency } from '@/shared/lib/hooks/useUserCurrency';

const router = useRouter();
const { signOut } = useAuth();

// Get user from provide/inject
const user = inject<Ref<User | null>>('user');

// Profile data
const { profile } = useProfile(computed(() => user?.value?.id ?? null));

// User info - prefer profile name from DB, fallback to user name
const userName = computed(
  () => profile.value?.name || user?.value?.name || 'Пользователь',
);
const userEmail = computed(() => user?.value?.email || 'user@example.com');

// Get user currency (profile-first, falls back to localStorage)
const { currency: currencyCode } = useUserCurrency();
const currency = computed(() => getCurrencyByCode(currencyCode.value));

// Changelog
const { hasUnseenChanges, markAsSeen } = useChangelog();

// PWA install
const { showModal: showInstallModal, openModal: openInstallModal } =
  usePwaInstall();

// Modal states
const showLogoutModal = ref(false);
const showEditProfileModal = ref(false);

// Menu Groups
const settingsGroup = [
  {
    id: 'currency',
    icon: 'currency_exchange',
    label: 'Главная валюта',
    value: () => currency.value?.code,
    color: '#10b981', // success
  },
  { id: 'categories', icon: 'category', label: 'Категории', color: '#f59e0b' }, // warning
  { id: 'quick-actions', icon: 'bolt', label: 'Быстрые действия', color: '#8b5cf6' }, // purple
];

const dataGroup = [
  { id: 'import', icon: 'download', label: 'Импорт данных', color: '#3b82f6' }, // primary
];

const appGroup = [
  {
    id: 'whats-new',
    icon: 'new_releases',
    label: 'Что нового',
    badge: hasUnseenChanges,
    color: '#ec4899', // pink
  },
  { id: 'about', icon: 'info', label: 'О приложении', color: '#64748b' }, // slate
];

function handleMenuClick(itemId: string) {
  switch (itemId) {
    case 'whats-new':
      markAsSeen();
      router.push('/changelog');
      break;
    case 'import':
      router.push('/settings/import');
      break;
    case 'currency':
      router.push('/settings/currency');
      break;
    case 'categories':
      router.push('/settings/categories');
      break;
    case 'quick-actions':
      router.push('/settings/quick-actions');
      break;
    case 'about':
      openInstallModal();
      break;
    default:
      console.log('Menu item clicked:', itemId);
  }
}

function handleLogout() {
  showLogoutModal.value = true;
}

function closeLogoutModal() {
  showLogoutModal.value = false;
}

async function confirmLogout() {
  try {
    await signOut();
    router.push({ name: 'login' });
  } catch (err) {
    console.error('Logout failed:', err);
  }
}

function handleAddTransaction() {
  router.push('/transactions/new');
}
</script>

<template>
  <div class="min-h-screen bg-background-light dark:bg-background-dark pb-28">
    <!-- Header -->
    <AppHeader title="Профиль" />

    <!-- Content -->
    <main class="px-5 pt-8 space-y-6">
      <!-- User Card -->
      <UCard class="p-5" variant="bordered">
        <div class="flex items-center gap-4">
          <IconBadge
            icon="person"
            size="lg"
            color="#3b82f6"
            class="shrink-0"
          />
          <div class="flex-1 min-w-0">
            <p class="text-lg font-bold text-text-primary-light dark:text-text-primary-dark truncate">
              {{ userName }}
            </p>
            <p class="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark truncate">
              {{ userEmail }}
            </p>
          </div>
          <UButton
            variant="icon"
            class="shrink-0 bg-surface-light dark:bg-surface-dark hover:bg-border-light dark:hover:bg-border-dark rounded-xl"
            @click="showEditProfileModal = true"
          >
            <UIcon name="edit" size="sm" />
          </UButton>
        </div>
      </UCard>

      <!-- Settings Group -->
      <div>
        <h2 class="text-sm font-semibold text-text-secondary-light dark:text-text-secondary-dark px-2 mb-2 uppercase tracking-wider">
          Настройки
        </h2>
        <UCard class="divide-y divide-border-light dark:divide-border-dark overflow-hidden">
          <button
            v-for="item in settingsGroup"
            :key="item.id"
            class="w-full flex items-center gap-4 p-4 transition-colors hover:bg-surface-light dark:hover:bg-surface-dark active:bg-surface-light dark:active:bg-surface-dark"
            @click="handleMenuClick(item.id)"
          >
            <IconBadge :icon="item.icon" size="sm" :color="item.color" />
            <span class="flex-1 text-left font-medium text-text-primary-light dark:text-text-primary-dark">
              {{ item.label }}
            </span>
            <span v-if="item.value" class="text-sm font-semibold text-text-secondary-light dark:text-text-secondary-dark mr-2">
              {{ item.value() }}
            </span>
            <UIcon name="chevron_right" size="sm" class="text-text-tertiary-light dark:text-text-tertiary-dark" />
          </button>
        </UCard>
      </div>

      <!-- Data Group -->
      <div>
        <h2 class="text-sm font-semibold text-text-secondary-light dark:text-text-secondary-dark px-2 mb-2 uppercase tracking-wider">
          Данные
        </h2>
        <UCard class="divide-y divide-border-light dark:divide-border-dark overflow-hidden">
          <button
            v-for="item in dataGroup"
            :key="item.id"
            class="w-full flex items-center gap-4 p-4 transition-colors hover:bg-surface-light dark:hover:bg-surface-dark active:bg-surface-light dark:active:bg-surface-dark"
            @click="handleMenuClick(item.id)"
          >
            <IconBadge :icon="item.icon" size="sm" :color="item.color" />
            <span class="flex-1 text-left font-medium text-text-primary-light dark:text-text-primary-dark">
              {{ item.label }}
            </span>
            <UIcon name="chevron_right" size="sm" class="text-text-tertiary-light dark:text-text-tertiary-dark" />
          </button>
        </UCard>
      </div>

      <!-- App Group -->
      <div>
        <h2 class="text-sm font-semibold text-text-secondary-light dark:text-text-secondary-dark px-2 mb-2 uppercase tracking-wider">
          Приложение
        </h2>
        <UCard class="divide-y divide-border-light dark:divide-border-dark overflow-hidden">
          <button
            v-for="item in appGroup"
            :key="item.id"
            class="w-full flex items-center gap-4 p-4 transition-colors hover:bg-surface-light dark:hover:bg-surface-dark active:bg-surface-light dark:active:bg-surface-dark relative"
            @click="handleMenuClick(item.id)"
          >
            <div class="relative">
              <IconBadge :icon="item.icon" size="sm" :color="item.color" />
              <span v-if="item.badge?.value" class="absolute -top-0.5 -right-0.5 w-3 h-3 border-2 border-card-light dark:border-card-dark rounded-full bg-danger" />
            </div>
            <span class="flex-1 text-left font-medium text-text-primary-light dark:text-text-primary-dark">
              {{ item.label }}
            </span>
            <UIcon name="chevron_right" size="sm" class="text-text-tertiary-light dark:text-text-tertiary-dark" />
          </button>
        </UCard>
      </div>

      <!-- Logout Button -->
      <UCard variant="bordered" class="overflow-hidden border-danger/20 dark:border-danger/20 hover:border-danger/40 transition-colors">
        <button
          class="w-full flex items-center justify-center gap-2 p-4 text-danger font-semibold active:bg-danger/5"
          @click="handleLogout"
        >
          <UIcon name="logout" size="sm" />
          Выйти из аккаунта
        </button>
      </UCard>
    </main>

    <!-- Bottom Navigation -->
    <BottomNav @add-click="handleAddTransaction" />

    <!-- Logout Confirmation Modal -->
    <UModal
      v-model="showLogoutModal"
      title="Выход из аккаунта"
      @close="closeLogoutModal"
    >
      <p class="text-text-secondary-light dark:text-text-secondary-dark">
        Вы уверены, что хотите выйти из аккаунта?
      </p>

      <template #actions>
        <UButton variant="secondary" full-width @click="closeLogoutModal">
          Отмена
        </UButton>
        <UButton
          variant="primary"
          full-width
          class="!bg-danger hover:!bg-danger/90"
          @click="confirmLogout"
        >
          Выйти
        </UButton>
      </template>
    </UModal>

    <!-- PWA Install Modal -->
    <InstallPwaModal v-model="showInstallModal" />

    <!-- Edit Profile Modal -->
    <EditProfileModal
      v-model="showEditProfileModal"
      :user-id="user?.id ?? null"
    />
  </div>
</template>
