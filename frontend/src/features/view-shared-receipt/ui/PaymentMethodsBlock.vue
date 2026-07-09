<script setup lang="ts">
import { UIcon, useToast } from '@/shared/ui';
import { useHaptics } from '@/shared/lib/haptics';

defineProps<{
  methods: { label: string; value: string }[];
}>();

const { toast } = useToast();
const { trigger } = useHaptics();

async function copyValue(method: { label: string; value: string }) {
  try {
    await navigator.clipboard.writeText(method.value);
    trigger('success');
    toast({ title: 'Скопировано', description: method.label });
  } catch {
    toast({ title: 'Не удалось скопировать', variant: 'error' });
  }
}
</script>

<template>
  <section v-if="methods.length > 0" aria-label="Куда переводить">
    <h2
      class="text-caption font-bold text-text-tertiary-light dark:text-text-tertiary-dark uppercase tracking-widest mb-2.5"
    >
      Куда переводить
    </h2>
    <div class="space-y-2">
      <button
        v-for="method in methods"
        :key="method.label + method.value"
        type="button"
        :aria-label="`Копировать: ${method.label}`"
        class="flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark text-left active:scale-[0.99] transition-transform"
        @click="copyValue(method)"
      >
        <div class="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <UIcon name="credit_card" size="sm" class="text-primary" />
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark">
            {{ method.label }}
          </p>
          <p
            class="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark tabular-nums truncate"
          >
            {{ method.value }}
          </p>
        </div>
        <span class="flex items-center gap-1 text-caption font-medium text-primary shrink-0">
          <UIcon name="content_copy" size="xs" />
          Копировать
        </span>
      </button>
    </div>
  </section>
</template>
