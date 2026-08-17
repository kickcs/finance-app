<script setup lang="ts">
import { useToast, type ToasterToast, type ToastVariant } from '@/shared/lib/composables/useToast';
import { UIcon } from '@/shared/ui/icon';
import Toast from './Toast.vue';
import ToastClose from './ToastClose.vue';
import ToastDescription from './ToastDescription.vue';
import ToastTitle from './ToastTitle.vue';
import ToastAction from './ToastAction.vue';
import ToastViewport from './ToastViewport.vue';
import TransactionSuccessToast from './TransactionSuccessToast.vue';
import { useToastPosition } from './useToastPosition';

const { toasts, dismiss, toast: showToast } = useToast();
const position = useToastPosition();

const variantIcons: Record<string, string> = {
  default: 'info',
  success: 'check_circle',
  error: 'error',
  warning: 'warning',
  undo: 'undo',
};

const variantIconClasses: Record<string, string> = {
  success: 'bg-success-light text-success',
  error: 'bg-danger-light text-danger',
  warning: 'bg-warning-light text-warning',
  undo: 'bg-primary-light text-primary dark:text-primary-hover',
};

const variantProgressClasses: Record<ToastVariant, string> = {
  default: 'bg-primary',
  success: 'bg-success',
  error: 'bg-danger',
  warning: 'bg-warning',
  undo: 'bg-primary',
  'transaction-success': 'bg-success',
};

// Тост с действием тапом не закрываем: попадание мимо кнопки — промах, а не
// намерение. Обновление PWA предлагается один раз за сессию, и случайный тап
// по карточке лишил бы пользователя единственной кнопки «Обновить».
function handleCardClick(t: ToasterToast) {
  if (t.action) return;
  dismiss(t.id);
}

function handleTransactionUndo(t: ToasterToast) {
  dismiss(t.id);
  if (t.transactionData?.onUndo) {
    t.transactionData.onUndo();
  }
  showToast({
    title: 'Отменено',
    description: 'Транзакция удалена',
    variant: 'undo',
    duration: 2000,
  });
}
</script>

<template>
  <ToastViewport :position="position">
    <!-- Тап в любое место карточки закрывает её: крестик — подсказка, а не
         единственная мишень. Кнопки внутри гасят всплытие сами. -->
    <Toast
      v-for="t in toasts"
      :key="t.id"
      :variant="t.variant ?? 'default'"
      :open="t.open"
      :duration="t.duration"
      :position="position"
      class="group relative overflow-hidden"
      @click="handleCardClick(t)"
      @update:open="(open: boolean) => !open && dismiss(t.id)"
    >
      <TransactionSuccessToast
        v-if="t.variant === 'transaction-success' && t.transactionData"
        :data="t.transactionData"
        :compact="position === 'top'"
        @undo="handleTransactionUndo(t)"
      />

      <template v-else>
        <!-- Icon in tinted badge -->
        <div
          v-if="t.variant && t.variant in variantIconClasses"
          class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full"
          :class="variantIconClasses[t.variant]"
        >
          <UIcon :name="variantIcons[t.variant]" size="xs" filled />
        </div>

        <div class="min-w-0 flex-1">
          <ToastTitle v-if="t.title" class="text-[0.8125rem] font-medium leading-tight">
            {{ t.title }}
          </ToastTitle>
          <ToastDescription
            v-if="t.description"
            class="text-[0.75rem] opacity-80 leading-tight mt-0.5"
          >
            {{ t.description }}
          </ToastDescription>
        </div>

        <ToastAction v-if="t.action" :alt-text="t.action.label" @click.stop="t.action.onClick">
          {{ t.action.label }}
        </ToastAction>
      </template>

      <ToastClose @click.stop />

      <!-- Progress bar -->
      <div class="absolute bottom-0 left-0 h-[2px] w-full bg-black/5 dark:bg-white/10">
        <div
          class="h-full w-full origin-left"
          :class="variantProgressClasses[t.variant ?? 'default']"
          :style="{ animation: `shrink ${t.duration}ms linear forwards` }"
        />
      </div>
    </Toast>
  </ToastViewport>
</template>

<style>
@keyframes shrink {
  from {
    transform: scaleX(1);
  }
  to {
    transform: scaleX(0);
  }
}
</style>
