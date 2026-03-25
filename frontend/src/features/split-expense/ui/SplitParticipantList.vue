<!-- frontend/src/features/split-expense/ui/SplitParticipantList.vue -->
<script setup lang="ts">
import { ref } from 'vue';
import { UInput, UButton, UIcon, InitialAvatar } from '@/shared/ui';
import { formatCurrency } from '@/shared/lib/format/currency';
import type { SplitParticipantView } from '../model/useSplitTransactionEdit';

defineProps<{
  participants: SplitParticipantView[];
  myShare: number;
  currency: string;
  editable?: boolean;
}>();

const emit = defineEmits<{
  'update-amount': [debtId: string, amount: number];
  'update-name': [debtId: string, name: string];
  remove: [debtId: string];
  add: [name: string, amount: number];
}>();

const newName = ref('');
const newAmount = ref(0);

function handleAdd() {
  if (!newName.value.trim() || newAmount.value <= 0) return;
  emit('add', newName.value.trim(), newAmount.value);
  newName.value = '';
  newAmount.value = 0;
}
</script>

<template>
  <div class="space-y-2">
    <!-- Header -->
    <div class="flex items-center justify-between mb-2">
      <div class="flex items-center gap-2">
        <UIcon
          name="group"
          size="sm"
          class="text-text-secondary-light dark:text-text-secondary-dark"
        />
        <span class="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
          Разделение расхода
        </span>
      </div>
      <span class="text-xs text-accent-green bg-accent-green/10 px-2 py-0.5 rounded-md">
        {{ participants.length + 1 }} участн.
      </span>
    </div>

    <!-- My Share -->
    <div
      class="flex items-center justify-between p-2.5 rounded-lg bg-surface-secondary-light dark:bg-surface-secondary-dark"
    >
      <div class="flex items-center gap-2">
        <div
          class="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-xs text-white font-medium"
        >
          Я
        </div>
        <span class="text-sm text-text-primary-light dark:text-text-primary-dark">Моя доля</span>
      </div>
      <span class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
        {{ formatCurrency(myShare, currency) }}
      </span>
    </div>

    <!-- Participant rows -->
    <div
      v-for="p in participants"
      :key="p.debtId"
      class="flex items-center justify-between p-2.5 rounded-lg bg-surface-secondary-light dark:bg-surface-secondary-dark"
    >
      <div class="flex items-center gap-2 min-w-0 flex-1">
        <InitialAvatar :name="p.personName" color="#3b82f6" size="sm" />
        <div class="min-w-0">
          <div class="text-sm text-text-primary-light dark:text-text-primary-dark truncate">
            {{ p.personName }}
          </div>
          <div v-if="p.hasPayments" class="text-[11px] text-warning">
            Оплачено {{ formatCurrency(p.paidAmount, currency) }} /
            {{ formatCurrency(p.amount, currency) }}
          </div>
          <div
            v-else-if="p.isClosed"
            class="text-[11px] text-text-tertiary-light dark:text-text-tertiary-dark"
          >
            Закрыт
          </div>
          <div v-else class="text-[11px] text-accent-green">Не оплачено</div>
        </div>
      </div>

      <div class="flex items-center gap-1.5 shrink-0">
        <!-- Amount: editable or display -->
        <template v-if="editable && !p.isLocked">
          <input
            :value="p.amount"
            type="number"
            class="w-20 text-right text-sm font-medium bg-transparent border-b border-border-light dark:border-border-dark text-text-primary-light dark:text-text-primary-dark outline-none px-1 py-0.5"
            @input="
              emit(
                'update-amount',
                p.debtId,
                Number(($event.target as HTMLInputElement).value) || 0,
              )
            "
          />
          <button
            class="w-6 h-6 flex items-center justify-center rounded-full hover:bg-danger/10 transition-colors"
            @click="emit('remove', p.debtId)"
          >
            <UIcon name="close" size="xs" class="text-danger" />
          </button>
        </template>
        <template v-else>
          <span class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
            {{ formatCurrency(p.amount, currency) }}
          </span>
          <UIcon
            v-if="p.isLocked"
            name="lock"
            size="xs"
            class="text-text-tertiary-light dark:text-text-tertiary-dark"
          />
        </template>
      </div>
    </div>

    <!-- Warning for locked participants -->
    <div
      v-if="participants.some((p) => p.isLocked)"
      class="p-2 rounded-lg bg-warning-light border border-warning/20"
    >
      <div class="flex gap-1.5">
        <UIcon name="info" size="xs" class="text-warning shrink-0 mt-0.5" />
        <p class="text-[11px] text-warning leading-relaxed">
          Участники с платежами заблокированы для редактирования
        </p>
      </div>
    </div>

    <!-- Add participant -->
    <div v-if="editable" class="flex gap-2 pt-1">
      <UInput v-model="newName" placeholder="Имя" class="flex-1" @keyup.enter="handleAdd" />
      <input
        v-model.number="newAmount"
        type="number"
        placeholder="Сумма"
        class="w-24 text-sm px-2.5 py-2 rounded-lg border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark text-text-primary-light dark:text-text-primary-dark outline-none"
        @keyup.enter="handleAdd"
      />
      <UButton
        variant="secondary"
        size="sm"
        :disabled="!newName.trim() || newAmount <= 0"
        @click="handleAdd"
      >
        <UIcon name="add" size="xs" />
      </UButton>
    </div>
  </div>
</template>
