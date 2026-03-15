<script setup lang="ts">
import { ref, watch } from 'vue';
import type { WidgetId, DashboardSettings } from '@/shared/api/database.types';
import draggable from 'vuedraggable';
import { useDebounceFn } from '@vueuse/core';
import { AppHeader } from '@/widgets/header';
import { UIcon, UToggle, useToast } from '@/shared/ui';
import { useProfile } from '@/shared/api';
import { useAccounts } from '@/entities/account';
import { navigateBack } from '@/app/router';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import { useHaptics } from '@/shared/lib/haptics';
import { DEFAULT_WIDGET_ORDER, WIDGET_LABELS, WIDGET_ICONS } from './model/constants';

const { toast } = useToast();
const { trigger } = useHaptics();

const { userId } = useCurrentUser();
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

// Initialize from profile settings
watch(
  dashboardSettings,
  (settings) => {
    if (initialized.value) return;
    const savedOrder = settings?.widget_order ?? DEFAULT_WIDGET_ORDER;
    const missingIds = DEFAULT_WIDGET_ORDER.filter((id) => !savedOrder.includes(id));
    const order = [...savedOrder, ...missingIds];
    const hidden = new Set(settings?.hidden_widgets ?? []);
    widgetList.value = order.map((id) => ({ id, visible: !hidden.has(id) }));
    hiddenAccountIds.value = new Set(settings?.hidden_account_ids ?? []);
    initialized.value = true;
  },
  { immediate: true },
);

// Auto-save logic
const debouncedSave = useDebounceFn(async () => {
  try {
    const settings: DashboardSettings = {
      widget_order: widgetList.value.map((w) => w.id),
      hidden_widgets: widgetList.value.filter((w) => !w.visible).map((w) => w.id),
      hidden_account_ids: Array.from(hiddenAccountIds.value),
    };
    await updateDashboardSettings(settings);
    trigger('success');
  } catch {
    toast({ title: 'Ошибка', description: 'Не удалось сохранить настройки', variant: 'error' });
  }
}, 500);

function onDragStart() {
  trigger('selection');
}

function onDragEnd() {
  trigger('selection');
  debouncedSave();
}

function toggleWidget(id: WidgetId) {
  trigger('selection');
  const item = widgetList.value.find((w) => w.id === id);
  if (item) {
    item.visible = !item.visible;
    debouncedSave();
  }
}

function toggleAccount(accountId: string) {
  trigger('selection');
  if (hiddenAccountIds.value.has(accountId)) {
    hiddenAccountIds.value.delete(accountId);
  } else {
    hiddenAccountIds.value.add(accountId);
  }
  hiddenAccountIds.value = new Set(hiddenAccountIds.value);
  debouncedSave();
}

function isAccountVisible(accountId: string) {
  return !hiddenAccountIds.value.has(accountId);
}
</script>

<template>
  <div class="h-full flex flex-col relative bg-background-light dark:bg-background-dark">
    <AppHeader title="Настройка главной" show-back @back="navigateBack" />

    <main class="flex-1 overflow-y-auto px-4 pt-6 pb-28 space-y-8">
      <!-- Section 1: Widgets -->
      <section class="space-y-2">
        <div class="px-2">
          <h2
            class="text-body-sm font-medium text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wide"
          >
            Виджеты на главной
          </h2>
        </div>

        <div
          class="overflow-hidden rounded-2xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark shadow-sm"
        >
          <draggable
            v-model="widgetList"
            item-key="id"
            handle=".drag-handle"
            :animation="250"
            ghost-class="opacity-40"
            @start="onDragStart"
            @end="onDragEnd"
          >
            <template #item="{ element, index }: { element: WidgetItem; index: number }">
              <div
                class="flex items-center gap-3 p-4 bg-card-light dark:bg-card-dark transition-colors duration-200"
                :class="{
                  'border-b border-border-light dark:border-border-dark':
                    index !== widgetList.length - 1,
                }"
              >
                <!-- Drag handle -->
                <div
                  class="drag-handle cursor-grab active:cursor-grabbing touch-none px-1 -ml-1 py-2"
                >
                  <UIcon
                    name="drag_indicator"
                    size="sm"
                    class="text-text-tertiary-light dark:text-text-tertiary-dark"
                  />
                </div>

                <!-- Widget icon -->
                <div
                  class="w-8 h-8 shrink-0 rounded-[10px] bg-primary/10 flex items-center justify-center"
                >
                  <UIcon :name="WIDGET_ICONS[element.id]" size="sm" class="text-primary" />
                </div>

                <!-- Label -->
                <span
                  class="flex-1 text-body font-medium text-text-primary-light dark:text-text-primary-dark"
                >
                  {{ WIDGET_LABELS[element.id] }}
                </span>

                <!-- Toggle -->
                <UToggle
                  :model-value="element.visible"
                  :aria-label="`Показывать ${WIDGET_LABELS[element.id]}`"
                  @update:model-value="toggleWidget(element.id)"
                />
              </div>
            </template>
          </draggable>
        </div>
        <p class="px-2 pt-1 text-xs text-text-secondary-light dark:text-text-secondary-dark">
          Перетаскивайте виджеты за иконку слева для изменения порядка на главном экране.
        </p>
      </section>

      <!-- Section 2: Accounts in balance -->
      <section v-if="accounts && accounts.length > 0" class="space-y-2">
        <div class="px-2">
          <h2
            class="text-body-sm font-medium text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wide"
          >
            Участвуют в балансе
          </h2>
        </div>

        <div
          class="overflow-hidden rounded-2xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark shadow-sm"
        >
          <div
            v-for="(account, index) in accounts"
            :key="account.id"
            class="flex items-center gap-3 p-4 transition-colors duration-200"
            :class="{
              'border-b border-border-light dark:border-border-dark': index !== accounts.length - 1,
            }"
          >
            <!-- Account icon -->
            <div
              class="w-8 h-8 shrink-0 rounded-[10px] flex items-center justify-center"
              :style="{ backgroundColor: account.color + '1A' }"
            >
              <UIcon :name="account.icon" size="sm" :style="{ color: account.color }" />
            </div>

            <!-- Account name -->
            <span
              class="flex-1 text-left text-body font-medium text-text-primary-light dark:text-text-primary-dark truncate"
            >
              {{ account.name }}
            </span>

            <!-- Toggle -->
            <UToggle
              :model-value="isAccountVisible(account.id)"
              :aria-label="`Включить ${account.name} в баланс`"
              @update:model-value="toggleAccount(account.id)"
            />
          </div>
        </div>
        <p class="px-2 pt-1 text-xs text-text-secondary-light dark:text-text-secondary-dark">
          Отключенные счета не будут учитываться в виджете "Общий баланс".
        </p>
      </section>
    </main>
  </div>
</template>
