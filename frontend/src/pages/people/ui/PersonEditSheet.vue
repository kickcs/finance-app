<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { UOverlay } from '@/shared/ui/overlay';
import { UButton, UIcon, UInput, UColorPicker } from '@/shared/ui';
import { ENTITY_COLORS } from '@/shared/config/colors';
import { formatCurrency, COMPACT_FORMAT } from '@/shared/lib/format/currency';
import { pluralize } from '@/shared/lib/format/pluralize';
import type { Person } from '@/entities/person';
import type { PersonDebtSummary } from '@/entities/debt';

const props = defineProps<{
  open: boolean;
  person: Person | null;
  debtNet?: PersonDebtSummary;
  currency: string;
  saving?: boolean;
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
  save: [payload: { name: string; color: string }];
  delete: [];
}>();

const name = ref('');
const color = ref<string>(ENTITY_COLORS[0]);

// Синхронизируемся и на открытии, и на смене контакта — иначе при переходе с
// одного человека на другого в поле оставалось прежнее имя. Пустой person
// игнорируем: на закрытии он обнуляется, и форма схлопнулась бы на глазах.
watch(
  () => [props.open, props.person?.id] as const,
  ([isOpen]) => {
    if (!isOpen || !props.person) return;
    name.value = props.person.name;
    color.value = props.person.color;
  },
  { immediate: true },
);

const title = computed(() => props.person?.name || 'Контакт');
const canSave = computed(() => name.value.trim().length > 0);

const debtLabel = computed(() => {
  const net = props.debtNet;
  if (!net || net.net === 0) return null;
  const count = `${net.debtCount} ${pluralize(net.debtCount, 'долг', 'долга', 'долгов')}`;
  const direction = net.net > 0 ? 'вам должны' : 'вы должны';
  const sum = formatCurrency(Math.abs(net.net), props.currency, COMPACT_FORMAT);
  return { count, direction, sum, positive: net.net > 0 };
});

function handleSave() {
  if (!canSave.value) return;
  emit('save', { name: name.value.trim(), color: color.value });
}
</script>

<template>
  <UOverlay
    :model-value="open"
    :title="title"
    fill
    @update:model-value="emit('update:open', $event)"
  >
    <template #action>
      <UButton
        data-testid="save-person-btn"
        variant="primary"
        size="sm"
        :loading="saving"
        :disabled="!canSave"
        @click="handleSave"
      >
        Сохранить
      </UButton>
    </template>

    <div class="space-y-4">
      <UInput
        v-model="name"
        data-testid="person-name-input"
        label="Имя"
        placeholder="Например: Аня, Коля…"
        @keydown="(e: KeyboardEvent) => e.key === 'Enter' && handleSave()"
      />

      <UColorPicker v-model="color" :colors="ENTITY_COLORS" label="Цвет аватара" />

      <RouterLink
        v-if="debtLabel"
        to="/debts"
        data-testid="person-debts-link"
        class="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-surface-light dark:bg-surface-dark transition-colors"
      >
        <span
          class="flex-1 min-w-0 text-body-sm text-text-secondary-light dark:text-text-secondary-dark truncate"
        >
          {{ debtLabel.count }} · {{ debtLabel.direction }}
        </span>
        <span
          class="shrink-0 text-body-sm font-semibold tabular-nums"
          :class="debtLabel.positive ? 'text-success' : 'text-danger'"
        >
          {{ debtLabel.sum }}
        </span>
        <UIcon
          name="chevron_right"
          size="sm"
          class="shrink-0 text-text-tertiary-light dark:text-text-tertiary-dark"
        />
      </RouterLink>
    </div>

    <template #footer>
      <UButton
        data-testid="delete-person-btn"
        variant="secondary"
        size="lg"
        full-width
        class="text-danger"
        aria-label="Удалить контакт"
        @click="emit('delete')"
      >
        <UIcon name="delete" size="sm" />
        Удалить контакт
      </UButton>
    </template>
  </UOverlay>
</template>
