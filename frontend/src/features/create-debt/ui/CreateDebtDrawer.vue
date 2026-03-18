<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import {
  DrawerRoot,
  DrawerPortal,
  DrawerOverlay,
  DrawerContent,
  DrawerHandle,
  DrawerTitle,
} from 'vaul-vue';
import { UInput, UButton, UTabs, UIcon, SelectChips } from '@/shared/ui';
import { DEBT_DIRECTION_LABELS, type DebtDirection } from '@/entities/debt';
import { getCurrencyByCode, DEFAULT_CURRENCY } from '@/entities/currency';
import { getCurrencySymbol } from '@/shared/lib/format/currency';
import { PersonSelector, usePeople } from '@/entities/person';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import { useIsDesktop } from '@/shared/lib/composables/useIsDesktop';
import { useDrawerKeyboard } from '@/shared/lib/composables';
import { useCreateDebt } from '../model/useCreateDebt';
import { useHaptics } from '@/shared/lib/haptics';
import type { AccountWithBalances } from '@/entities/account';
import DatePickerField from './DatePickerField.vue';
import ToggleRow from './ToggleRow.vue';

const props = defineProps<{
  open: boolean;
  accounts: AccountWithBalances[];
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
}>();

const isDesktop = useIsDesktop();
const { trigger } = useHaptics();

const { userId } = useCurrentUser();
const { people, createPerson } = usePeople(userId);
const { formData, isValid, isSubmitting, error, createDebt, updateField, resetForm } =
  useCreateDebt();

// ── Debt type tabs ────────────────────────────────────────────────────────
const debtTypeTabs = Object.entries(DEBT_DIRECTION_LABELS).map(([id, label]) => ({ id, label }));

// ── Account chips ─────────────────────────────────────────────────────────
const accountItems = computed(() => props.accounts.map((a) => ({ id: a.id, label: a.name })));

function handleAccountChange(accountId: string | null) {
  trigger('selection');
  if (!accountId) {
    updateField('account_id', null);
    return;
  }
  const account = props.accounts.find((a) => a.id === accountId);
  const firstCurrency = account?.balances[0]?.currency || DEFAULT_CURRENCY;
  updateField('account_id', accountId);
  updateField('currency', firstCurrency);
}

// ── Currency ──────────────────────────────────────────────────────────────
const selectedAccount = computed(() =>
  props.accounts.find((a) => a.id === formData.value.account_id),
);
const availableCurrencies = computed(() =>
  selectedAccount.value ? selectedAccount.value.balances.map((b) => b.currency) : [],
);
const isMultiCurrency = computed(() => availableCurrencies.value.length > 1);
const currencySymbol = computed(() => getCurrencySymbol(formData.value.currency));

// ── Dates ────────────────────────────────────────────────────────────────
const isDebtDateOpen = ref(false);
const isDueDateOpen = ref(false);

// ── Submit ────────────────────────────────────────────────────────────────
async function handleSubmit() {
  if (!userId.value) return;
  const debtId = await createDebt(userId.value);
  if (debtId) {
    trigger('success');
    emit('update:open', false);
  }
}

// ── iOS virtual keyboard fix (mobile only) ───────────────────────────────
const drawerContentRef = ref<InstanceType<typeof DrawerContent> | null>(null);
const footerRef = ref<HTMLDivElement | null>(null);
const scrollContainerRef = ref<HTMLDivElement | null>(null);
const calendarPortalRef = ref<HTMLElement | null>(null);

const { setupKeyboardListener, cleanupKeyboardListener } = useDrawerKeyboard(
  drawerContentRef,
  footerRef,
  scrollContainerRef,
);

watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      await nextTick();
      if (!props.open) return; // race condition guard
      if (!isDesktop.value) setupKeyboardListener();
    } else {
      cleanupKeyboardListener();
      nextTick(resetForm); // clear stale values when drawer closes
    }
  },
);
</script>

<template>
  <DrawerRoot
    :open="open"
    :direction="isDesktop ? 'right' : 'bottom'"
    @update:open="$emit('update:open', $event)"
  >
    <DrawerPortal>
      <DrawerOverlay class="fixed inset-0 z-50 bg-black/40" />
      <DrawerContent
        ref="drawerContentRef"
        class="fixed z-50 flex flex-col bg-card-light dark:bg-card-dark"
        :class="
          isDesktop
            ? 'top-0 right-0 bottom-0 w-[420px] rounded-l-2xl border-l border-border-light dark:border-border-dark'
            : 'bottom-0 left-0 right-0 rounded-t-2xl border-t border-border-light dark:border-border-dark max-h-[90dvh]'
        "
      >
        <!-- Handle (mobile only) -->
        <div v-if="!isDesktop" class="flex justify-center pt-3 pb-1">
          <DrawerHandle class="w-10 h-1 rounded-full bg-border-light dark:bg-border-dark" />
        </div>

        <!-- Header -->
        <div class="flex items-center justify-between px-5 pb-3" :class="{ 'pt-4': isDesktop }">
          <DrawerTitle
            class="text-base font-semibold text-text-primary-light dark:text-text-primary-dark"
          >
            Новый долг
          </DrawerTitle>
          <button
            type="button"
            class="w-8 h-8 rounded-lg flex items-center justify-center text-text-secondary-light dark:text-text-secondary-dark hover:bg-surface-light dark:hover:bg-surface-dark transition-colors"
            @click="$emit('update:open', false)"
          >
            <UIcon name="close" size="sm" />
          </button>
        </div>

        <!-- Scrollable content -->
        <div
          ref="scrollContainerRef"
          class="flex-1 overflow-y-auto px-5 pb-5 space-y-5 overscroll-contain"
          data-vaul-no-drag
        >
          <!-- Debt type -->
          <div class="space-y-2">
            <label
              class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark"
            >
              Тип долга
            </label>
            <UTabs
              :model-value="formData.debt_type"
              :items="debtTypeTabs"
              @update:model-value="
                trigger('selection');
                updateField('debt_type', $event as DebtDirection);
              "
            />
          </div>

          <!-- Person -->
          <div class="space-y-2">
            <label
              class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark"
            >
              {{ formData.debt_type === 'given' ? 'Кому дали в долг' : 'У кого взяли в долг' }}
            </label>
            <PersonSelector
              :model-value="formData.person_name"
              :people="people"
              placeholder="Имя человека"
              @update:model-value="updateField('person_name', $event as string)"
              @select="updateField('person_name', $event as string)"
              @save-person="(name) => createPerson({ name })"
            />
          </div>

          <!-- Amount + currency -->
          <div class="space-y-2">
            <label
              class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark"
            >
              Сумма
            </label>
            <div class="flex gap-2">
              <div v-if="isMultiCurrency" class="relative shrink-0">
                <select
                  :value="formData.currency"
                  class="appearance-none h-full bg-surface-light dark:bg-surface-dark rounded-xl px-3 pr-8 text-sm font-medium border border-border-light dark:border-border-dark focus:outline-none focus:ring-2 focus:ring-primary"
                  @change="updateField('currency', ($event.target as HTMLSelectElement).value)"
                >
                  <option v-for="c in availableCurrencies" :key="c" :value="c">
                    {{ getCurrencyByCode(c)?.flag }} {{ c }}
                  </option>
                </select>
                <UIcon
                  name="expand_more"
                  size="sm"
                  class="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-text-tertiary-light dark:text-text-tertiary-dark"
                />
              </div>
              <div class="flex-1">
                <UInput
                  :model-value="String(formData.amount || '')"
                  placeholder="0"
                  variant="currency"
                  type="number"
                  :suffix="currencySymbol"
                  @update:model-value="updateField('amount', Number($event) || 0)"
                />
              </div>
            </div>
          </div>

          <!-- Account (SelectChips) -->
          <div class="space-y-2">
            <label
              class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark"
            >
              {{ formData.debt_type === 'given' ? 'С какого счёта' : 'На какой счёт' }}
            </label>
            <SelectChips
              :model-value="formData.account_id"
              :items="accountItems"
              all-label="Счёт не выбран"
              @update:model-value="handleAccountChange($event)"
            />
          </div>

          <!-- Debt date -->
          <div class="space-y-2">
            <label
              class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark"
            >
              Дата
            </label>
            <DatePickerField
              v-model:open="isDebtDateOpen"
              :model-value="formData.debt_date"
              :portal-to="calendarPortalRef"
              @update:model-value="updateField('debt_date', $event)"
            />
          </div>

          <!-- Due date -->
          <div class="space-y-2">
            <label
              class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark"
            >
              Срок возврата
            </label>
            <DatePickerField
              v-model:open="isDueDateOpen"
              :model-value="formData.due_date"
              placeholder="Без срока"
              clearable
              :portal-to="calendarPortalRef"
              @update:model-value="updateField('due_date', $event)"
            />
          </div>

          <!-- Description -->
          <UInput
            :model-value="formData.description"
            label="Комментарий (необязательно)"
            placeholder="Добавьте описание..."
            @update:model-value="updateField('description', $event as string)"
          />

          <!-- Is private toggle -->
          <ToggleRow
            v-model="formData.is_private"
            title="Скрыть сумму"
            description="Сумма не будет видна в общем списке"
          />

          <!-- Skip transaction -->
          <ToggleRow
            v-model="formData.skip_transaction"
            :title="
              formData.debt_type === 'given' ? 'Не списывать с баланса' : 'Не добавлять на баланс'
            "
            description="Транзакция не будет создана"
          />

          <!-- Info box -->
          <div
            v-if="!formData.skip_transaction && formData.account_id"
            class="p-4 rounded-xl bg-surface-light dark:bg-surface-dark"
          >
            <div class="flex items-start gap-3">
              <UIcon
                name="info"
                size="sm"
                class="text-text-tertiary-light dark:text-text-tertiary-dark mt-0.5"
              />
              <p class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                {{
                  formData.debt_type === 'given'
                    ? `Сумма ${formData.amount > 0 ? formData.amount + ' ' + formData.currency : ''} будет списана с выбранного счёта`
                    : `Сумма ${formData.amount > 0 ? formData.amount + ' ' + formData.currency : ''} будет добавлена на выбранный счёт`
                }}
              </p>
            </div>
          </div>

          <!-- Error -->
          <p v-if="error" class="text-sm text-danger">{{ error }}</p>
        </div>

        <!-- Portal container for calendars — keeps popovers inside drawer DOM -->
        <div ref="calendarPortalRef" />

        <!-- Footer -->
        <div
          ref="footerRef"
          class="px-5 py-3 border-t border-border-light dark:border-border-dark"
          :style="
            !isDesktop
              ? 'padding-bottom: calc(env(safe-area-inset-bottom, 16px) + 0.75rem)'
              : undefined
          "
        >
          <UButton
            type="button"
            variant="primary"
            size="xl"
            full-width
            :loading="isSubmitting"
            :disabled="!isValid"
            @click="handleSubmit"
          >
            Создать долг
          </UButton>
        </div>
      </DrawerContent>
    </DrawerPortal>
  </DrawerRoot>
</template>
