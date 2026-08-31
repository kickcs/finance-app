<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue';
import { UInput, UButton, UIcon, ToggleRow, UOverlay } from '@/shared/ui';
import { DatePickerField } from '@/shared/ui/date-picker';
import { DueDateField, DebtDirectionPill, useDebts, type Debt } from '@/entities/debt';
import { PersonPicker, usePeople } from '@/entities/person';
import { AccountSelector, useAccounts } from '@/entities/account';
import { getCurrencySymbol } from '@/shared/lib/format/currency';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import { useEditDebt } from '../model/useEditDebt';

const props = defineProps<{
  modelValue: boolean;
  debt: Debt | null;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  saved: [];
}>();

const { userId } = useCurrentUser();
// Шторка висит в разметке страницы всегда, поэтому её справочники читаются
// только пока она открыта: композаблы сами отключаются на пустом userId.
const openUserId = computed(() => (props.modelValue ? userId.value : null));
const { accounts } = useAccounts(openUserId);
const { people, createPerson } = usePeople(openUserId);
// Долги — сигнал частоты для порядка людей; запрос уже прогрет списком.
const { debts } = useDebts(openUserId, { status: 'active' });
const {
  formData,
  isValid,
  isDirty,
  isSubmitting,
  warnings,
  canChangeDirection,
  canChangeFee,
  updateField,
  submit,
  reset,
} = useEditDebt(() => props.debt, userId);

const open = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
});

// Календарь портируется внутрь шторки: в портале на body тап по нему читается
// как клик снаружи, и vaul закрывает шторку вместе с выбором даты.
const overlayRef = ref<{ contentEl?: HTMLElement | null } | null>(null);
const datePortalTarget = computed<HTMLElement | null>(() => overlayRef.value?.contentEl ?? null);

watch(open, (isOpen) => {
  if (!isOpen) nextTick(() => reset());
});

const currencySymbol = computed(() => (props.debt ? getCurrencySymbol(props.debt.currency) : ''));

async function handleSubmit() {
  if (await submit()) {
    emit('saved');
    open.value = false;
  }
}
</script>

<template>
  <UOverlay ref="overlayRef" v-model="open" title="Редактировать долг">
    <div class="space-y-5">
      <div class="flex w-full flex-col gap-1.5">
        <span
          class="ml-0.5 text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark"
        >
          Направление
        </span>
        <DebtDirectionPill
          v-if="canChangeDirection"
          :model-value="formData.debt_type"
          @update:model-value="updateField('debt_type', $event)"
        />
        <p
          v-else
          class="rounded-xl bg-surface-light px-3 py-2.5 text-sm text-text-secondary-light dark:bg-surface-dark dark:text-text-secondary-dark"
        >
          {{ formData.debt_type === 'given' ? 'Дал в долг' : 'Взял в долг' }} — сменить нельзя, по
          долгу уже есть платежи
        </p>
      </div>

      <PersonPicker
        :people="people"
        :debts="debts"
        :selected="formData.person_name"
        label="Кому / от кого"
        @select="updateField('person_name', $event)"
        @create="(name: string) => createPerson({ name })"
      />

      <UInput
        :model-value="String(formData.amount || '')"
        label="Общая сумма"
        placeholder="0"
        variant="currency"
        type="number"
        :suffix="currencySymbol"
        @update:model-value="updateField('amount', Number($event) || 0)"
      />

      <div class="flex w-full flex-col gap-1.5">
        <span
          class="ml-0.5 text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark"
        >
          Дата долга
        </span>
        <DatePickerField
          :model-value="formData.date"
          aria-label="Дата долга"
          :portal-to="datePortalTarget"
          @update:model-value="(value: string | null) => value && updateField('date', value)"
        />
      </div>

      <AccountSelector
        v-if="accounts.length"
        label="Счёт"
        :accounts="accounts"
        :selected-id="formData.account_id"
        @select="updateField('account_id', $event)"
      />

      <!-- Комиссия правится только там, где за ней стоит своя запись: у долгов
           постарше её расход не найти, и число разошлось бы с деньгами. -->
      <UInput
        v-if="canChangeFee"
        :model-value="String(formData.fee || '')"
        label="Комиссия за перевод"
        placeholder="0"
        variant="currency"
        type="number"
        :suffix="currencySymbol"
        data-testid="edit-debt-fee-input"
        @update:model-value="updateField('fee', Number($event) || 0)"
      />

      <DueDateField
        :model-value="formData.due_date"
        @update:model-value="updateField('due_date', $event)"
      />

      <UInput
        :model-value="formData.description"
        label="Описание"
        placeholder="Описание..."
        @update:model-value="updateField('description', String($event))"
      />

      <div
        v-for="(warning, idx) in warnings"
        :key="idx"
        class="rounded-lg border border-warning/20 bg-warning-light p-2.5"
      >
        <div class="flex gap-1.5">
          <UIcon name="warning" size="xs" class="mt-0.5 shrink-0 text-warning" />
          <p class="text-xs text-warning">{{ warning }}</p>
        </div>
      </div>

      <ToggleRow
        :model-value="formData.is_private"
        title="Приватный"
        description="Скрыть долг из общего списка"
        @update:model-value="updateField('is_private', $event)"
      />
    </div>

    <template #footer>
      <UButton
        type="button"
        variant="primary"
        size="xl"
        full-width
        :loading="isSubmitting"
        :disabled="!isValid || !isDirty"
        @click="handleSubmit"
      >
        Сохранить
      </UButton>
    </template>
  </UOverlay>
</template>
