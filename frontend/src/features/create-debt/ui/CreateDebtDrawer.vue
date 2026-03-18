<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { type DateValue } from '@internationalized/date';
import {
  DrawerRoot,
  DrawerPortal,
  DrawerOverlay,
  DrawerContent,
  DrawerHandle,
  DrawerTitle,
} from 'vaul-vue';
import { UInput, UButton, UTabs, UIcon, UToggle, SelectChips } from '@/shared/ui';
import { Popover, PopoverTrigger, PopoverContent } from '@/shared/ui/primitives/popover';
import { Calendar } from '@/shared/ui/primitives/calendar';
import { DEBT_DIRECTION_LABELS, type DebtDirection } from '@/entities/debt';
import { getCurrencyByCode, DEFAULT_CURRENCY } from '@/entities/currency';
import { PersonSelector, usePeople } from '@/entities/person';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import { useIsDesktop } from '@/shared/lib/composables/useIsDesktop';
import { useDrawerKeyboard } from '@/shared/lib/composables';
import { getTodayISO, isoToCalendarDate, dateValueToISO } from '@/shared/lib/date';
import { formatLocalDate } from '@/shared/lib/format/date';
import { useCreateDebt } from '../model/useCreateDebt';
import type { AccountWithBalances } from '@/entities/account';

const props = defineProps<{
  open: boolean;
  accounts: AccountWithBalances[];
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
}>();

const isDesktop = useIsDesktop();

const { userId } = useCurrentUser();
const { people, createPerson } = usePeople(userId);
const { formData, isValid, isSubmitting, error, createDebt, updateField, resetForm } =
  useCreateDebt();

// ── Debt type tabs ────────────────────────────────────────────────────────
const debtTypeTabs = Object.entries(DEBT_DIRECTION_LABELS).map(([id, label]) => ({ id, label }));

// ── Account chips ─────────────────────────────────────────────────────────
const accountItems = computed(() => props.accounts.map((a) => ({ id: a.id, label: a.name })));

function handleAccountChange(accountId: string | null) {
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
const currencySymbol = computed(() => {
  const c = getCurrencyByCode(formData.value.currency);
  return c?.symbol || formData.value.currency;
});

// Converts ISO date string to a localized display string using local timezone construction
// (avoids UTC-offset issues that arise from passing ISO strings directly to new Date())
function isoToDisplayDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return formatLocalDate(new Date(y, m - 1, d).getTime());
}

// ── Debt date (when debt was created) ─────────────────────────────────────
const isDebtDateOpen = ref(false);
const debtDateCalendarValue = computed(
  () => isoToCalendarDate(formData.value.debt_date || getTodayISO())!,
);
const debtDisplayDate = computed(() => isoToDisplayDate(formData.value.debt_date || getTodayISO()));
function handleDebtDateChange(value: DateValue | undefined) {
  const iso = dateValueToISO(value);
  if (!iso) return;
  updateField('debt_date', iso);
  isDebtDateOpen.value = false;
}

// ── Due date (when debt should be returned) ───────────────────────────────
const isDueDateOpen = ref(false);
const dueDateCalendarValue = computed(() => isoToCalendarDate(formData.value.due_date));
const dueDateDisplay = computed(() =>
  formData.value.due_date ? isoToDisplayDate(formData.value.due_date) : null,
);
function handleDueDateChange(value: DateValue | undefined) {
  const iso = dateValueToISO(value);
  if (!iso) return;
  updateField('due_date', iso);
  isDueDateOpen.value = false;
}
function clearDueDate() {
  updateField('due_date', null);
}

// ── Submit ────────────────────────────────────────────────────────────────
async function handleSubmit() {
  if (!userId.value) return;
  const debtId = await createDebt(userId.value);
  if (debtId) {
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
              @update:model-value="updateField('debt_type', $event as DebtDirection)"
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
            <Popover v-model:open="isDebtDateOpen">
              <PopoverTrigger as-child>
                <button
                  type="button"
                  class="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-text-primary-light dark:text-text-primary-dark hover:border-primary/50 transition-all"
                >
                  <div class="flex items-center gap-2">
                    <UIcon
                      name="calendar_month"
                      size="sm"
                      class="text-text-secondary-light dark:text-text-secondary-dark"
                    />
                    <span class="text-sm">{{ debtDisplayDate }}</span>
                  </div>
                  <UIcon
                    name="expand_more"
                    size="sm"
                    class="text-text-secondary-light dark:text-text-secondary-dark transition-transform"
                    :class="{ 'rotate-180': isDebtDateOpen }"
                  />
                </button>
              </PopoverTrigger>
              <PopoverContent class="w-auto p-0" align="start" :to="calendarPortalRef">
                <Calendar
                  :model-value="debtDateCalendarValue"
                  locale="ru-RU"
                  @update:model-value="handleDebtDateChange"
                />
              </PopoverContent>
            </Popover>
          </div>

          <!-- Due date -->
          <div class="space-y-2">
            <label
              class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark"
            >
              Срок возврата
            </label>
            <div class="flex items-center gap-2">
              <Popover v-model:open="isDueDateOpen">
                <PopoverTrigger as-child>
                  <button
                    type="button"
                    class="flex-1 flex items-center gap-2 px-4 py-3 rounded-xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark hover:border-primary/50 transition-all"
                    :class="
                      formData.due_date
                        ? 'text-text-primary-light dark:text-text-primary-dark'
                        : 'text-text-tertiary-light dark:text-text-tertiary-dark'
                    "
                  >
                    <UIcon name="calendar_month" size="sm" />
                    <span class="text-sm">{{ dueDateDisplay ?? 'Без срока' }}</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent class="w-auto p-0" align="start" :to="calendarPortalRef">
                  <Calendar
                    :model-value="dueDateCalendarValue"
                    locale="ru-RU"
                    @update:model-value="handleDueDateChange"
                  />
                </PopoverContent>
              </Popover>
              <button
                v-if="formData.due_date"
                type="button"
                class="p-2 rounded-lg text-text-tertiary-light dark:text-text-tertiary-dark hover:text-danger transition-colors"
                @click="clearDueDate"
              >
                <UIcon name="close" size="sm" />
              </button>
            </div>
          </div>

          <!-- Description -->
          <UInput
            :model-value="formData.description"
            label="Комментарий (необязательно)"
            placeholder="Добавьте описание..."
            @update:model-value="updateField('description', $event as string)"
          />

          <!-- Is private toggle -->
          <div class="flex items-center justify-between gap-4">
            <div>
              <p class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
                Скрыть сумму
              </p>
              <p class="text-xs text-text-secondary-light dark:text-text-secondary-dark mt-0.5">
                Сумма не будет видна в общем списке
              </p>
            </div>
            <UToggle
              :model-value="formData.is_private"
              @update:model-value="updateField('is_private', $event)"
            />
          </div>

          <!-- Skip transaction -->
          <div class="flex items-center justify-between gap-4">
            <div>
              <p class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
                {{
                  formData.debt_type === 'given'
                    ? 'Не списывать с баланса'
                    : 'Не добавлять на баланс'
                }}
              </p>
              <p class="text-xs text-text-secondary-light dark:text-text-secondary-dark mt-0.5">
                Транзакция не будет создана
              </p>
            </div>
            <UToggle
              :model-value="formData.skipTransaction"
              @update:model-value="updateField('skipTransaction', $event)"
            />
          </div>

          <!-- Info box -->
          <div
            v-if="!formData.skipTransaction && formData.account_id"
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
        <div ref="calendarPortalRef" class="hidden" />

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
