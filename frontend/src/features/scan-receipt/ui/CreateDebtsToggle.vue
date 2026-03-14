<script setup lang="ts">
import { UIcon } from '@/shared/ui';
import { pluralize } from '@/shared/lib/format/pluralize';

defineProps<{
  modelValue: boolean;
  debtCount: number;
}>();

defineEmits<{
  'update:modelValue': [value: boolean];
}>();
</script>

<template>
  <section class="mt-6 mb-2">
    <button
      v-if="debtCount > 0"
      type="button"
      role="switch"
      :aria-checked="modelValue"
      class="flex items-center justify-between w-full p-4 rounded-2xl bg-surface-light dark:bg-surface-dark border-2 border-transparent transition-all drop-shadow-sm outline-none active:scale-[0.98]"
      :class="modelValue && 'border-primary/30 ring-4 ring-primary/5 bg-primary/[0.03]'"
      @click="$emit('update:modelValue', !modelValue)"
    >
      <div class="flex items-center gap-4">
        <div
          class="w-12 h-12 rounded-full flex items-center justify-center transition-colors shadow-sm"
          :class="
            modelValue
              ? 'bg-primary text-white shadow-primary/30'
              : 'bg-card-light dark:bg-card-dark text-text-tertiary-light dark:text-text-tertiary-dark border border-border-light dark:border-border-dark'
          "
        >
          <UIcon name="group" size="md" />
        </div>
        <div class="text-left">
          <p
            class="text-base font-bold text-text-primary-light dark:text-text-primary-dark tracking-tight"
          >
            Создать долги
          </p>
          <p
            class="text-xs font-medium text-text-tertiary-light dark:text-text-tertiary-dark mt-0.5"
          >
            Вернуть деньги с {{ debtCount }}
            {{ pluralize(debtCount, 'человека', 'человек', 'человек') }}
          </p>
        </div>
      </div>
      <!-- iOS Style Toggle -->
      <div
        class="w-14 h-8 rounded-full transition-colors duration-300 relative flex-shrink-0 shadow-inner"
        :class="modelValue ? 'bg-primary' : 'bg-border-light dark:bg-border-dark'"
      >
        <div
          class="absolute w-6 h-6 bg-white rounded-full top-[4px] shadow-sm transition-transform duration-300 ease-in-out"
          :class="modelValue ? 'translate-x-[28px]' : 'translate-x-[4px]'"
        />
      </div>
    </button>

    <!-- What will be created -->
    <div class="flex items-center justify-center gap-2 mt-3 mb-2 opacity-70">
      <UIcon
        name="info"
        size="xs"
        class="text-text-tertiary-light dark:text-text-tertiary-dark flex-shrink-0"
      />
      <span class="text-xs text-text-secondary-light dark:text-text-secondary-dark font-medium">
        Будет создана 1 транзакция
        <template v-if="modelValue && debtCount > 0">
          и {{ debtCount }} {{ pluralize(debtCount, 'долг', 'долга', 'долгов') }}
        </template>
      </span>
    </div>
  </section>
</template>
