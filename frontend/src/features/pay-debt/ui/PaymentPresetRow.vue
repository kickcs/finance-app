<script setup lang="ts">
import { computed } from 'vue';
import { useHaptics } from '@/shared/lib/haptics';

/**
 * Ряд быстрых сумм платежа: половина, всё, простить.
 *
 * Шторка одного платежа и шторка закрытия всех долгов человека держали его
 * дословной копией — вплоть до классов активного состояния. Отличались они
 * только тем, от какого итога считается «половина», и тем, что при смешанных
 * валютах половину предложить не от чего.
 */
const props = withDefaults(
  defineProps<{
    /** Итог, от которого считаются «половина» и «всё». */
    total: number;
    disabled?: boolean;
    /** При смешанных валютах половину считать не от чего. */
    showHalf?: boolean;
    /** Префикс `data-testid`: две шторки живут в разметке одной страницы. */
    idPrefix?: string;
  }>(),
  { showHalf: true, idPrefix: 'preset' },
);

const amount = defineModel<number>('amount', { required: true });
const forgiveRemainder = defineModel<boolean>('forgiveRemainder', { required: true });

const { trigger } = useHaptics();

const halfAmount = computed(() => Math.round(props.total / 2));

const presets = computed(() => [
  {
    key: 'half',
    label: 'Половина',
    show: props.showHalf,
    active: amount.value === halfAmount.value && !forgiveRemainder.value,
    apply: () => set(halfAmount.value, false),
  },
  {
    key: 'all',
    label: 'Всё',
    show: true,
    active: amount.value === props.total && !forgiveRemainder.value,
    apply: () => set(props.total, false),
  },
  {
    key: 'forgive',
    label: 'Простить',
    show: true,
    active: amount.value === 0 && forgiveRemainder.value,
    apply: () => set(0, true),
  },
]);

function set(next: number, forgive: boolean) {
  trigger('selection');
  amount.value = next;
  forgiveRemainder.value = forgive;
}
</script>

<template>
  <div class="flex justify-center gap-2">
    <template v-for="preset in presets" :key="preset.key">
      <button
        v-if="preset.show"
        type="button"
        :data-testid="`${idPrefix}-${preset.key}`"
        :disabled="disabled"
        :class="[
          'px-3.5 py-1.5 rounded-lg text-sm font-medium border transition-colors',
          preset.active
            ? 'border-primary bg-primary/10 text-primary'
            : 'border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark hover:text-text-primary-light dark:hover:text-text-primary-dark',
        ]"
        @click="preset.apply()"
      >
        {{ preset.label }}
      </button>
    </template>
  </div>
</template>
