<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import {
  DrawerRoot,
  DrawerPortal,
  DrawerOverlay,
  DrawerContent,
  DrawerHandle,
  DrawerTitle,
} from 'vaul-vue';
import { UInput, UButton, UIcon } from '@/shared/ui';
import type { Debt } from '@/entities/debt';
import { getCurrencySymbol } from '@/shared/lib/format/currency';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import { useIsDesktop } from '@/shared/lib/composables/useIsDesktop';
import { useDrawerKeyboard } from '@/shared/lib/composables';
import { useEditDebt } from '../model/useEditDebt';
import { ToggleRow } from '@/features/create-debt';

const props = defineProps<{
  open: boolean;
  debt: Debt | null;
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
  saved: [];
}>();

const isDesktop = useIsDesktop();
const { userId } = useCurrentUser();
const { formData, isValid, isDirty, isSubmitting, warnings, updateField, submit, reset } =
  useEditDebt(() => props.debt, userId);

// Refs for keyboard handling
const drawerContentRef = ref<InstanceType<typeof DrawerContent> | null>(null);
const footerRef = ref<HTMLDivElement | null>(null);
const scrollContainerRef = ref<HTMLDivElement | null>(null);

const { setupKeyboardListener, cleanupKeyboardListener } = useDrawerKeyboard(
  drawerContentRef,
  footerRef,
  scrollContainerRef,
);

watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      await nextTick();
      if (!props.open) return;
      if (!isDesktop.value) setupKeyboardListener();
    } else {
      cleanupKeyboardListener();
      nextTick(reset);
    }
  },
);

const currencySymbol = computed(() => (props.debt ? getCurrencySymbol(props.debt.currency) : ''));

async function handleSubmit() {
  const success = await submit();
  if (success) {
    emit('saved');
    emit('update:open', false);
  }
}
</script>

<template>
  <DrawerRoot
    :open="open"
    :direction="isDesktop ? 'right' : 'bottom'"
    @update:open="emit('update:open', $event)"
  >
    <DrawerPortal>
      <DrawerOverlay class="fixed inset-0 z-50 bg-black/40" />
      <DrawerContent
        ref="drawerContentRef"
        class="fixed z-50 flex flex-col bg-card-light dark:bg-card-dark"
        :class="
          isDesktop
            ? 'top-0 right-0 bottom-0 w-[420px] rounded-l-2xl border-l border-border-light dark:border-border-dark'
            : 'bottom-0 left-0 right-0 rounded-t-2xl border-t border-border-light dark:border-border-dark max-h-[90dvh]'
        "
      >
        <!-- Handle (mobile only) -->
        <div v-if="!isDesktop" class="flex justify-center pt-3 pb-1">
          <DrawerHandle class="w-10 h-1 rounded-full bg-border-light dark:bg-border-dark" />
        </div>

        <!-- Header -->
        <div class="flex items-center justify-between px-5 pb-3" :class="{ 'pt-4': isDesktop }">
          <DrawerTitle
            class="text-base font-semibold text-text-primary-light dark:text-text-primary-dark"
          >
            Редактировать долг
          </DrawerTitle>
          <button
            type="button"
            aria-label="Закрыть"
            class="w-8 h-8 rounded-lg flex items-center justify-center text-text-secondary-light dark:text-text-secondary-dark hover:bg-surface-light dark:hover:bg-surface-dark transition-colors"
            @click="emit('update:open', false)"
          >
            <UIcon name="close" size="sm" />
          </button>
        </div>

        <!-- Scrollable Content -->
        <div
          ref="scrollContainerRef"
          class="flex-1 overflow-y-auto px-5 pb-5 space-y-5 overscroll-contain"
          data-vaul-no-drag
        >
          <!-- Person Name -->
          <UInput
            :model-value="formData.person_name"
            label="Кому / от кого"
            placeholder="Имя"
            @update:model-value="updateField('person_name', String($event))"
          />

          <!-- Total Amount -->
          <UInput
            :model-value="String(formData.total_amount || '')"
            label="Общая сумма"
            placeholder="0"
            variant="currency"
            type="number"
            :suffix="currencySymbol"
            @update:model-value="updateField('total_amount', Number($event) || 0)"
          />

          <!-- Description -->
          <UInput
            :model-value="formData.description"
            label="Описание"
            placeholder="Описание..."
            @update:model-value="updateField('description', String($event))"
          />

          <!-- Warnings -->
          <div
            v-for="(warning, idx) in warnings"
            :key="idx"
            class="p-2.5 rounded-lg bg-warning-light border border-warning/20"
          >
            <div class="flex gap-1.5">
              <UIcon name="warning" size="xs" class="text-warning shrink-0 mt-0.5" />
              <p class="text-xs text-warning">{{ warning }}</p>
            </div>
          </div>

          <!-- Private Toggle -->
          <ToggleRow
            v-model="formData.is_private"
            title="Приватный"
            description="Скрыть долг из общего списка"
          />
        </div>

        <!-- Footer -->
        <div
          ref="footerRef"
          class="px-5 py-3 border-t border-border-light dark:border-border-dark"
          :style="
            !isDesktop
              ? 'padding-bottom: calc(env(safe-area-inset-bottom, 16px) + 0.75rem)'
              : undefined
          "
        >
          <UButton
            type="button"
            variant="primary"
            size="xl"
            full-width
            :loading="isSubmitting"
            :disabled="!isValid || !isDirty"
            @click="handleSubmit"
          >
            Сохранить
          </UButton>
        </div>
      </DrawerContent>
    </DrawerPortal>
  </DrawerRoot>
</template>
