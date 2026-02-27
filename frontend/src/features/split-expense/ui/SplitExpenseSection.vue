<script setup lang="ts">
import { ref, computed } from 'vue';
import { UInput, UIcon, UProgressBar, InitialAvatar } from '@/shared/ui';
import { formatCurrency, formatNumberWithSpaces } from '@/shared/lib/format/currency';
import { listTransition } from '@/shared/lib/transitions';
import { getCurrencyByCode } from '@/entities/currency';
import { PersonSelector, usePeople } from '@/entities/person';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import type { SplitExpenseData, SplitMethod } from '../model/types';

const props = defineProps<{
  totalAmount: number;
  currency: string;
  splitData: SplitExpenseData;
  validationError?: string | null;
}>();
const emit = defineEmits<{
  'update:splitData': [value: SplitExpenseData];
  addParticipant: [name: string, fromContacts: boolean, personColor?: string];
  removeParticipant: [id: string];
  updateParticipantAmount: [id: string, amount: number];
  updateParticipantName: [id: string, name: string];
  setMethod: [method: SplitMethod];
  setMyShare: [amount: number];
  setIsIncluded: [included: boolean];
  setEnabled: [enabled: boolean];
}>();
const { userId } = useCurrentUser();
const { people, createPerson } = usePeople(userId);

const newParticipantName = ref('');

const availablePeople = computed(() => {
  const addedNames = new Set(props.splitData.participants.map((p) => p.personName.toLowerCase()));
  return people.value.filter((p) => !addedNames.has(p.name.toLowerCase()));
});

const currencySymbol = computed(() => {
  const currency = getCurrencyByCode(props.currency);
  return currency?.symbol || props.currency;
});

const totalToReturn = computed(() => {
  return props.splitData.participants.reduce((sum, p) => sum + p.amount, 0);
});

const progressColor = computed(() => {
  const totalSplit = props.splitData.myShare + totalToReturn.value;
  if (totalSplit > props.totalAmount + 1) return 'danger';
  if (totalSplit >= props.totalAmount - 1) return 'success';
  return 'primary';
});

function handleAddParticipant(name?: string) {
  const participantName = (typeof name === 'string' ? name : newParticipantName.value).trim();
  if (participantName) {
    const matchedPerson = people.value.find(
      (p) => p.name.toLowerCase() === participantName.toLowerCase(),
    );
    emit('addParticipant', participantName, !!matchedPerson, matchedPerson?.color);
    newParticipantName.value = '';
  }
}

function handleToggle() {
  emit('setEnabled', !props.splitData.enabled);
}
</script>

<template>
  <div class="space-y-3">
    <!-- Toggle -->
    <button
      type="button"
      role="switch"
      :aria-checked="splitData.enabled"
      aria-label="Разделить расход"
      class="flex items-center justify-between w-full px-4 py-3 rounded-xl bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark transition-all"
      :class="splitData.enabled && 'border-primary bg-primary/5'"
      @click="handleToggle"
    >
      <div class="flex items-center gap-3">
        <div
          class="w-10 h-10 rounded-full flex items-center justify-center"
          :class="
            splitData.enabled
              ? 'bg-primary/20 text-primary'
              : 'bg-surface-light dark:bg-surface-dark text-text-secondary-light dark:text-text-secondary-dark'
          "
        >
          <UIcon name="group" size="sm" />
        </div>
        <div class="text-left">
          <p class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
            Разделить расход
          </p>
          <p class="text-xs text-text-secondary-light dark:text-text-secondary-dark">
            Создать долги от друзей
          </p>
        </div>
      </div>
      <div
        class="w-12 h-7 rounded-full transition-all relative"
        :class="splitData.enabled ? 'bg-primary' : 'bg-border-light dark:bg-border-dark'"
      >
        <div
          class="absolute w-5 h-5 bg-white rounded-full top-1 transition-all shadow-sm"
          :class="splitData.enabled ? 'right-1' : 'left-1'"
        />
      </div>
    </button>

    <!-- Split Options (shown when enabled) -->
    <div
      v-if="splitData.enabled"
      class="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200"
    >
      <!-- Method selector -->
      <div class="flex gap-2">
        <button
          type="button"
          class="flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all"
          :class="
            splitData.method === 'equal'
              ? 'bg-primary text-white'
              : 'bg-surface-light dark:bg-surface-dark text-text-secondary-light dark:text-text-secondary-dark'
          "
          @click="$emit('setMethod', 'equal')"
        >
          Поровну
        </button>
        <button
          type="button"
          class="flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all"
          :class="
            splitData.method === 'custom'
              ? 'bg-primary text-white'
              : 'bg-surface-light dark:bg-surface-dark text-text-secondary-light dark:text-text-secondary-dark'
          "
          @click="$emit('setMethod', 'custom')"
        >
          Указать суммы
        </button>
      </div>

      <!-- My share & Toggle participation -->
      <div class="space-y-3">
        <label class="flex items-center gap-2 cursor-pointer group relative">
          <div
            class="w-5 h-5 rounded border flex items-center justify-center transition-colors"
            :class="
              splitData.isIncluded
                ? 'bg-primary border-primary text-white'
                : 'border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark group-hover:border-primary'
            "
          >
            <UIcon v-if="splitData.isIncluded" name="check" size="xs" />
          </div>
          <span class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
            Я тоже участвую в расходе
          </span>
          <input
            type="checkbox"
            class="absolute opacity-0 w-0 h-0 overflow-hidden"
            :checked="splitData.isIncluded"
            @change="$emit('setIsIncluded', !splitData.isIncluded)"
          />
        </label>

        <div
          v-if="splitData.isIncluded"
          class="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200"
        >
          <label
            class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark"
          >
            Моя доля
          </label>
          <UInput
            :model-value="String(splitData.myShare || '')"
            placeholder="0"
            variant="currency"
            :suffix="currencySymbol"
            :disabled="splitData.method === 'equal'"
            @update:model-value="$emit('setMyShare', Number($event) || 0)"
            @keydown="(e: KeyboardEvent) => e.key === 'Enter' && e.preventDefault()"
          />
        </div>
      </div>

      <!-- Participants -->
      <div class="space-y-2">
        <label class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark">
          Участники (кто должен вернуть)
        </label>

        <!-- Participant list -->
        <TransitionGroup
          v-if="splitData.participants.length > 0"
          v-bind="listTransition"
          tag="div"
          class="space-y-2 relative"
        >
          <div
            v-for="participant in splitData.participants"
            :key="participant.id"
            class="flex items-center gap-2 p-2 rounded-lg bg-surface-light dark:bg-surface-dark"
          >
            <InitialAvatar
              :name="participant.personName"
              :color="participant.personColor || '#3b82f6'"
              size="md"
              translucent
            />
            <span
              v-if="participant.fromContacts"
              class="flex-1 min-w-0 text-sm font-medium text-text-primary-light dark:text-text-primary-dark truncate"
            >
              {{ participant.personName }}
            </span>
            <input
              v-else
              :value="participant.personName"
              type="text"
              class="flex-1 min-w-0 bg-transparent border-none outline-none text-sm text-text-primary-light dark:text-text-primary-dark"
              @input="
                $emit(
                  'updateParticipantName',
                  participant.id,
                  ($event.target as HTMLInputElement).value,
                )
              "
              @keydown.enter.prevent
            />
            <div
              class="flex items-center gap-1 justify-end"
              :class="splitData.method === 'custom' ? 'w-32' : 'w-auto'"
            >
              <template v-if="splitData.method === 'equal'">
                <span
                  class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark whitespace-nowrap"
                >
                  {{ formatCurrency(participant.amount, currency) }}
                </span>
              </template>
              <template v-else>
                <input
                  :value="participant.amount ? formatNumberWithSpaces(participant.amount) : ''"
                  type="text"
                  inputmode="decimal"
                  placeholder="0"
                  class="w-full text-right bg-transparent border-b border-border-light dark:border-border-dark focus:border-primary outline-none text-sm font-medium text-text-primary-light dark:text-text-primary-dark transition-colors pb-0.5"
                  @input="
                    $emit(
                      'updateParticipantAmount',
                      participant.id,
                      Number(($event.target as HTMLInputElement).value.replace(/\s/g, '')) || 0,
                    )
                  "
                  @keydown.enter.prevent
                />
                <span
                  class="text-xs text-text-secondary-light dark:text-text-secondary-dark flex-shrink-0"
                >
                  {{ currencySymbol }}
                </span>
              </template>
            </div>
            <button
              type="button"
              class="p-1 ml-1 text-text-tertiary-light dark:text-text-tertiary-dark hover:text-danger transition-colors"
              @click="$emit('removeParticipant', participant.id)"
            >
              <UIcon name="close" size="sm" />
            </button>
          </div>
        </TransitionGroup>

        <!-- Add participant -->
        <div class="mt-2">
          <PersonSelector
            v-model="newParticipantName"
            :people="availablePeople"
            placeholder="Имя участника"
            @select="handleAddParticipant"
            @save-person="(name: string) => createPerson({ name })"
          />
        </div>
      </div>

      <!-- Summary -->
      <div class="p-3 rounded-xl bg-surface-light dark:bg-surface-dark space-y-3">
        <div class="space-y-2">
          <div class="flex justify-between text-sm">
            <span class="text-text-secondary-light dark:text-text-secondary-dark">Общая сумма</span>
            <span class="font-medium text-text-primary-light dark:text-text-primary-dark">
              {{ formatCurrency(totalAmount, currency) }}
            </span>
          </div>
          <UProgressBar
            :value="splitData.myShare + totalToReturn"
            :max="totalAmount"
            :color="progressColor"
            size="sm"
          />
        </div>

        <div class="flex justify-between text-sm">
          <span class="text-text-secondary-light dark:text-text-secondary-dark">Моя доля</span>
          <span class="font-medium text-text-primary-light dark:text-text-primary-dark">
            {{ formatCurrency(splitData.myShare, currency) }}
          </span>
        </div>
        <div class="h-px bg-border-light dark:bg-border-dark" />
        <div class="flex justify-between text-sm">
          <span class="text-text-secondary-light dark:text-text-secondary-dark">
            К возврату ({{ splitData.participants.length }} чел.)
          </span>
          <span class="font-semibold text-primary">
            {{ formatCurrency(totalToReturn, currency) }}
          </span>
        </div>
      </div>

      <!-- Validation error or Info -->
      <p v-if="validationError" class="text-xs text-danger flex items-center gap-1">
        <UIcon name="error" size="xs" />
        {{ validationError }}
      </p>
      <p
        v-else-if="splitData.participants.length === 0"
        class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark flex items-center gap-1"
      >
        <UIcon name="info" size="xs" />
        Добавьте участников для разделения расхода
      </p>
    </div>
  </div>
</template>
