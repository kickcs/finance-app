<script setup lang="ts">
import { ref, computed } from 'vue';
import { UButton, UIcon, InitialAvatar } from '@/shared/ui';
import { TreeRoot, TreeItem } from 'reka-ui';
import { formatCurrency } from '@/shared/lib/format/currency';
import { formatDate } from '@/shared/lib/format/date';
import { pluralize } from '@/shared/lib/format/pluralize';
import { useHaptics } from '@/shared/lib/haptics';
import type {
  Participant,
  ParticipantSummary,
  ReceiptCharge,
  ScanReceiptFormData,
} from '../../model/types';
import PayerSelector from '../PayerSelector.vue';
import type { AccountWithBalances } from '@/entities/account';
import type { Category } from '@/entities/category';
import { useReceiptShare, type ReceiptShareData } from '../../model/useReceiptShare';
import { calcChargeAmount } from '../../model/calcLineTotal';
import SuccessOverlay from '../SuccessOverlay.vue';
import ShareLinkSheet from '../ShareLinkSheet.vue';
import ReceiptPaper from '../ReceiptPaper.vue';
import TransactionFormSection from '../TransactionFormSection.vue';
import CreateDebtsToggle from '../CreateDebtsToggle.vue';

const props = defineProps<{
  participantSummaries: ParticipantSummary[];
  participants: Participant[];
  payerId: string | null;
  payerLocked?: boolean;
  myShareTotal: number;
  currency: string;
  formData: ScanReceiptFormData;
  accounts: AccountWithBalances[];
  categories: Category[];
  subtotal: number;
  charges: ReceiptCharge[];
  chargesAmount: number;
  totalAmount: number;
  /** Operation amount from the Telegram-import flow; used to flag total mismatches. */
  expectedAmount?: number | null;
  storeName: string | null;
  isSubmitting: boolean;
  submitError: string | null;
  isSuccess: boolean;
  isFormValid: boolean;
  doneRoute?: string;
  doneLabel?: string;
}>();

const emit = defineEmits<{
  'update:formData': [value: ScanReceiptFormData];
  'update:payerId': [value: string | null];
  submit: [];
  back: [];
}>();

// «Платил не я» — выбран другой участник
const selectedPayer = computed(
  () => props.participants.find((p) => p.id === props.payerId && !p.isMe) ?? null,
);

const { trigger } = useHaptics();

const displayDate = computed(() => formatDate(props.formData.date));

// Non-blocking warning when the receipt total diverges from the imported
// operation amount by more than 1%. Only relevant for the Telegram-import flow.
const amountMismatch = computed(() => {
  const expected = props.expectedAmount;
  if (!expected || expected <= 0) return false;
  return Math.abs(props.totalAmount - expected) / expected > 0.01;
});

// Create debts toggle
const createDebts = computed({
  get: () => props.formData.createDebts,
  set: (val: boolean) => {
    emit('update:formData', { ...props.formData, createDebts: val });
  },
});

// Participants who owe (not "me", with total > 0, not paid-for)
const owers = computed(() =>
  props.participantSummaries.filter((p) => !p.isMe && p.total > 0 && !p.paidByName),
);

// Debt count = non-me participants with items (excluding paid-for participants)
const debtCount = computed(
  () =>
    props.participantSummaries.filter((p) => !p.isMe && p.itemCount > 0 && !p.paidByName).length,
);

// Tree structure for payer -> dependents hierarchy
interface PayerTreeNode {
  id: string;
  participant: ParticipantSummary;
  isDependent: boolean;
  children?: PayerTreeNode[];
}

const payerTree = computed<PayerTreeNode[]>(() => {
  const paidForIds = new Set<string>();
  for (const p of props.participantSummaries) {
    if (p.paidByName) paidForIds.add(p.id);
  }

  return props.participantSummaries
    .filter((p) => !paidForIds.has(p.id))
    .map((p) => {
      const deps = props.participantSummaries.filter((dep) => dep.paidById === p.id);
      return {
        id: p.id,
        participant: p,
        isDependent: false,
        children: deps.length
          ? deps.map((dep) => ({
              id: dep.id,
              participant: dep,
              isDependent: true,
            }))
          : undefined,
      };
    });
});

// Track which participant detail lists are expanded (separate from tree expand)
const defaultExpandedIds = computed(() =>
  payerTree.value.filter((n) => n.children?.length).map((n) => n.id),
);

const expandedDetails = ref<Set<string>>(new Set());

function toggleDetails(id: string) {
  const next = new Set(expandedDetails.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  expandedDetails.value = next;
}

function handleSubmit() {
  trigger('selection');
  emit('submit');
}

// Sharing
const { isSharing, shareAsImage, shareAsText, saveToGallery } = useReceiptShare();

// Публичная ссылка на чек
const shareLinkOpen = ref(false);

const enabledCharges = computed(() => props.charges.filter((c) => c.enabled));
const hasCharges = computed(() => enabledCharges.value.length > 0 && props.chargesAmount > 0);

const shareData = computed<ReceiptShareData>(() => ({
  storeName: props.storeName,
  date: props.formData.date,
  currency: props.currency,
  totalAmount: props.totalAmount,
  subtotal: props.subtotal,
  charges: props.charges,
  chargesAmount: props.chargesAmount,
  participants: props.participantSummaries,
}));

const shareActions = computed(() => [
  { icon: 'photo_camera', label: 'Картинкой', action: () => shareAsImage(shareData.value) },
  { icon: 'share', label: 'Текстом', action: () => shareAsText(shareData.value) },
  { icon: 'download', label: 'Сохранить', action: () => saveToGallery(shareData.value) },
]);
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- Success overlay (Fullscreen Receipt) -->
    <SuccessOverlay
      :is-success="isSuccess"
      :total-amount="totalAmount"
      :currency="currency"
      :store-name="storeName"
      :display-date="displayDate"
      :owers="owers"
      :has-charges="hasCharges"
      :enabled-charges="enabledCharges"
      :is-sharing="isSharing"
      :share-actions="shareActions"
      :done-route="doneRoute"
      :done-label="doneLabel"
      @share-link="shareLinkOpen = true"
    />

    <!-- Шаринг публичной ссылкой -->
    <ShareLinkSheet
      v-model:open="shareLinkOpen"
      :participant-summaries="participantSummaries"
      :charges="charges"
      :store-name="storeName"
      :total-amount="totalAmount"
      :subtotal="subtotal"
      :date="formData.date"
      :currency="currency"
    />

    <!-- Scrollable content -->
    <div
      class="flex-1 overflow-y-auto no-scrollbar px-5 pt-4 pb-4 space-y-4"
      :class="isSubmitting && 'opacity-50 pointer-events-none'"
    >
      <!-- Финальный чек: итог + разбивка на одном листе -->
      <ReceiptPaper class="mb-2 mt-1">
        <!-- Итого -->
        <div class="px-5 pt-5 pb-5">
          <template v-if="hasCharges">
            <div class="flex justify-between items-baseline mb-1.5">
              <span
                class="font-mono text-xs text-text-tertiary-light dark:text-text-tertiary-dark uppercase tracking-wider font-medium"
              >
                Подытог
              </span>
              <span
                class="font-mono text-sm text-text-secondary-light dark:text-text-secondary-dark tabular-nums"
              >
                {{ formatCurrency(subtotal, currency) }}
              </span>
            </div>
            <div
              v-for="charge in enabledCharges"
              :key="charge.id"
              class="flex justify-between items-baseline mb-1.5"
            >
              <span class="font-mono text-xs text-primary uppercase tracking-wider font-medium">
                {{ charge.label }}
                <template v-if="charge.type === 'percent'">({{ charge.percent }}%)</template>
              </span>
              <span class="font-mono text-sm text-primary tabular-nums">
                +{{ formatCurrency(calcChargeAmount(subtotal, charge), currency) }}
              </span>
            </div>
            <div
              class="border-t-2 border-dashed border-border-light dark:border-border-dark mt-2.5 mb-3"
            />
          </template>

          <div class="flex flex-col items-center justify-center mt-1">
            <span
              class="font-mono text-caption-sm uppercase tracking-widest text-text-tertiary-light dark:text-text-tertiary-dark font-bold mb-1"
            >
              Итого к оплате
            </span>
            <span
              class="text-3xl font-mono font-bold text-text-primary-light dark:text-text-primary-dark tabular-nums tracking-tight"
            >
              {{ formatCurrency(totalAmount, currency) }}
            </span>
          </div>
        </div>

        <!-- Per-person breakdown (tree: payer -> dependents) -->
        <section aria-label="Разбивка по участникам" class="pb-1.5">
          <h2
            class="font-mono text-caption-sm font-bold uppercase tracking-widest text-text-tertiary-light dark:text-text-tertiary-dark text-center pb-2.5"
          >
            · Кто сколько ·
          </h2>
          <TreeRoot
            v-slot="{ flattenItems }"
            :items="payerTree"
            :get-key="(item) => item.id"
            :default-expanded="defaultExpandedIds"
          >
            <div>
              <TreeItem
                v-for="item in flattenItems"
                :key="item._id"
                v-bind="item.bind"
                class="outline-none"
              >
                <!-- Payer (root level): печатная строка с пунктирным лидером -->
                <template v-if="!item.value.isDependent">
                  <div class="border-t border-dashed border-border-light dark:border-border-dark">
                    <button
                      type="button"
                      class="flex items-center gap-3 px-4 py-3 w-full text-left active:bg-surface-light dark:active:bg-surface-dark transition-colors"
                      @click.stop="toggleDetails(item.value.id)"
                    >
                      <InitialAvatar
                        :name="item.value.participant.name"
                        :color="item.value.participant.color"
                        size="sm"
                        translucent
                      />
                      <div class="flex-1 min-w-0">
                        <div class="flex items-baseline gap-2">
                          <p
                            class="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark leading-tight truncate"
                          >
                            {{ item.value.participant.name }}
                            <span
                              v-if="item.value.participant.isMe"
                              class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark font-normal"
                            >
                              (вы)
                            </span>
                          </p>
                          <div
                            class="flex-1 min-w-3 border-b-2 border-dotted border-border-light dark:border-border-dark opacity-60 relative -top-1"
                          />
                          <span
                            class="text-sm font-mono font-bold tabular-nums flex-shrink-0 text-text-primary-light dark:text-text-primary-dark"
                          >
                            {{ formatCurrency(item.value.participant.total, currency) }}
                          </span>
                        </div>
                        <p class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark">
                          {{ item.value.participant.itemCount }}
                          {{
                            pluralize(
                              item.value.participant.itemCount,
                              'позиция',
                              'позиции',
                              'позиций',
                            )
                          }}
                          <template v-if="item.hasChildren">
                            · платит за {{ item.value.children!.length }}
                            {{
                              pluralize(
                                item.value.children!.length,
                                'человека',
                                'человек',
                                'человек',
                              )
                            }}
                          </template>
                        </p>
                      </div>
                      <UIcon
                        :name="expandedDetails.has(item.value.id) ? 'expand_less' : 'expand_more'"
                        size="xs"
                        class="text-text-tertiary-light dark:text-text-tertiary-dark flex-shrink-0"
                      />
                    </button>

                    <!-- Expandable item list -->
                    <Transition name="expand">
                      <div v-if="expandedDetails.has(item.value.id)" class="pb-2.5">
                        <div
                          v-for="itm in item.value.participant.items"
                          :key="itm.id"
                          class="flex items-center justify-between pl-[3.75rem] pr-4 py-1.5"
                        >
                          <div class="flex-1 min-w-0 mr-3">
                            <p
                              class="text-xs font-mono text-text-secondary-light dark:text-text-secondary-dark truncate"
                            >
                              {{ itm.name }}
                            </p>
                            <p
                              v-if="itm.sharedWith > 1"
                              class="text-caption-sm font-mono text-text-tertiary-light dark:text-text-tertiary-dark"
                            >
                              1/{{ itm.sharedWith }} от
                              {{ formatCurrency(itm.lineTotal, currency) }}
                            </p>
                          </div>
                          <span
                            class="text-xs font-mono font-medium text-text-secondary-light dark:text-text-secondary-dark tabular-nums"
                          >
                            {{ formatCurrency(itm.share, currency) }}
                          </span>
                        </div>
                      </div>
                    </Transition>
                  </div>
                </template>

                <!-- Dependent (child level): вложенная печатная строка -->
                <template v-else>
                  <div
                    class="border-t border-dashed border-border-light/60 dark:border-border-dark/60"
                  >
                    <button
                      type="button"
                      class="w-full text-left pl-8 pr-4 py-2.5 flex items-center gap-2.5 active:bg-surface-light dark:active:bg-surface-dark transition-colors"
                      @click.stop="toggleDetails(item.value.id)"
                    >
                      <span
                        class="font-mono text-sm text-text-tertiary-light dark:text-text-tertiary-dark flex-shrink-0"
                        aria-hidden="true"
                      >
                        ↳
                      </span>
                      <InitialAvatar
                        :name="item.value.participant.name"
                        :color="item.value.participant.color"
                        size="sm"
                        translucent
                      />
                      <div class="flex-1 min-w-0">
                        <div class="flex items-baseline gap-2">
                          <p
                            class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark truncate"
                          >
                            {{ item.value.participant.name }}
                          </p>
                          <div
                            class="flex-1 min-w-3 border-b-2 border-dotted border-border-light dark:border-border-dark opacity-50 relative -top-1"
                          />
                          <span
                            class="text-sm font-mono font-semibold tabular-nums flex-shrink-0 text-text-secondary-light dark:text-text-secondary-dark"
                          >
                            {{ formatCurrency(item.value.participant.total, currency) }}
                          </span>
                        </div>
                        <p
                          class="text-caption text-text-tertiary-light dark:text-text-tertiary-dark"
                        >
                          {{ item.value.participant.itemCount }}
                          {{
                            pluralize(
                              item.value.participant.itemCount,
                              'позиция',
                              'позиции',
                              'позиций',
                            )
                          }}
                          · платит {{ item.value.participant.paidByName }}
                        </p>
                      </div>
                      <UIcon
                        :name="expandedDetails.has(item.value.id) ? 'expand_less' : 'expand_more'"
                        size="xs"
                        class="text-text-tertiary-light dark:text-text-tertiary-dark flex-shrink-0"
                      />
                    </button>

                    <!-- Expandable item list -->
                    <Transition name="expand">
                      <div v-if="expandedDetails.has(item.value.id)" class="pb-2.5">
                        <div
                          v-for="itm in item.value.participant.items"
                          :key="itm.id"
                          class="flex items-center justify-between pl-[4.75rem] pr-4 py-1.5"
                        >
                          <div class="flex-1 min-w-0 mr-3">
                            <p
                              class="text-xs font-mono text-text-secondary-light dark:text-text-secondary-dark truncate"
                            >
                              {{ itm.name }}
                            </p>
                            <p
                              v-if="itm.sharedWith > 1"
                              class="text-caption-sm font-mono text-text-tertiary-light dark:text-text-tertiary-dark"
                            >
                              1/{{ itm.sharedWith }} от
                              {{ formatCurrency(itm.lineTotal, currency) }}
                            </p>
                          </div>
                          <span
                            class="text-xs font-mono font-medium text-text-secondary-light dark:text-text-secondary-dark tabular-nums"
                          >
                            {{ formatCurrency(itm.share, currency) }}
                          </span>
                        </div>
                      </div>
                    </Transition>
                  </div>
                </template>
              </TreeItem>
            </div>
          </TreeRoot>
        </section>
      </ReceiptPaper>

      <!-- Amount mismatch warning (Telegram-import flow, non-blocking) -->
      <Transition name="section-slide">
        <div
          v-if="amountMismatch"
          class="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-warning/[0.08] border border-warning/20"
          role="alert"
        >
          <UIcon name="warning" size="sm" class="text-warning flex-shrink-0 mt-0.5" />
          <p class="text-xs text-warning font-medium flex-1">
            Сумма чека ({{ formatCurrency(totalAmount, currency) }}) отличается от суммы операции
            ({{ formatCurrency(expectedAmount!, currency) }})
          </p>
        </div>
      </Transition>

      <!-- Кто платил -->
      <PayerSelector
        :participants="participants"
        :payer-id="payerId"
        :locked="payerLocked"
        @update:payer-id="emit('update:payerId', $event)"
      />

      <!-- Transaction parameters -->
      <TransactionFormSection
        :form-data="formData"
        :accounts="accounts"
        :categories="categories"
        :hide-category="!!selectedPayer"
        @update:form-data="$emit('update:formData', $event)"
      />

      <!-- Debts Toggle (платил я) -->
      <CreateDebtsToggle v-if="!selectedPayer" v-model="createDebts" :debt-count="debtCount" />

      <!-- «Платил не я»: вместо транзакции — долг плательщику -->
      <section v-else class="mt-6 mb-2">
        <div
          class="flex items-center gap-4 w-full p-4 rounded-2xl bg-surface-light dark:bg-surface-dark border-2 border-primary/20 drop-shadow-sm"
        >
          <div
            class="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0"
          >
            <UIcon name="group" size="md" />
          </div>
          <div class="text-left flex-1 min-w-0">
            <p
              class="text-base font-bold text-text-primary-light dark:text-text-primary-dark tracking-tight"
            >
              Будет создан долг
            </p>
            <p
              class="text-xs font-medium text-text-tertiary-light dark:text-text-tertiary-dark mt-0.5"
            >
              Вы должны {{ selectedPayer.name }} —
              <span class="text-primary font-semibold tabular-nums">
                {{ formatCurrency(myShareTotal, currency) }}
              </span>
            </p>
          </div>
        </div>

        <Transition name="section-slide">
          <div
            v-if="myShareTotal <= 0"
            class="flex items-center gap-2 mt-3 px-3 py-2.5 rounded-xl bg-warning/[0.08] border border-warning/20"
            role="alert"
          >
            <UIcon name="warning" size="sm" class="text-warning flex-shrink-0" />
            <p class="text-xs text-warning font-medium flex-1">
              Ваша доля пуста — отметьте свои позиции на шаге «Участники»
            </p>
          </div>
        </Transition>
      </section>
    </div>

    <!-- Sticky footer -->
    <div
      class="flex-shrink-0 border-t border-border-light dark:border-border-dark px-5 pt-3 pb-[calc(1.25rem+var(--safe-area-inset-bottom))] bg-background-light dark:bg-background-dark"
    >
      <Transition name="section-slide">
        <p v-if="submitError" class="text-sm text-danger mb-3 flex items-center gap-2">
          <UIcon name="error" size="sm" class="flex-shrink-0" />
          {{ submitError }}
        </p>
      </Transition>

      <UButton
        variant="primary"
        size="xl"
        full-width
        :loading="isSubmitting"
        :disabled="!isFormValid"
        @click="handleSubmit"
      >
        <UIcon name="check" size="sm" class="mr-2" />
        Создать
      </UButton>
    </div>
  </div>
</template>

<style>
@import '../transitions.css';
</style>
