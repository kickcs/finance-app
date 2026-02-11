<script setup lang="ts">
import { ref, computed } from 'vue'
import { UInput, UIcon } from '@/shared/ui'
import { formatCurrency } from '@/shared/lib/format/currency'
import { getCurrencyByCode } from '@/entities/currency'
import type { SplitExpenseData, SplitMethod } from '../model/types'

const props = defineProps<{
  totalAmount: number
  currency: string
  splitData: SplitExpenseData
  validationError?: string | null
}>()

const emit = defineEmits<{
  'update:splitData': [value: SplitExpenseData]
  addParticipant: [name: string]
  removeParticipant: [id: string]
  updateParticipantAmount: [id: string, amount: number]
  updateParticipantName: [id: string, name: string]
  setMethod: [method: SplitMethod]
  setMyShare: [amount: number]
  setEnabled: [enabled: boolean]
}>()

const newParticipantName = ref('')

const currencySymbol = computed(() => {
  const currency = getCurrencyByCode(props.currency)
  return currency?.symbol || props.currency
})

const totalToReturn = computed(() => {
  return props.splitData.participants.reduce((sum, p) => sum + p.amount, 0)
})

function handleAddParticipant() {
  if (newParticipantName.value.trim()) {
    emit('addParticipant', newParticipantName.value.trim())
    newParticipantName.value = ''
  }
}

function handleToggle() {
  emit('setEnabled', !props.splitData.enabled)
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
          :class="splitData.enabled ? 'bg-primary/20 text-primary' : 'bg-surface-light dark:bg-surface-dark text-text-secondary-light dark:text-text-secondary-dark'"
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
        :class="splitData.enabled ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'"
      >
        <div
          class="absolute w-5 h-5 bg-white rounded-full top-1 transition-all shadow-sm"
          :class="splitData.enabled ? 'right-1' : 'left-1'"
        />
      </div>
    </button>

    <!-- Split Options (shown when enabled) -->
    <div v-if="splitData.enabled" class="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
      <!-- Method selector -->
      <div class="flex gap-2">
        <button
          type="button"
          class="flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all"
          :class="splitData.method === 'equal'
            ? 'bg-primary text-white'
            : 'bg-surface-light dark:bg-surface-dark text-text-secondary-light dark:text-text-secondary-dark'"
          @click="$emit('setMethod', 'equal')"
        >
          Поровну
        </button>
        <button
          type="button"
          class="flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all"
          :class="splitData.method === 'custom'
            ? 'bg-primary text-white'
            : 'bg-surface-light dark:bg-surface-dark text-text-secondary-light dark:text-text-secondary-dark'"
          @click="$emit('setMethod', 'custom')"
        >
          Указать суммы
        </button>
      </div>

      <!-- My share -->
      <div class="space-y-1.5">
        <label class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark">
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

      <!-- Participants -->
      <div class="space-y-2">
        <label class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark">
          Участники (кто должен вернуть)
        </label>

        <!-- Participant list -->
        <div v-if="splitData.participants.length > 0" class="space-y-2">
          <div
            v-for="participant in splitData.participants"
            :key="participant.id"
            class="flex items-center gap-2 p-2 rounded-lg bg-surface-light dark:bg-surface-dark"
          >
            <div class="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
              <span class="text-xs font-bold text-primary">
                {{ participant.personName.charAt(0).toUpperCase() }}
              </span>
            </div>
            <input
              :value="participant.personName"
              type="text"
              class="flex-1 min-w-0 bg-transparent border-none outline-none text-sm text-text-primary-light dark:text-text-primary-dark"
              @input="$emit('updateParticipantName', participant.id, ($event.target as HTMLInputElement).value)"
              @keydown.enter.prevent
            />
            <div class="flex items-center gap-1">
              <input
                :value="participant.amount"
                type="number"
                inputmode="decimal"
                class="w-24 text-right bg-transparent border-none outline-none text-sm font-medium text-text-primary-light dark:text-text-primary-dark"
                :disabled="splitData.method === 'equal'"
                @input="$emit('updateParticipantAmount', participant.id, Number(($event.target as HTMLInputElement).value) || 0)"
                @keydown.enter.prevent
              />
              <span class="text-xs text-text-secondary-light dark:text-text-secondary-dark">
                {{ currencySymbol }}
              </span>
            </div>
            <button
              type="button"
              class="p-1 text-text-tertiary-light dark:text-text-tertiary-dark hover:text-danger transition-colors"
              @click="$emit('removeParticipant', participant.id)"
            >
              <UIcon name="close" size="sm" />
            </button>
          </div>
        </div>

        <!-- Add participant -->
        <div class="flex gap-2">
          <input
            v-model="newParticipantName"
            type="text"
            placeholder="Имя участника"
            class="flex-1 px-3 py-2.5 rounded-lg bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark text-sm text-text-primary-light dark:text-text-primary-dark placeholder:text-text-tertiary-light dark:placeholder:text-text-tertiary-dark focus:outline-none focus:ring-2 focus:ring-primary"
            @keydown.enter.prevent
          />
          <button
            type="button"
            class="px-4 py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            :disabled="!newParticipantName.trim()"
            @click="handleAddParticipant"
          >
            <UIcon name="add" size="sm" />
          </button>
        </div>
      </div>

      <!-- Summary -->
      <div class="p-3 rounded-xl bg-surface-light dark:bg-surface-dark space-y-2">
        <div class="flex justify-between text-sm">
          <span class="text-text-secondary-light dark:text-text-secondary-dark">Общая сумма</span>
          <span class="font-medium text-text-primary-light dark:text-text-primary-dark">
            {{ formatCurrency(totalAmount, currency) }}
          </span>
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

      <!-- Validation error -->
      <p v-if="validationError" class="text-xs text-danger flex items-center gap-1">
        <UIcon name="error" size="xs" />
        {{ validationError }}
      </p>
    </div>
  </div>
</template>
