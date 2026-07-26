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
import { useSubscription, PLAN_LABELS } from '@/entities/subscription';
import { usePremiumFeature } from '@/shared/lib/composables/usePremiumFeature';
import { formatDate } from '@/shared/lib/format/date';
import { usePwaUpdate } from '@/shared/lib/composables/usePwaUpdate';
import { usePrimaryColor, PRIMARY_COLORS } from '@/features/select-primary-color';
import { FinancialPeriodModal } from '@/features/configure-financial-period';
import { useFinancialPeriod } from '@/shared/lib/hooks/useFinancialPeriod';
import { NotificationSettings } from '@/features/manage-push-notifications';
import { ThemeToggle } from '@/features/toggle-theme';
import { NavbarStyleSelector } from '@/features/select-navbar-style';
import { TelegramSection } from '@/features/link-telegram';
import { getInitial } from '@/shared/lib/format/text';
import { useLocale } from '@/shared/i18n/useLocale';
import SettingsTile from './ui/SettingsTile.vue';
import SectionHeading from './ui/SectionHeading.vue';

const router = useRouter();
const { signOut } = useAuth();
const { locale } = useLocale();

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

// Subscription
const { subscription, isPremium } = useSubscription(userId);
const subscriptionStatusLabel = computed(() => {
  if (subscription.value.status === 'trialing') return 'Пробный период';
  if (subscription.value.cancel_at_period_end) return 'Отменена';
  return isPremium.value ? 'Активна' : 'Бесплатный';
});

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

/** Плитки настроек: сначала значения, затем разделы. */
const settingsTiles = computed(() => [
  {
    id: 'currency',
    icon: 'currency_exchange',
    label: 'Главная валюта',
    value: currency.value?.code,
  },
  {
    id: 'language',
    icon: 'language',
    label: 'Язык',
    value: locale.value === 'en' ? 'English' : 'Русский',
  },
  {
    id: 'financial-period',
    icon: 'calendar_month',
    label: 'Начало месяца',
    value: financialPeriodLabel.value,
  },
  {
    id: 'color',
    icon: 'palette',
    label: 'Основной цвет',
    accentColor: currentPrimaryColor.value,
  },
  { id: 'categories', icon: 'category', label: 'Категории' },
  { id: 'people', icon: 'group', label: 'Люди' },
  { id: 'quick-actions', icon: 'bolt', label: 'Быстрые действия' },
  { id: 'import', icon: 'download', label: 'Импорт данных' },
]);

const appTiles = computed(() => [
  { id: 'whats-new', icon: 'new_releases', label: 'Что нового', badge: hasUnseenChanges.value },
  {
    id: 'update',
    icon: 'refresh',
    label: isCheckingUpdate.value ? 'Проверка...' : 'Обновление',
    spinning: isCheckingUpdate.value,
  },
  { id: 'about', icon: 'info', label: 'О приложении' },
]);

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
    case 'language':
      router.push({ name: ROUTE_NAMES.SETTINGS_LANGUAGE });
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

    <main class="space-y-5 pt-4 pb-28 md:pb-8">
      <!-- Профиль и подписка -->
      <UCard
        data-testid="user-card"
        padding="none"
        class="divide-y divide-border-light overflow-hidden dark:divide-border-dark"
      >
        <button
          data-testid="edit-profile-btn"
          type="button"
          class="flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-surface-light active:bg-surface-light dark:hover:bg-surface-dark dark:active:bg-surface-dark"
          @click="showEditProfileModal = true"
        >
          <span
            class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-body font-bold text-primary dark:bg-primary/15"
          >
            {{ getInitial(userName) }}
          </span>
          <span class="min-w-0 flex-1">
            <span
              data-testid="user-name"
              class="block truncate text-body font-semibold text-text-primary-light dark:text-text-primary-dark"
            >
              {{ userName }}
            </span>
            <span
              data-testid="user-email"
              class="block truncate text-caption text-text-tertiary-light dark:text-text-tertiary-dark"
            >
              {{ userEmail }}
            </span>
          </span>
          <UIcon
            name="chevron_right"
            size="sm"
            class="text-text-tertiary-light dark:text-text-tertiary-dark"
          />
        </button>

        <button
          data-testid="subscription-button"
          type="button"
          class="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-surface-light active:bg-surface-light dark:hover:bg-surface-dark dark:active:bg-surface-dark"
          @click="requirePremium('Premium подписка')"
        >
          <span
            class="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-surface-light dark:bg-surface-dark"
          >
            <UIcon
              name="workspace_premium"
              size="xs"
              class="text-text-secondary-light dark:text-text-secondary-dark"
            />
          </span>
          <span class="min-w-0 flex-1">
            <span
              data-testid="subscription-plan-label"
              class="block truncate text-body-sm font-medium text-text-primary-light dark:text-text-primary-dark"
            >
              {{ isPremium ? PLAN_LABELS[subscription.plan] || 'Premium' : 'Premium подписка' }}
            </span>
            <span
              v-if="isPremium && subscription.current_period_end"
              data-testid="subscription-period-end"
              class="block truncate text-caption text-text-tertiary-light dark:text-text-tertiary-dark"
            >
              {{ subscription.cancel_at_period_end ? 'Действует до' : 'Следующая оплата' }}:
              {{ formatDate(subscription.current_period_end) }}
            </span>
          </span>
          <span
            data-testid="subscription-status-label"
            class="shrink-0 text-caption"
            :class="
              isPremium ? 'text-success' : 'text-text-tertiary-light dark:text-text-tertiary-dark'
            "
          >
            {{ subscriptionStatusLabel }}
          </span>
          <UIcon
            name="chevron_right"
            size="sm"
            class="text-text-tertiary-light dark:text-text-tertiary-dark"
          />
        </button>
      </UCard>

      <!-- Настройки -->
      <section>
        <SectionHeading title="Настройки" />
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <SettingsTile
            v-for="tile in settingsTiles"
            :key="tile.id"
            :data-testid="`menu-item-${tile.id}`"
            :icon="tile.icon"
            :label="tile.label"
            :value="tile.value"
            :accent-color="tile.accentColor"
            @click="handleMenuClick(tile.id)"
          />
        </div>

        <div
          class="mt-2 rounded-xl border border-border-light bg-card-light px-3 py-2 dark:border-border-dark dark:bg-card-dark"
        >
          <NavbarStyleSelector />
        </div>
      </section>

      <!-- Уведомления -->
      <section>
        <SectionHeading title="Уведомления" />
        <NotificationSettings />
      </section>

      <!-- Telegram-импорт -->
      <section>
        <SectionHeading title="Telegram-импорт" />
        <TelegramSection />
      </section>

      <!-- Приложение -->
      <section>
        <SectionHeading title="Приложение" :meta="`v${CURRENT_VERSION}`" />
        <div class="grid grid-cols-3 gap-2">
          <button
            v-for="tile in appTiles"
            :key="tile.id"
            :data-testid="`menu-item-${tile.id}`"
            type="button"
            class="flex flex-col items-center gap-1.5 rounded-xl border border-border-light bg-card-light px-2 py-2.5 transition-colors hover:border-primary/30 active:bg-surface-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-border-dark dark:bg-card-dark dark:hover:border-primary/30 dark:active:bg-surface-dark"
            @click="handleMenuClick(tile.id)"
          >
            <span
              class="relative grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-surface-light dark:bg-surface-dark"
            >
              <UIcon
                :name="tile.icon"
                size="xs"
                class="text-text-secondary-light dark:text-text-secondary-dark"
                :class="tile.spinning && 'animate-spin'"
              />
              <span
                v-if="tile.badge"
                data-testid="unseen-badge"
                class="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-danger ring-2 ring-card-light dark:ring-card-dark"
              />
            </span>
            <span
              class="w-full truncate text-center text-caption font-medium text-text-primary-light dark:text-text-primary-dark"
            >
              {{ tile.label }}
            </span>
          </button>
        </div>
      </section>

      <!-- Выход -->
      <button
        data-testid="logout-btn"
        type="button"
        class="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-body-sm font-medium text-danger transition-colors hover:bg-danger/5 active:bg-danger/10"
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
