<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ROUTE_NAMES } from '@/app/router/routeNames';
import { AppHeader } from '@/widgets/header';
import { PageContainer, UButton, UIcon, UCard, UModal, IconBadge, useToast } from '@/shared/ui';
import { getCurrencyByCode } from '@/entities/currency';
import { useAuth, useProfile } from '@/shared/api';
import { EditProfileModal } from '@/features/edit-profile';
import { useChangelog, CURRENT_VERSION } from '@/features/changelog';
import { InstallPwaModal, usePwaInstall } from '@/features/install-pwa';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import { useUserCurrency } from '@/shared/lib/hooks/useUserCurrency';
import { useAsyncOperation } from '@/shared/lib/hooks/useAsyncOperation';
import { SubscriptionSection } from '@/features/manage-subscription';
import { usePremiumFeature } from '@/shared/lib/composables/usePremiumFeature';
import { usePwaUpdate } from '@/shared/lib/composables/usePwaUpdate';
import { usePrimaryColor, PRIMARY_COLORS } from '@/features/select-primary-color';

const router = useRouter();
const { signOut } = useAuth();

const { user, userId } = useCurrentUser();

// Profile data
const { profile } = useProfile(userId);

// User info - prefer profile name from DB, fallback to user name
const userName = computed(() => profile.value?.name || user?.value?.name || 'Пользователь');
const userEmail = computed(() => user?.value?.email || 'user@example.com');

// Get user currency (profile-first, falls back to localStorage)
const { currency: currencyCode } = useUserCurrency();
const currency = computed(() => getCurrencyByCode(currencyCode.value));

// Changelog
const { hasUnseenChanges, markAsSeen } = useChangelog();

// PWA install
const { showModal: showInstallModal, openModal: openInstallModal } = usePwaInstall();

// Premium
const { requirePremium } = usePremiumFeature();

// Primary color
const { colorName: primaryColorName } = usePrimaryColor();
const currentPrimaryColor = computed(
  () => PRIMARY_COLORS[primaryColorName.value]?.base ?? '#4F46E5',
);

// PWA update
const { toast } = useToast();
const { checkForUpdate } = usePwaUpdate();
const { isLoading: isCheckingUpdate, execute: handleCheckUpdate } = useAsyncOperation(async () => {
  const hasUpdate = await checkForUpdate();
  if (!hasUpdate) {
    toast({ title: 'Вы используете последнюю версию', variant: 'default' });
  }
});

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
  {
    id: 'color',
    icon: 'palette',
    label: 'Основной цвет',
    color: '#a855f7',
  }, // purple
  { id: 'categories', icon: 'category', label: 'Категории', color: '#f59e0b' }, // warning
  { id: 'people', icon: 'group', label: 'Люди', color: '#06b6d4' }, // cyan
  {
    id: 'quick-actions',
    icon: 'bolt',
    label: 'Быстрые действия',
    color: '#8b5cf6',
  }, // purple
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
  {
    id: 'update',
    icon: 'refresh',
    label: 'Обновление',
    value: () => (isCheckingUpdate.value ? 'Проверка...' : `v${CURRENT_VERSION}`),
    color: '#10b981', // success
  },
  { id: 'about', icon: 'info', label: 'О приложении', color: '#64748b' }, // slate
];

function handleMenuClick(itemId: string) {
  switch (itemId) {
    case 'whats-new':
      markAsSeen();
      router.push({ name: ROUTE_NAMES.CHANGELOG });
      break;
    case 'import':
      router.push({ name: ROUTE_NAMES.SETTINGS_IMPORT });
      break;
    case 'currency':
      router.push({ name: ROUTE_NAMES.SETTINGS_CURRENCY });
      break;
    case 'categories':
      router.push({ name: ROUTE_NAMES.SETTINGS_CATEGORIES });
      break;
    case 'people':
      router.push({ name: ROUTE_NAMES.PEOPLE_LIST });
      break;
    case 'quick-actions':
      router.push({ name: ROUTE_NAMES.SETTINGS_QUICK_ACTIONS });
      break;
    case 'color':
      router.push({ name: ROUTE_NAMES.SETTINGS_COLOR });
      break;
    case 'update':
      handleCheckUpdate();
      break;
    case 'about':
      openInstallModal();
      break;
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
    router.push({ name: ROUTE_NAMES.LOGIN });
  } catch (err) {
    console.error('Logout failed:', err);
  }
}
</script>

<template>
  <PageContainer max-width="2xl" class="relative bg-background-light dark:bg-background-dark">
    <template #header>
      <AppHeader title="Профиль" />
    </template>

    <!-- Content -->
    <main class="pt-8 pb-28 md:pb-8 space-y-6">
      <!-- User Card -->
      <UCard data-testid="user-card" class="p-5" variant="bordered">
        <div class="flex items-center gap-4">
          <IconBadge icon="person" size="lg" color="#3b82f6" class="shrink-0" />
          <div class="flex-1 min-w-0">
            <p
              data-testid="user-name"
              class="text-lg font-bold text-text-primary-light dark:text-text-primary-dark truncate"
            >
              {{ userName }}
            </p>
            <p
              data-testid="user-email"
              class="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark truncate"
            >
              {{ userEmail }}
            </p>
          </div>
          <UButton
            data-testid="edit-profile-btn"
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
        <h2
          class="text-sm font-semibold text-text-secondary-light dark:text-text-secondary-dark px-2 mb-2 uppercase tracking-wider"
        >
          Настройки
        </h2>
        <UCard class="divide-y divide-border-light dark:divide-border-dark overflow-hidden">
          <button
            v-for="item in settingsGroup"
            :key="item.id"
            :data-testid="`menu-item-${item.id}`"
            class="w-full flex items-center gap-4 p-4 transition-colors hover:bg-surface-light dark:hover:bg-surface-dark active:bg-surface-light dark:active:bg-surface-dark"
            @click="handleMenuClick(item.id)"
          >
            <IconBadge :icon="item.icon" size="sm" :color="item.color" />
            <span
              class="flex-1 text-left font-medium text-text-primary-light dark:text-text-primary-dark"
            >
              {{ item.label }}
            </span>
            <span
              v-if="item.value"
              class="text-sm font-semibold text-text-secondary-light dark:text-text-secondary-dark mr-2"
            >
              {{ item.value() }}
            </span>
            <span
              v-if="item.id === 'color'"
              data-testid="color-dot"
              class="w-5 h-5 rounded-full border border-border-light dark:border-border-dark mr-2 shrink-0"
              :style="{ backgroundColor: currentPrimaryColor }"
            />
            <UIcon
              name="chevron_right"
              size="sm"
              class="text-text-tertiary-light dark:text-text-tertiary-dark"
            />
          </button>
        </UCard>
      </div>

      <!-- Subscription Section -->
      <SubscriptionSection @upgrade="requirePremium('Premium подписка')" />

      <!-- Data Group -->
      <div>
        <h2
          class="text-sm font-semibold text-text-secondary-light dark:text-text-secondary-dark px-2 mb-2 uppercase tracking-wider"
        >
          Данные
        </h2>
        <UCard class="divide-y divide-border-light dark:divide-border-dark overflow-hidden">
          <button
            v-for="item in dataGroup"
            :key="item.id"
            :data-testid="`menu-item-${item.id}`"
            class="w-full flex items-center gap-4 p-4 transition-colors hover:bg-surface-light dark:hover:bg-surface-dark active:bg-surface-light dark:active:bg-surface-dark"
            @click="handleMenuClick(item.id)"
          >
            <IconBadge :icon="item.icon" size="sm" :color="item.color" />
            <span
              class="flex-1 text-left font-medium text-text-primary-light dark:text-text-primary-dark"
            >
              {{ item.label }}
            </span>
            <UIcon
              name="chevron_right"
              size="sm"
              class="text-text-tertiary-light dark:text-text-tertiary-dark"
            />
          </button>
        </UCard>
      </div>

      <!-- App Group -->
      <div>
        <h2
          class="text-sm font-semibold text-text-secondary-light dark:text-text-secondary-dark px-2 mb-2 uppercase tracking-wider"
        >
          Приложение
        </h2>
        <UCard class="divide-y divide-border-light dark:divide-border-dark overflow-hidden">
          <button
            v-for="item in appGroup"
            :key="item.id"
            :data-testid="`menu-item-${item.id}`"
            class="w-full flex items-center gap-4 p-4 transition-colors hover:bg-surface-light dark:hover:bg-surface-dark active:bg-surface-light dark:active:bg-surface-dark relative"
            @click="handleMenuClick(item.id)"
          >
            <div class="relative">
              <IconBadge
                :icon="item.icon"
                size="sm"
                :color="item.color"
                :class="item.id === 'update' && isCheckingUpdate ? 'animate-spin' : ''"
              />
              <span
                v-if="item.badge?.value"
                data-testid="unseen-badge"
                class="absolute -top-0.5 -right-0.5 w-3 h-3 border-2 border-card-light dark:border-card-dark rounded-full bg-danger"
              />
            </div>
            <span
              class="flex-1 text-left font-medium text-text-primary-light dark:text-text-primary-dark"
            >
              {{ item.label }}
            </span>
            <UIcon
              name="chevron_right"
              size="sm"
              class="text-text-tertiary-light dark:text-text-tertiary-dark"
            />
          </button>
        </UCard>
      </div>

      <!-- Logout Button -->
      <UCard
        variant="bordered"
        class="overflow-hidden border-danger/20 dark:border-danger/20 hover:border-danger/40 transition-colors"
      >
        <button
          data-testid="logout-btn"
          class="w-full flex items-center justify-center gap-2 p-4 text-danger font-semibold active:bg-danger/5"
          @click="handleLogout"
        >
          <UIcon name="logout" size="sm" />
          Выйти из аккаунта
        </button>
      </UCard>
    </main>

    <!-- Logout Confirmation Modal -->
    <UModal v-model="showLogoutModal" title="Выход из аккаунта" @close="closeLogoutModal">
      <p class="text-text-secondary-light dark:text-text-secondary-dark">
        Вы уверены, что хотите выйти из аккаунта?
      </p>

      <template #actions>
        <UButton
          data-testid="logout-cancel-btn"
          variant="secondary"
          full-width
          @click="closeLogoutModal"
        >
          Отмена
        </UButton>
        <UButton
          data-testid="logout-confirm-btn"
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
    <EditProfileModal v-model="showEditProfileModal" :user-id="user?.id ?? null" />
  </PageContainer>
</template>
