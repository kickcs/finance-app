<script setup lang="ts">
import { ref, computed, inject, watch } from 'vue';
import type { Ref } from 'vue';
import type { User } from '@/shared/api/composables/useAuth';
import type { WidgetId, DashboardSettings } from '@/shared/api/database.types';
import draggable from 'vuedraggable';
import { AppHeader } from '@/widgets/header';
import { UButton, UIcon } from '@/shared/ui';
import { useProfile } from '@/shared/api';
import { useAccounts } from '@/entities/account';
import { navigateBack } from '@/app/router';
import { DEFAULT_WIDGET_ORDER, WIDGET_LABELS, WIDGET_ICONS } from './model/constants';

const user = inject<Ref<User | null>>('user');
const userId = computed(() => user?.value?.id ?? null);
const { dashboardSettings, updateDashboardSettings } = useProfile(userId);
const { accounts } = useAccounts(userId);

// Local state for DnD
interface WidgetItem {
  id: WidgetId;
  visible: boolean;
}

const widgetList = ref<WidgetItem[]>([]);
const hiddenAccountIds = ref<Set<string>>(new Set());
const initialized = ref(false);
const saving = ref(false);
const hasChanges = ref(false);

// Initialize from profile settings
watch(
  dashboardSettings,
  (settings) => {
    if (initialized.value) return;
    const order = settings?.widget_order ?? DEFAULT_WIDGET_ORDER;
    const hidden = new Set(settings?.hidden_widgets ?? []);
    widgetList.value = order.map((id) => ({ id, visible: !hidden.has(id) }));
    hiddenAccountIds.value = new Set(settings?.hidden_account_ids ?? []);
    initialized.value = true;
  },
  { immediate: true },
);

function markChanged() {
  hasChanges.value = true;
}

function toggleWidget(id: WidgetId) {
  const item = widgetList.value.find((w) => w.id === id);
  if (item) {
    item.visible = !item.visible;
    markChanged();
  }
}

function toggleAccount(accountId: string) {
  if (hiddenAccountIds.value.has(accountId)) {
    hiddenAccountIds.value.delete(accountId);
  } else {
    hiddenAccountIds.value.add(accountId);
  }
  hiddenAccountIds.value = new Set(hiddenAccountIds.value);
  markChanged();
}

function isAccountVisible(accountId: string) {
  return !hiddenAccountIds.value.has(accountId);
}

async function saveSettings() {
  saving.value = true;
  const settings: DashboardSettings = {
    widget_order: widgetList.value.map((w) => w.id),
    hidden_widgets: widgetList.value.filter((w) => !w.visible).map((w) => w.id),
    hidden_account_ids: Array.from(hiddenAccountIds.value),
  };
  await updateDashboardSettings(settings);
  saving.value = false;
  hasChanges.value = false;
  navigateBack();
}
</script>

<template>
  <div
    class="h-full flex flex-col relative bg-background-light dark:bg-background-dark"
  >
    <AppHeader title="Настройка главной" show-back @back="navigateBack" />

    <main class="flex-1 overflow-y-auto px-5 pt-6 pb-8 space-y-6">
      <!-- Section 1: Widgets -->
      <section class="space-y-3">
        <div>
          <h2 class="text-base font-semibold text-text-primary-light dark:text-text-primary-dark">
            Виджеты
          </h2>
          <p class="text-sm text-text-secondary-light dark:text-text-secondary-dark mt-1">
            Перетаскивайте для изменения порядка
          </p>
        </div>

        <draggable
          v-model="widgetList"
          item-key="id"
          handle=".drag-handle"
          :animation="200"
          @end="markChanged"
        >
          <template #item="{ element }: { element: WidgetItem }">
            <div
              class="flex items-center gap-3 p-4 rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark mb-2"
            >
              <!-- Drag handle -->
              <div class="drag-handle cursor-grab active:cursor-grabbing touch-none">
                <UIcon
                  name="drag_indicator"
                  size="sm"
                  class="text-text-tertiary-light dark:text-text-tertiary-dark"
                />
              </div>

              <!-- Widget icon + label -->
              <div
                class="w-9 h-9 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center"
              >
                <UIcon :name="WIDGET_ICONS[element.id]" size="sm" class="text-primary" />
              </div>

              <span
                class="flex-1 text-sm font-medium text-text-primary-light dark:text-text-primary-dark"
              >
                {{ WIDGET_LABELS[element.id] }}
              </span>

              <!-- Toggle -->
              <button
                role="switch"
                :aria-checked="element.visible"
                :aria-label="`Показывать ${WIDGET_LABELS[element.id]}`"
                @click="toggleWidget(element.id)"
              >
                <div
                  class="w-11 h-6 rounded-full relative transition-colors duration-200"
                  :class="
                    element.visible ? 'bg-primary' : 'bg-border-light dark:bg-border-dark'
                  "
                >
                  <div
                    class="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200"
                    :class="element.visible ? 'translate-x-5 left-0.5' : 'left-0.5'"
                  />
                </div>
              </button>
            </div>
          </template>
        </draggable>
      </section>

      <!-- Section 2: Accounts in balance -->
      <section v-if="accounts && accounts.length > 0" class="space-y-3">
        <div>
          <h2 class="text-base font-semibold text-text-primary-light dark:text-text-primary-dark">
            Счета в балансе
          </h2>
          <p class="text-sm text-text-secondary-light dark:text-text-secondary-dark mt-1">
            Выберите счета для общего баланса
          </p>
        </div>

        <div class="space-y-2">
          <button
            v-for="account in accounts"
            :key="account.id"
            class="w-full flex items-center gap-3 p-4 rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark"
            role="switch"
            :aria-checked="isAccountVisible(account.id)"
            :aria-label="`Включить ${account.name} в баланс`"
            @click="toggleAccount(account.id)"
          >
            <!-- Account icon -->
            <div
              class="w-9 h-9 shrink-0 rounded-lg flex items-center justify-center"
              :style="{ backgroundColor: account.color + '1A' }"
            >
              <UIcon :name="account.icon" size="sm" :style="{ color: account.color }" />
            </div>

            <!-- Account name -->
            <span
              class="flex-1 text-left text-sm font-medium text-text-primary-light dark:text-text-primary-dark"
            >
              {{ account.name }}
            </span>

            <!-- Toggle -->
            <div
              class="w-11 h-6 rounded-full relative transition-colors duration-200"
              :class="
                isAccountVisible(account.id)
                  ? 'bg-primary'
                  : 'bg-border-light dark:bg-border-dark'
              "
            >
              <div
                class="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200"
                :class="isAccountVisible(account.id) ? 'translate-x-5 left-0.5' : 'left-0.5'"
              />
            </div>
          </button>
        </div>
      </section>
    </main>

    <!-- Save button (below scroll area) -->
    <div
      v-if="hasChanges"
      class="shrink-0 px-5 py-4 border-t border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark"
    >
      <UButton
        class="w-full"
        :loading="saving"
        @click="saveSettings"
      >
        Сохранить
      </UButton>
    </div>
  </div>
</template>
