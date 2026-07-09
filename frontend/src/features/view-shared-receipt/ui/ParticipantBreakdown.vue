<script setup lang="ts">
import { ref } from 'vue';
import { UIcon, InitialAvatar } from '@/shared/ui';
import { formatCurrency } from '@/shared/lib/format/currency';
import { pluralize } from '@/shared/lib/format/pluralize';
import { useHaptics } from '@/shared/lib/haptics';
import type { SharedReceiptParticipant } from '../api/sharedReceiptApi';

defineProps<{
  participants: SharedReceiptParticipant[];
  currency: string;
}>();

const { trigger } = useHaptics();

const expanded = ref<Set<string>>(new Set());

function toggle(name: string) {
  const next = new Set(expanded.value);
  if (next.has(name)) next.delete(name);
  else next.add(name);
  expanded.value = next;
  trigger('selection');
}
</script>

<template>
  <section aria-label="Кто сколько">
    <h2
      class="text-caption font-bold text-text-tertiary-light dark:text-text-tertiary-dark uppercase tracking-widest mb-2.5"
    >
      Кто сколько
    </h2>
    <div class="space-y-2">
      <div
        v-for="p in participants"
        :key="p.name"
        class="rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark overflow-hidden"
      >
        <button
          type="button"
          class="flex items-center gap-3 px-4 py-3 w-full text-left"
          :aria-expanded="expanded.has(p.name)"
          @click="toggle(p.name)"
        >
          <InitialAvatar :name="p.name" :color="p.color" size="md" translucent />
          <div class="flex-1 min-w-0">
            <p
              class="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark leading-tight truncate"
            >
              {{ p.name }}
            </p>
            <p class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark">
              {{ p.items.length }}
              {{ pluralize(p.items.length, 'позиция', 'позиции', 'позиций') }}
              <template v-if="p.paidByName">· платит {{ p.paidByName }}</template>
            </p>
          </div>
          <span class="text-base font-bold tabular-nums flex-shrink-0" :style="{ color: p.color }">
            {{ formatCurrency(p.total, currency) }}
          </span>
          <UIcon
            :name="expanded.has(p.name) ? 'expand_less' : 'expand_more'"
            size="xs"
            class="text-text-tertiary-light dark:text-text-tertiary-dark flex-shrink-0"
          />
        </button>

        <Transition name="expand">
          <div
            v-if="expanded.has(p.name)"
            class="border-t border-border-light dark:border-border-dark"
          >
            <div
              v-for="(item, idx) in p.items"
              :key="idx"
              class="flex items-center justify-between px-4 py-2.5"
              :class="
                idx < p.items.length - 1 &&
                'border-b border-border-light/50 dark:border-border-dark/50'
              "
            >
              <div class="flex-1 min-w-0 mr-3">
                <p class="text-sm text-text-primary-light dark:text-text-primary-dark truncate">
                  {{ item.name }}
                </p>
                <p
                  v-if="item.sharedWith > 1"
                  class="text-caption text-text-tertiary-light dark:text-text-tertiary-dark"
                >
                  1/{{ item.sharedWith }} от {{ formatCurrency(item.lineTotal, currency) }}
                </p>
              </div>
              <span
                class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark tabular-nums"
              >
                {{ formatCurrency(item.share, currency) }}
              </span>
            </div>
            <p
              v-if="p.items.length === 0"
              class="px-4 py-3 text-caption text-text-tertiary-light dark:text-text-tertiary-dark"
            >
              Без позиций
            </p>
          </div>
        </Transition>
      </div>
    </div>
  </section>
</template>

<style scoped>
.expand-enter-active,
.expand-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}
.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
}
.expand-enter-to,
.expand-leave-from {
  max-height: 600px;
}

@media (prefers-reduced-motion: reduce) {
  .expand-enter-active,
  .expand-leave-active {
    transition: opacity 0.15s ease !important;
  }
}
</style>
