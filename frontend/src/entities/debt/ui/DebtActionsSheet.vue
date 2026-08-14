<script setup lang="ts">
import { UOverlay } from '@/shared/ui/overlay';
import { UIcon, UToggle } from '@/shared/ui';
import { useHaptics } from '@/shared/lib/haptics';
import type { Debt } from '../model/types';

/**
 * Действия долга одной шторкой вместо выпадающего меню.
 *
 * Меню было выпадашкой поверх контента, и его приходилось учить закрываться по
 * клику вне и по Escape — в двух местах по-разному (страница и десктопная
 * панель). Шторка всё это умеет сама, а заодно у закрытого долга те же два
 * действия больше не дублируются отдельной карточкой внизу страницы.
 */
defineProps<{
  modelValue: boolean;
  debt: Debt;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  delete: [];
  'toggle-private': [value: boolean];
}>();

const { trigger } = useHaptics();

function handleTogglePrivate(value: boolean) {
  trigger('selection');
  emit('toggle-private', value);
}

function handleDelete() {
  trigger('selection');
  emit('update:modelValue', false);
  emit('delete');
}
</script>

<template>
  <UOverlay
    :model-value="modelValue"
    title="Действия"
    desktop="dialog"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div data-testid="debt-actions-sheet" class="space-y-1">
      <!-- Не кнопка: строка целиком не кликается, потому что переключатель
           здесь и есть управление — тап мимо него не должен ничего менять -->
      <div class="flex items-center justify-between gap-4 rounded-xl px-3 py-3">
        <span class="flex items-center gap-3">
          <UIcon
            name="visibility_off"
            size="sm"
            class="text-text-tertiary-light dark:text-text-tertiary-dark"
          />
          <span class="text-body-sm text-text-primary-light dark:text-text-primary-dark">
            Скрыть сумму
          </span>
        </span>
        <UToggle :model-value="debt.is_private" @update:model-value="handleTogglePrivate" />
      </div>

      <button
        type="button"
        data-testid="delete-debt-btn"
        class="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-body-sm text-danger transition-colors hover:bg-surface-light dark:hover:bg-surface-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
        @click="handleDelete"
      >
        <UIcon name="delete" size="sm" />
        Удалить долг
      </button>
    </div>
  </UOverlay>
</template>
