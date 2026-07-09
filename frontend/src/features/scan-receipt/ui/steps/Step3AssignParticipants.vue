<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { UButton, UIcon, UProgressBar } from '@/shared/ui';
import { cn } from '@/shared/lib/utils';
import { pluralize } from '@/shared/lib/format/pluralize';
import { useHaptics } from '@/shared/lib/haptics';
import { ALL_PARTICIPANTS_ID } from '../../model/constants';
import type { LastParty } from '../../model/useLastParty';
import type { ReceiptItem, ReceiptCharge, Participant } from '../../model/types';
import ReceiptPaper from '../ReceiptPaper.vue';
import AssignableItemRow from '../AssignableItemRow.vue';
import ManageParticipantsSheet from '../ManageParticipantsSheet.vue';
import ParticipantsBar from '../ParticipantsBar.vue';

const props = defineProps<{
  items: ReceiptItem[];
  participants: Participant[];
  currency: string;
  hasMe: boolean;
  unassignedCount: number;
  charges: ReceiptCharge[];
  subtotal: number;
  lastParty: LastParty | null;
}>();
const emit = defineEmits<{
  addParticipant: [name: string, isMe: boolean];
  removeParticipant: [id: string];
  setPaidBy: [id: string, paidById: string | null];
  toggleItemParticipant: [itemId: string, participantId: string];
  assignAllToEveryone: [];
  assignRestToMe: [];
  restoreLastParty: [];
  next: [];
  back: [];
}>();
const { trigger } = useHaptics();

const activeParticipantId = ref<string | null>(
  props.participants.length > 0 ? props.participants[0].id : null,
);

const manageOpen = ref(false);
const showUnassignedOnly = ref(false);

watch(
  () => props.participants,
  (newVal) => {
    if (!activeParticipantId.value && newVal.length > 0) {
      activeParticipantId.value = newVal[0].id;
    }
  },
);

// Фильтр «Без участника» гаснет сам, когда неназначенных не осталось
watch(
  () => props.unassignedCount,
  (count) => {
    if (count === 0) showUnassignedOnly.value = false;
  },
);

// Пустой шаг без «прошлой компании» — сразу открываем управление участниками
onMounted(() => {
  if (props.participants.length === 0 && !props.lastParty?.members?.length) {
    manageOpen.value = true;
  }
});

function setActiveParticipant(participantId: string) {
  activeParticipantId.value = participantId;
  trigger('selection');
}

// Assignment progress
const assignedCount = computed(
  () => props.items.filter((item) => item.assignedParticipantIds.length > 0).length,
);

const assignProgress = computed(() =>
  props.items.length > 0 ? Math.round((assignedCount.value / props.items.length) * 100) : 0,
);

const visibleItems = computed(() =>
  showUnassignedOnly.value
    ? props.items.filter((item) => item.assignedParticipantIds.length === 0)
    : props.items,
);

// Сколько позиций назначено каждому участнику — для подтверждения удаления в sheet
const assignedCounts = computed<Record<string, number>>(() => {
  const counts: Record<string, number> = {};
  for (const item of props.items) {
    for (const pid of item.assignedParticipantIds) {
      counts[pid] = (counts[pid] ?? 0) + 1;
    }
  }
  return counts;
});

// «Как в прошлый раз» — до 3 имён + счётчик
const lastPartyLabel = computed(() => {
  const members = props.lastParty?.members ?? [];
  if (members.length === 0) return null;
  const names = members.map((m) => (m.isMe ? 'Вы' : m.name));
  const shown = names.slice(0, 3).join(', ');
  const rest = names.length - 3;
  return rest > 0 ? `${shown} +${rest}` : shown;
});

function handleRemoveParticipant(id: string) {
  emit('removeParticipant', id);
  if (activeParticipantId.value === id) {
    activeParticipantId.value = props.participants.find((p) => p.id !== id)?.id ?? null;
  }
}

function handleRestoreLastParty() {
  trigger('success');
  emit('restoreLastParty');
}

function handleNext() {
  trigger('selection');
  emit('next');
}

function handleTapRow(item: ReceiptItem) {
  if (!activeParticipantId.value) {
    trigger('error');
    return;
  }
  trigger('success');
  emit('toggleItemParticipant', item.id, activeParticipantId.value);
}
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- Participants bar (кисть) -->
    <ParticipantsBar
      :participants="participants"
      :active-participant-id="activeParticipantId"
      @set-active="setActiveParticipant"
      @open-manage="manageOpen = true"
    />

    <!-- Empty state — no participants -->
    <div
      v-if="participants.length === 0"
      class="flex-1 flex flex-col items-center justify-center px-8 gap-4"
    >
      <div class="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
        <UIcon name="group_add" size="xl" class="text-primary" />
      </div>

      <div class="text-center">
        <h3
          class="text-base font-semibold text-text-primary-light dark:text-text-primary-dark mb-1"
        >
          Кто участвовал?
        </h3>
        <p class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
          Добавьте участников — и раздайте им позиции тапом
        </p>
      </div>

      <!-- «Как в прошлый раз» -->
      <button
        v-if="lastPartyLabel"
        type="button"
        class="flex items-center gap-3 w-full max-w-xs px-4 py-3 rounded-2xl bg-primary/[0.06] border border-primary/15 text-left active:scale-[0.97] transition-all"
        @click="handleRestoreLastParty"
      >
        <div class="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <UIcon name="history" size="sm" class="text-primary" />
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-semibold text-primary">Как в прошлый раз</p>
          <p class="text-xs text-text-secondary-light dark:text-text-secondary-dark truncate">
            {{ lastPartyLabel }}
          </p>
        </div>
      </button>

      <UButton variant="primary" size="lg" class="w-full max-w-xs" @click="manageOpen = true">
        <UIcon name="group_add" size="sm" class="mr-2" />
        Добавить участников
      </UButton>
    </div>

    <!-- Items list -->
    <div v-else class="flex-1 overflow-y-auto no-scrollbar px-5 pt-3 pb-4">
      <!-- Assignment progress bar -->
      <div class="mb-3">
        <div class="flex items-center justify-between mb-1.5">
          <span
            class="text-caption font-semibold uppercase tracking-wide text-text-tertiary-light dark:text-text-tertiary-dark"
          >
            Назначено {{ assignedCount }} из {{ items.length }}
          </span>
          <span
            class="text-xs font-mono font-medium tabular-nums"
            :class="
              assignProgress === 100
                ? 'text-success'
                : 'text-text-secondary-light dark:text-text-secondary-dark'
            "
          >
            {{ assignProgress }}%
          </span>
        </div>
        <UProgressBar
          :value="assignProgress"
          size="sm"
          :color="assignProgress === 100 ? 'success' : 'primary'"
        />
      </div>

      <!-- Быстрые действия -->
      <div class="flex flex-wrap items-center gap-2 mb-3">
        <button
          v-if="participants.length > 1"
          type="button"
          class="flex items-center gap-1.5 px-3 py-2 rounded-full bg-primary/10 text-primary text-xs font-semibold active:scale-95 transition-transform"
          @click="emit('assignAllToEveryone')"
        >
          <UIcon name="done_all" size="xs" />
          Поровну на всех
        </button>

        <button
          v-if="hasMe && unassignedCount > 0"
          type="button"
          class="flex items-center gap-1.5 px-3 py-2 rounded-full bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark text-xs font-semibold active:scale-95 transition-transform"
          @click="emit('assignRestToMe')"
        >
          <UIcon name="person" size="xs" />
          Остальное — на меня
        </button>

        <button
          v-if="unassignedCount > 0"
          type="button"
          :aria-pressed="showUnassignedOnly"
          :class="
            cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold active:scale-95 transition-all',
              showUnassignedOnly
                ? 'bg-warning/15 text-warning border border-warning/30'
                : 'bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark',
            )
          "
          @click="showUnassignedOnly = !showUnassignedOnly"
        >
          <UIcon name="filter_list" size="xs" />
          Без участника ({{ unassignedCount }})
        </button>
      </div>

      <!-- Items list: тот же чековый лист, что и на шаге позиций -->
      <ReceiptPaper :title="`Позиции чека · ${visibleItems.length}`" class="mb-4">
        <AssignableItemRow
          v-for="item in visibleItems"
          :key="item.id"
          :item="item"
          :participants="participants"
          :currency="currency"
          :charges="charges"
          :subtotal="subtotal"
          :active-brush-id="activeParticipantId"
          @tap-row="handleTapRow(item)"
          @tap-all="emit('toggleItemParticipant', item.id, ALL_PARTICIPANTS_ID)"
        />
      </ReceiptPaper>
    </div>

    <!-- Footer -->
    <div
      class="flex-shrink-0 border-t border-border-light dark:border-border-dark px-5 pt-3 pb-[calc(1.25rem+var(--safe-area-inset-bottom))] bg-background-light dark:bg-background-dark"
    >
      <!-- Unassigned warning (тап — фильтр по неназначенным) -->
      <Transition name="section-slide">
        <button
          v-if="unassignedCount > 0 && participants.length > 0"
          type="button"
          class="flex items-center gap-2 mb-3 px-3 py-2.5 rounded-xl bg-warning/[0.08] border border-warning/20 w-full text-left active:scale-[0.99] transition-transform"
          @click="showUnassignedOnly = true"
        >
          <UIcon name="warning" size="sm" class="text-warning flex-shrink-0" />
          <p class="text-xs text-warning font-medium flex-1">
            {{ unassignedCount }}
            {{ pluralize(unassignedCount, 'позиция', 'позиции', 'позиций') }} без участника —
            показать
          </p>
          <UIcon name="chevron_right" size="xs" class="text-warning/60 flex-shrink-0" />
        </button>
      </Transition>

      <UButton
        variant="primary"
        size="lg"
        full-width
        :disabled="participants.length === 0"
        @click="handleNext"
      >
        Далее — Итог
        <UIcon name="arrow_forward" size="sm" class="ml-2" />
      </UButton>
    </div>

    <!-- Manage participants sheet -->
    <ManageParticipantsSheet
      v-model:open="manageOpen"
      :participants="participants"
      :has-me="hasMe"
      :assigned-counts="assignedCounts"
      @add="(name, isMe) => emit('addParticipant', name, isMe)"
      @remove="handleRemoveParticipant"
      @set-paid-by="(id, paidById) => emit('setPaidBy', id, paidById)"
    />
  </div>
</template>

<style>
@import '../transitions.css';
</style>
