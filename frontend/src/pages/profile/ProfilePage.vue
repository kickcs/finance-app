<script setup lang="ts">
import { computed, inject, ref } from 'vue';
import type { Ref } from 'vue';
import type { User } from '@/shared/api/composables/useAuth';
import { useRouter } from 'vue-router';
import { AppHeader } from '@/widgets/header';
import { BottomNav } from '@/widgets/bottom-nav';
import { UButton, UIcon, UCard, UModal } from '@/shared/ui';
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

const menuItems = [
  {
    id: 'whats-new',
    icon: 'new_releases',
    label: 'Что нового',
    badge: hasUnseenChanges,
  },
  { id: 'import', icon: 'download', label: 'Импорт данных' },
  {
    id: 'currency',
    icon: 'currency_exchange',
    label: 'Валюта',
    value: () => currency.value?.code,
  },
  { id: 'categories', icon: 'category', label: 'Категории' },
  { id: 'quick-actions', icon: 'bolt', label: 'Быстрые действия' },
  { id: 'about', icon: 'info', label: 'О приложении' },
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
      <UCard class="p-5">
        <div class="flex items-center gap-4">
          <div
            class="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center"
          >
            <UIcon name="person" size="lg" class="text-primary" />
          </div>
          <div class="flex-1">
            <p
              class="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark"
            >
              {{ userName }}
            </p>
            <p
              class="text-sm text-text-secondary-light dark:text-text-secondary-dark"
            >
              {{ userEmail }}
            </p>
          </div>
          <UButton
            variant="ghost"
            icon-only
            @click="showEditProfileModal = true"
          >
            <UIcon name="edit" size="md" />
          </UButton>
        </div>
      </UCard>

      <!-- Menu Items -->
      <UCard class="divide-y divide-border-light dark:divide-border-dark">
        <button
          v-for="item in menuItems"
          :key="item.id"
          class="w-full flex items-center gap-4 p-4 transition-colors hover:bg-surface-light dark:hover:bg-surface-dark"
          @click="handleMenuClick(item.id)"
        >
          <div
            class="w-10 h-10 rounded-xl bg-surface-light dark:bg-surface-dark flex items-center justify-center"
          >
            <UIcon
              :name="item.icon"
              size="md"
              class="text-text-secondary-light dark:text-text-secondary-dark"
            />
          </div>
          <span
            class="flex-1 text-left font-medium text-text-primary-light dark:text-text-primary-dark"
          >
            {{ item.label }}
          </span>
          <span
            v-if="item.value"
            class="text-sm text-text-secondary-light dark:text-text-secondary-dark mr-2"
          >
            {{ item.value() }}
          </span>
          <span
            v-if="item.badge?.value"
            class="w-2.5 h-2.5 rounded-full bg-danger mr-1"
          />
          <UIcon
            name="chevron_right"
            size="sm"
            class="text-text-tertiary-light dark:text-text-tertiary-dark"
          />
        </button>
      </UCard>

      <!-- Logout Button -->
      <UButton
        variant="ghost"
        size="lg"
        full-width
        class="text-danger"
        @click="handleLogout"
      >
        <UIcon name="logout" size="sm" class="mr-2" />
        Выйти
      </UButton>
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
