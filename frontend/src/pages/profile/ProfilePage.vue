<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ROUTE_NAMES } from '@/app/router/routeNames';
import { AppHeader } from '@/widgets/header';
import { PageContainer, UButton, UIcon, UCard, UModal, useToast } from '@/shared/ui';
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
import { FinancialPeriodModal } from '@/features/configure-financial-period';
import { useFinancialPeriod } from '@/shared/lib/hooks/useFinancialPeriod';
import { PushNotificationToggle } from '@/features/manage-push-notifications';
import { ThemeToggle } from '@/features/toggle-theme';
import { getInitial } from '@/shared/lib/format/text';

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

// Financial period
const { startDay } = useFinancialPeriod();
const showFinancialPeriodModal = ref(false);
const financialPeriodLabel = computed(() =>
  startDay.value === 1 ? '1-е (стандарт)' : `${startDay.value}-е число`,
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

const settingsGroup = [
  {
    id: 'currency',
    icon: 'currency_exchange',
    label: 'Главная валюта',
    value: () => currency.value?.code,
  },
  {
    id: 'financial-period',
    icon: 'calendar_month',
    label: 'Начало месяца',
    value: () => financialPeriodLabel.value,
  },
  { id: 'color', icon: 'palette', label: 'Основной цвет' },
  { id: 'categories', icon: 'category', label: 'Категории' },
  { id: 'people', icon: 'group', label: 'Люди' },
  { id: 'quick-actions', icon: 'bolt', label: 'Быстрые действия' },
];

const dataGroup = [{ id: 'import', icon: 'download', label: 'Импорт данных' }];

const appGroup = [
  { id: 'whats-new', icon: 'new_releases', label: 'Что нового', badge: hasUnseenChanges },
  {
    id: 'update',
    icon: 'refresh',
    label: 'Обновление',
    value: () => (isCheckingUpdate.value ? 'Проверка...' : `v${CURRENT_VERSION}`),
  },
  { id: 'about', icon: 'info', label: 'О приложении' },
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
    case 'financial-period':
      showFinancialPeriodModal.value = true;
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
      <AppHeader title="Профиль">
        <template #actions>
          <ThemeToggle />
        </template>
      </AppHeader>
    </template>

    <main class="pt-6 pb-28 md:pb-8 space-y-6">
      <!-- User Section -->
      <section data-testid="user-card" class="flex items-center gap-3.5">
        <div
          class="w-12 h-12 rounded-full bg-primary/10 dark:bg-primary/15 flex items-center justify-center text-base font-bold text-primary shrink-0"
        >
          {{ getInitial(userName) }}
        </div>
        <div class="flex-1 min-w-0">
          <p
            data-testid="user-name"
            class="text-base font-semibold text-text-primary-light dark:text-text-primary-dark truncate"
          >
            {{ userName }}
          </p>
          <p
            data-testid="user-email"
            class="text-sm text-text-secondary-light dark:text-text-secondary-dark truncate"
          >
            {{ userEmail }}
          </p>
        </div>
        <button
          data-testid="edit-profile-btn"
          class="text-sm font-medium text-primary hover:text-primary-hover transition-colors shrink-0"
          @click="showEditProfileModal = true"
        >
          Редактировать
        </button>
      </section>

      <!-- Settings -->
      <section>
        <h2
          class="text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark px-2 mb-2"
        >
          Настройки
        </h2>
        <UCard class="divide-y divide-border-light dark:divide-border-dark overflow-hidden">
          <button
            v-for="item in settingsGroup"
            :key="item.id"
            :data-testid="`menu-item-${item.id}`"
            class="w-full flex items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-surface-light dark:hover:bg-surface-dark active:bg-surface-light dark:active:bg-surface-dark"
            @click="handleMenuClick(item.id)"
          >
            <UIcon
              :name="item.icon"
              size="sm"
              class="text-text-secondary-light dark:text-text-secondary-dark shrink-0"
            />
            <span
              class="flex-1 text-left text-sm font-medium text-text-primary-light dark:text-text-primary-dark"
            >
              {{ item.label }}
            </span>
            <span
              v-if="item.value"
              class="text-sm text-text-tertiary-light dark:text-text-tertiary-dark mr-1"
            >
              {{ item.value() }}
            </span>
            <span
              v-if="item.id === 'color'"
              data-testid="color-dot"
              class="w-5 h-5 rounded-full border border-border-light dark:border-border-dark mr-1 shrink-0"
              :style="{ backgroundColor: currentPrimaryColor }"
            />
            <UIcon
              name="chevron_right"
              size="sm"
              class="text-text-tertiary-light dark:text-text-tertiary-dark"
            />
          </button>
        </UCard>
      </section>

      <!-- Subscription -->
      <SubscriptionSection @upgrade="requirePremium('Premium подписка')" />

      <!-- Notifications -->
      <section>
        <h2
          class="text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark px-2 mb-2"
        >
          Уведомления
        </h2>
        <UCard class="px-4 py-3.5">
          <PushNotificationToggle />
        </UCard>
      </section>

      <!-- Data -->
      <section>
        <h2
          class="text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark px-2 mb-2"
        >
          Данные
        </h2>
        <UCard class="divide-y divide-border-light dark:divide-border-dark overflow-hidden">
          <button
            v-for="item in dataGroup"
            :key="item.id"
            :data-testid="`menu-item-${item.id}`"
            class="w-full flex items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-surface-light dark:hover:bg-surface-dark active:bg-surface-light dark:active:bg-surface-dark"
            @click="handleMenuClick(item.id)"
          >
            <UIcon
              :name="item.icon"
              size="sm"
              class="text-text-secondary-light dark:text-text-secondary-dark shrink-0"
            />
            <span
              class="flex-1 text-left text-sm font-medium text-text-primary-light dark:text-text-primary-dark"
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
      </section>

      <!-- App -->
      <section>
        <h2
          class="text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark px-2 mb-2"
        >
          Приложение
        </h2>
        <UCard class="divide-y divide-border-light dark:divide-border-dark overflow-hidden">
          <button
            v-for="item in appGroup"
            :key="item.id"
            :data-testid="`menu-item-${item.id}`"
            class="w-full flex items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-surface-light dark:hover:bg-surface-dark active:bg-surface-light dark:active:bg-surface-dark"
            @click="handleMenuClick(item.id)"
          >
            <div class="relative shrink-0">
              <UIcon
                :name="item.icon"
                size="sm"
                class="text-text-secondary-light dark:text-text-secondary-dark"
                :class="item.id === 'update' && isCheckingUpdate ? 'animate-spin' : ''"
              />
              <span
                v-if="item.badge?.value"
                data-testid="unseen-badge"
                class="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-danger"
              />
            </div>
            <span
              class="flex-1 text-left text-sm font-medium text-text-primary-light dark:text-text-primary-dark"
            >
              {{ item.label }}
            </span>
            <span
              v-if="item.value"
              class="text-sm text-text-tertiary-light dark:text-text-tertiary-dark mr-1"
            >
              {{ item.value() }}
            </span>
            <UIcon
              name="chevron_right"
              size="sm"
              class="text-text-tertiary-light dark:text-text-tertiary-dark"
            />
          </button>
        </UCard>
      </section>

      <!-- Logout -->
      <button
        data-testid="logout-btn"
        class="w-full flex items-center justify-center gap-2 py-3 text-sm font-medium text-danger hover:text-danger/80 transition-colors"
        @click="handleLogout"
      >
        <UIcon name="logout" size="sm" />
        Выйти из аккаунта
      </button>
    </main>

    <!-- Logout Confirmation Modal -->
    <UModal v-model="showLogoutModal" title="Выход из аккаунта" @close="showLogoutModal = false">
      <p class="text-text-secondary-light dark:text-text-secondary-dark">
        Вы уверены, что хотите выйти из аккаунта?
      </p>

      <template #actions>
        <UButton
          data-testid="logout-cancel-btn"
          variant="secondary"
          full-width
          @click="showLogoutModal = false"
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

    <!-- Financial Period Modal -->
    <FinancialPeriodModal v-model="showFinancialPeriodModal" />
  </PageContainer>
</template>
