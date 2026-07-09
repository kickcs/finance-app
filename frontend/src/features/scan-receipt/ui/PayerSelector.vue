<script setup lang="ts">
import { computed } from 'vue';
import { UIcon } from '@/shared/ui';
import { cn } from '@/shared/lib/utils';
import { useHaptics } from '@/shared/lib/haptics';
import type { Participant } from '../model/types';

const props = defineProps<{
  participants: Participant[];
  payerId: string | null;
  /** Telegram-import: платил всегда «Я», выбор заблокирован */
  locked?: boolean;
}>();

const emit = defineEmits<{
  'update:payerId': [value: string | null];
}>();

const { trigger } = useHaptics();

// Кандидаты: не «Я» и платящие сами за себя
const candidates = computed(() => props.participants.filter((p) => !p.isMe && !p.paidById));

function select(id: string | null) {
  if (props.locked || id === props.payerId) return;
  trigger('selection');
  emit('update:payerId', id);
}
</script>

<template>
  <section v-if="candidates.length > 0" aria-label="Кто платил" class="mt-6">
    <h2
      class="text-caption font-bold text-text-tertiary-light dark:text-text-tertiary-dark uppercase tracking-widest mb-2 ml-4"
    >
      Кто платил
    </h2>

    <div
      class="bg-surface-light dark:bg-surface-dark rounded-2xl drop-shadow-sm border border-border-light/50 dark:border-border-dark/50 px-4 py-3"
    >
      <div class="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Плательщик по чеку">
        <button
          type="button"
          role="radio"
          :aria-checked="payerId === null"
          :disabled="locked"
          :class="
            cn(
              'px-3.5 py-2 rounded-full text-sm font-medium transition-all active:scale-95',
              payerId === null
                ? 'bg-primary text-white'
                : 'bg-card-light dark:bg-card-dark text-text-secondary-light dark:text-text-secondary-dark border border-border-light dark:border-border-dark',
              locked && 'opacity-60',
            )
          "
          @click="select(null)"
        >
          Я
        </button>
        <button
          v-for="p in candidates"
          :key="p.id"
          type="button"
          role="radio"
          :aria-checked="payerId === p.id"
          :disabled="locked"
          :class="
            cn(
              'px-3.5 py-2 rounded-full text-sm font-medium transition-all active:scale-95',
              payerId === p.id
                ? 'text-white'
                : 'bg-card-light dark:bg-card-dark text-text-secondary-light dark:text-text-secondary-dark border border-border-light dark:border-border-dark',
              locked && 'opacity-60',
            )
          "
          :style="payerId === p.id ? { backgroundColor: p.color } : {}"
          @click="select(p.id)"
        >
          {{ p.name }}
        </button>
      </div>

      <p
        v-if="locked"
        class="flex items-center gap-1.5 mt-2 text-caption text-text-tertiary-light dark:text-text-tertiary-dark"
      >
        <UIcon name="info" size="xs" class="shrink-0" />
        Чек привязан к операции по вашему счёту — платили вы
      </p>
      <p
        v-else-if="payerId !== null"
        class="flex items-center gap-1.5 mt-2 text-caption text-text-tertiary-light dark:text-text-tertiary-dark"
      >
        <UIcon name="info" size="xs" class="shrink-0" />
        Трата не запишется — вместо неё появится ваш долг плательщику
      </p>
    </div>
  </section>
</template>
