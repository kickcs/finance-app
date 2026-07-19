<script setup lang="ts">
import {
  DrawerRoot,
  DrawerPortal,
  DrawerOverlay,
  DrawerContent,
  DrawerHandle,
  DrawerTitle,
} from 'vaul-vue';
import { UIcon, IconBadge } from '@/shared/ui';
import { useIsDesktop } from '@/shared/lib/composables/useIsDesktop';

type ReviewType = 'expense' | 'income' | 'transfer';

defineProps<{
  open: boolean;
  modelValue: ReviewType;
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
  'update:modelValue': [value: ReviewType];
}>();

const isDesktop = useIsDesktop();

const OPTIONS: { type: ReviewType; label: string; icon: string; color: string }[] = [
  { type: 'expense', label: 'Расход', icon: 'trending_down', color: '#ef4444' },
  { type: 'income', label: 'Доход', icon: 'trending_up', color: '#22c55e' },
  { type: 'transfer', label: 'Перевод', icon: 'swap_horiz', color: '#4f46e5' },
];

function pick(type: ReviewType) {
  emit('update:modelValue', type);
  emit('update:open', false);
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
        class="fixed z-50 flex flex-col bg-card-light dark:bg-card-dark"
        :class="
          isDesktop
            ? 'top-0 right-0 bottom-0 w-[420px] rounded-l-2xl border-l border-border-light dark:border-border-dark'
            : 'bottom-0 left-0 right-0 rounded-t-2xl border-t border-border-light dark:border-border-dark'
        "
      >
        <div v-if="!isDesktop" class="flex justify-center pt-3 pb-1">
          <DrawerHandle class="w-10 h-1 rounded-full bg-border-light dark:bg-border-dark" />
        </div>

        <div class="px-5 pb-2" :class="{ 'pt-4': isDesktop }">
          <DrawerTitle
            class="text-base font-semibold text-text-primary-light dark:text-text-primary-dark"
          >
            Тип операции
          </DrawerTitle>
        </div>

        <div class="px-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            v-for="option in OPTIONS"
            :key="option.type"
            type="button"
            class="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl transition-colors text-left"
            :class="
              option.type === modelValue
                ? 'bg-primary/10'
                : 'hover:bg-surface-light dark:hover:bg-surface-dark'
            "
            @click="pick(option.type)"
          >
            <IconBadge :icon="option.icon" :color="option.color" />
            <span
              class="flex-1 text-sm font-medium"
              :class="
                option.type === modelValue
                  ? 'text-primary'
                  : 'text-text-primary-light dark:text-text-primary-dark'
              "
            >
              {{ option.label }}
            </span>
            <UIcon v-if="option.type === modelValue" name="check" size="sm" class="text-primary" />
          </button>
        </div>
      </DrawerContent>
    </DrawerPortal>
  </DrawerRoot>
</template>
