<script setup lang="ts">
import { ref, computed } from 'vue';
import { UButton, UIcon, InitialAvatar } from '@/shared/ui';
import { TreeRoot, TreeItem } from 'reka-ui';
import { formatCurrency } from '@/shared/lib/format/currency';
import { formatDate } from '@/shared/lib/format/date';
import { pluralize } from '@/shared/lib/format/pluralize';
import { useHaptics } from '@/shared/lib/haptics';
import type { ParticipantSummary, ReceiptCharge, ScanReceiptFormData } from '../../model/types';
import type { AccountWithBalances } from '@/entities/account';
import type { Category } from '@/entities/category';
import { useReceiptShare, type ReceiptShareData } from '../../model/useReceiptShare';
import SuccessOverlay from '../SuccessOverlay.vue';
import ReceiptTotalCard from '../ReceiptTotalCard.vue';
import TransactionFormSection from '../TransactionFormSection.vue';
import CreateDebtsToggle from '../CreateDebtsToggle.vue';

const props = defineProps<{
  participantSummaries: ParticipantSummary[];
  currency: string;
  formData: ScanReceiptFormData;
  accounts: AccountWithBalances[];
  categories: Category[];
  subtotal: number;
  charges: ReceiptCharge[];
  chargesAmount: number;
  totalAmount: number;
  storeName: string | null;
  isSubmitting: boolean;
  submitError: string | null;
  isSuccess: boolean;
  isFormValid: boolean;
}>();

const emit = defineEmits<{
  'update:formData': [value: ScanReceiptFormData];
  submit: [];
  back: [];
}>();

const { trigger } = useHaptics();

const displayDate = computed(() => formatDate(props.formData.date));

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
    />

    <!-- Scrollable content -->
    <div
      class="flex-1 overflow-y-auto no-scrollbar px-5 pt-4 pb-4 space-y-4"
      :class="isSubmitting && 'opacity-50 pointer-events-none'"
    >
      <!-- Total summary card (Skeuomorphic Receipt) -->
      <ReceiptTotalCard
        :subtotal="subtotal"
        :charges="charges"
        :charges-amount="chargesAmount"
        :total-amount="totalAmount"
        :currency="currency"
      />

      <!-- Per-person breakdown (tree: payer -> dependents) -->
      <section aria-label="Разбивка по участникам">
        <h2
          class="text-xs font-semibold text-text-tertiary-light dark:text-text-tertiary-dark uppercase tracking-wide mb-2.5"
        >
          Кто сколько
        </h2>
        <TreeRoot
          v-slot="{ flattenItems }"
          :items="payerTree"
          :get-key="(item) => item.id"
          :default-expanded="defaultExpandedIds"
        >
          <div class="space-y-2">
            <TreeItem
              v-for="item in flattenItems"
              :key="item._id"
              v-bind="item.bind"
              class="outline-none"
            >
              <!-- Payer (root level) -->
              <template v-if="!item.value.isDependent">
                <div
                  class="rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark overflow-hidden"
                  :class="
                    expandedDetails.has(item.value.id) &&
                    'ring-1 ring-border-light dark:ring-border-dark'
                  "
                >
                  <button
                    type="button"
                    class="flex items-center gap-3 px-4 py-3 w-full text-left"
                    @click.stop="toggleDetails(item.value.id)"
                  >
                    <InitialAvatar
                      :name="item.value.participant.name"
                      :color="item.value.participant.color"
                      size="md"
                      translucent
                    />
                    <div class="flex-1 min-w-0">
                      <p
                        class="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark leading-tight"
                      >
                        {{ item.value.participant.name }}
                        <span
                          v-if="item.value.participant.isMe"
                          class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark font-normal"
                        >
                          (вы)
                        </span>
                      </p>
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
                            pluralize(item.value.children!.length, 'человека', 'человек', 'человек')
                          }}
                        </template>
                      </p>
                    </div>
                    <span
                      class="text-base font-bold tabular-nums flex-shrink-0"
                      :style="{ color: item.value.participant.color }"
                    >
                      {{ formatCurrency(item.value.participant.total, currency) }}
                    </span>
                    <UIcon
                      :name="expandedDetails.has(item.value.id) ? 'expand_less' : 'expand_more'"
                      size="xs"
                      class="text-text-tertiary-light dark:text-text-tertiary-dark flex-shrink-0"
                    />
                  </button>

                  <!-- Expandable item list -->
                  <Transition name="expand">
                    <div
                      v-if="expandedDetails.has(item.value.id)"
                      class="border-t border-border-light dark:border-border-dark"
                    >
                      <div
                        v-for="(itm, idx) in item.value.participant.items"
                        :key="itm.id"
                        class="flex items-center justify-between px-4 py-2.5"
                        :class="
                          idx < item.value.participant.items.length - 1 &&
                          'border-b border-border-light/50 dark:border-border-dark/50'
                        "
                      >
                        <div class="flex-1 min-w-0 mr-3">
                          <p
                            class="text-sm text-text-primary-light dark:text-text-primary-dark truncate"
                          >
                            {{ itm.name }}
                          </p>
                          <p
                            v-if="itm.sharedWith > 1"
                            class="text-caption text-text-tertiary-light dark:text-text-tertiary-dark"
                          >
                            1/{{ itm.sharedWith }} от {{ formatCurrency(itm.lineTotal, currency) }}
                          </p>
                        </div>
                        <span
                          class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark tabular-nums"
                        >
                          {{ formatCurrency(itm.share, currency) }}
                        </span>
                      </div>
                    </div>
                  </Transition>
                </div>
              </template>

              <!-- Dependent (child level) -->
              <template v-else>
                <div class="ml-6 relative">
                  <div
                    class="absolute -left-3 top-4 w-3 border-t border-border-light dark:border-border-dark"
                  />
                  <div
                    class="absolute -left-3 -top-1 bottom-1/2 border-l border-border-light dark:border-border-dark"
                  />
                  <div
                    class="rounded-xl border border-border-light/60 dark:border-border-dark/60 bg-card-light/70 dark:bg-card-dark/70 overflow-hidden"
                    :class="
                      expandedDetails.has(item.value.id) &&
                      'ring-1 ring-border-light/50 dark:ring-border-dark/50'
                    "
                  >
                    <button
                      type="button"
                      class="w-full text-left px-4 py-2.5 flex items-center gap-3"
                      @click.stop="toggleDetails(item.value.id)"
                    >
                      <InitialAvatar
                        :name="item.value.participant.name"
                        :color="item.value.participant.color"
                        size="sm"
                        translucent
                      />
                      <div class="flex-1 min-w-0">
                        <p
                          class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark truncate"
                        >
                          {{ item.value.participant.name }}
                        </p>
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
                      <span
                        class="text-sm font-semibold tabular-nums text-text-secondary-light dark:text-text-secondary-dark"
                      >
                        {{ formatCurrency(item.value.participant.total, currency) }}
                      </span>
                      <UIcon
                        :name="expandedDetails.has(item.value.id) ? 'expand_less' : 'expand_more'"
                        size="xs"
                        class="text-text-tertiary-light dark:text-text-tertiary-dark flex-shrink-0"
                      />
                    </button>

                    <!-- Expandable item list -->
                    <Transition name="expand">
                      <div
                        v-if="expandedDetails.has(item.value.id)"
                        class="border-t border-border-light/50 dark:border-border-dark/50"
                      >
                        <div
                          v-for="(itm, idx) in item.value.participant.items"
                          :key="itm.id"
                          class="flex items-center justify-between px-4 py-2"
                          :class="
                            idx < item.value.participant.items.length - 1 &&
                            'border-b border-border-light/30 dark:border-border-dark/30'
                          "
                        >
                          <div class="flex-1 min-w-0 mr-3">
                            <p
                              class="text-xs text-text-primary-light dark:text-text-primary-dark truncate"
                            >
                              {{ itm.name }}
                            </p>
                            <p
                              v-if="itm.sharedWith > 1"
                              class="text-caption-sm text-text-tertiary-light dark:text-text-tertiary-dark"
                            >
                              1/{{ itm.sharedWith }} от
                              {{ formatCurrency(itm.lineTotal, currency) }}
                            </p>
                          </div>
                          <span
                            class="text-xs font-medium text-text-primary-light dark:text-text-primary-dark tabular-nums"
                          >
                            {{ formatCurrency(itm.share, currency) }}
                          </span>
                        </div>
                      </div>
                    </Transition>
                  </div>
                </div>
              </template>
            </TreeItem>
          </div>
        </TreeRoot>
      </section>

      <!-- Divider -->
      <div class="h-px bg-border-light dark:bg-border-dark" />

      <!-- Transaction parameters -->
      <TransactionFormSection
        :form-data="formData"
        :accounts="accounts"
        :categories="categories"
        @update:form-data="$emit('update:formData', $event)"
      />

      <!-- Debts Toggle -->
      <CreateDebtsToggle v-model="createDebts" :debt-count="debtCount" />
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
