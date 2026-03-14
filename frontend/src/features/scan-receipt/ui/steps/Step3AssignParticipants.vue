<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { UButton, UIcon, UModal, UInput, UProgressBar, InitialAvatar } from '@/shared/ui';
import { pluralize } from '@/shared/lib/format/pluralize';
import { useHaptics } from '@/shared/lib/haptics';
import { usePeople } from '@/entities/person';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import type { ReceiptItem, ReceiptCharge, Participant } from '../../model/types';
import { ALL_PARTICIPANTS_ID, ALL_PARTICIPANTS_COLOR } from '../../model/constants';
import ParticipantChip from '../ParticipantChip.vue';
import AssignableItemRow from '../AssignableItemRow.vue';

const props = defineProps<{
  items: ReceiptItem[];
  participants: Participant[];
  currency: string;
  hasMe: boolean;
  unassignedCount: number;
  charges: ReceiptCharge[];
}>();
const emit = defineEmits<{
  addParticipant: [name: string, isMe: boolean, paidById: string | null];
  removeParticipant: [id: string];
  toggleItemParticipant: [itemId: string, participantId: string];
  next: [];
  back: [];
}>();
const { trigger } = useHaptics();
const { userId } = useCurrentUser();
const { people, createPerson } = usePeople(userId);

const activeParticipantId = ref<string | null>(
  props.participants.length > 0 ? props.participants[0].id : null,
);

watch(
  () => props.participants,
  (newVal) => {
    if (!activeParticipantId.value && newVal.length > 0) {
      activeParticipantId.value = newVal[0].id;
    }
  },
  { immediate: true },
);

/** Virtual "All" participant chip */
const allParticipantChip = computed<Participant>(() => ({
  id: ALL_PARTICIPANTS_ID,
  name: 'На всех',
  color: ALL_PARTICIPANTS_COLOR,
  isMe: false,
  paidById: null,
}));

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

// --- Add participant modal ---
const addParticipantOpen = ref(false);
const newName = ref('');
const nameError = ref('');

/** Names already added as participants (lowercase for comparison), includes locally pending adds */
const pendingNames = ref<Set<string>>(new Set());
const existingNames = computed(() => {
  const names = new Set(props.participants.map((p) => p.name.toLowerCase()));
  for (const name of pendingNames.value) names.add(name);
  return names;
});

/** Saved contacts not yet added */
const availableContacts = computed(() =>
  people.value.filter((p) => !existingNames.value.has(p.name.toLowerCase())),
);

/** Selected contact IDs in the modal */
const selectedContactIds = ref<Set<string>>(new Set());

const selectedPaidById = ref<string | null>(null);

/** Special constant for "Я" as payer when not yet added as participant */
const ME_PAYER_ID = '__ME__';

/** All participants shown as potential payers */
const availablePayers = computed(() => props.participants);

const manualInputRef = ref<InstanceType<typeof UInput> | null>(null);

function openAddParticipantSheet() {
  newName.value = '';
  nameError.value = '';
  selectedContactIds.value = new Set();
  pendingNames.value = new Set();
  selectedPaidById.value = null;
  addParticipantOpen.value = true;
}

function toggleContactSelection(contactId: string) {
  const next = new Set(selectedContactIds.value);
  if (next.has(contactId)) {
    next.delete(contactId);
  } else {
    next.add(contactId);
  }
  selectedContactIds.value = next;
  trigger('selection');
}

function addMe() {
  trigger('selection');
  emit('addParticipant', 'Я', true, null);
}

/** Resolve paidById — if ME_PAYER_ID selected, auto-add "Я" if not present and return their ID */
function resolvePaidById(): string | null {
  if (selectedPaidById.value === null) return null;
  if (selectedPaidById.value === ME_PAYER_ID) {
    // Auto-add "Я" if not yet a participant
    if (!props.hasMe) {
      emit('addParticipant', 'Я', true, null);
    }
    // Return the "Я" participant ID (will be available after next tick, but we need it now)
    // Since addParticipant is synchronous in the wizard, the participant is already added
    const me = props.participants.find((p) => p.isMe);
    return me?.id ?? null;
  }
  return selectedPaidById.value;
}

function confirmAddManual() {
  const trimmed = newName.value.trim();
  if (!trimmed) return;
  if (existingNames.value.has(trimmed.toLowerCase())) {
    nameError.value = 'Этот участник уже добавлен';
    return;
  }
  pendingNames.value.add(trimmed.toLowerCase());
  const paidById = resolvePaidById();
  emit('addParticipant', trimmed, false, paidById);
  newName.value = '';
  nameError.value = '';
  selectedPaidById.value = null;
  trigger('selection');
  nextTick(() => {
    manualInputRef.value?.focus();
  });
}

function confirmAddAll() {
  const paidById = resolvePaidById();
  // Add selected saved contacts
  for (const contactId of selectedContactIds.value) {
    const person = people.value.find((p) => p.id === contactId);
    if (person && !existingNames.value.has(person.name.toLowerCase())) {
      emit('addParticipant', person.name, false, paidById);
    }
  }
  trigger('success');
  selectedPaidById.value = null;
  addParticipantOpen.value = false;
}

async function handleSaveAndAdd(name: string) {
  await createPerson({ name });
  // Person will appear in availableContacts on next tick
  trigger('selection');
}

function handleRemoveParticipant(id: string) {
  emit('removeParticipant', id);
  if (activeParticipantId.value === id) {
    activeParticipantId.value = props.participants.find((p) => p.id !== id)?.id ?? null;
  }
}

// Assign all items to a participant
function assignAllTo(participantId: string) {
  for (const item of props.items) {
    if (!item.assignedParticipantIds.includes(participantId)) {
      emit('toggleItemParticipant', item.id, participantId);
    }
  }
  trigger('selection');
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
    <!-- Participants bar -->
    <div class="flex-shrink-0 px-5 pt-3 pb-3 border-b border-border-light dark:border-border-dark">
      <!-- Horizontal scrollable chips row -->
      <div class="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        <!-- Add participant button -->
        <button
          type="button"
          aria-label="Добавить участника"
          class="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full border border-dashed border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark hover:border-primary/40 hover:text-primary active:scale-95 transition-all duration-150 text-sm font-medium whitespace-nowrap"
          @click="openAddParticipantSheet"
        >
          <UIcon name="add" size="xs" />
          Добавить
        </button>

        <!-- Participant chips -->
        <TransitionGroup tag="div" name="chip-list" class="flex gap-2">
          <ParticipantChip
            v-if="participants.length > 1"
            :key="ALL_PARTICIPANTS_ID"
            :participant="allParticipantChip"
            :is-active="activeParticipantId === ALL_PARTICIPANTS_ID"
            @click="setActiveParticipant(ALL_PARTICIPANTS_ID)"
          />

          <ParticipantChip
            v-for="p in participants"
            :key="p.id"
            :participant="p"
            :is-active="activeParticipantId === p.id"
            :paid-by-name="
              p.paidById ? participants.find((pp) => pp.id === p.paidById)?.name : undefined
            "
            @click="setActiveParticipant(p.id)"
          />
        </TransitionGroup>
      </div>

      <!-- Actions row: assign all + remove active -->
      <div class="flex items-center justify-between mt-2">
        <Transition name="section-slide">
          <button
            v-if="
              activeParticipantId &&
              unassignedCount > 0 &&
              activeParticipantId !== ALL_PARTICIPANTS_ID
            "
            type="button"
            class="flex items-center gap-1.5 text-xs text-primary font-medium active:opacity-70 transition-opacity"
            @click="assignAllTo(activeParticipantId)"
          >
            <UIcon name="done_all" size="xs" />
            Назначить все пустые
          </button>
          <span v-else />
        </Transition>

        <Transition name="section-slide">
          <button
            v-if="activeParticipantId && activeParticipantId !== ALL_PARTICIPANTS_ID"
            type="button"
            class="flex items-center gap-1 text-xs text-danger font-medium active:opacity-70 transition-opacity"
            @click="handleRemoveParticipant(activeParticipantId)"
          >
            <UIcon name="close" size="xs" />
            Убрать
          </button>
        </Transition>
      </div>
    </div>

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
          Добавьте участников
        </h3>
        <p class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
          Укажите, кто участвовал в покупке
        </p>
      </div>

      <!-- Quick-add "Я" -->
      <button
        v-if="!hasMe"
        type="button"
        class="flex items-center gap-3 w-full max-w-xs px-4 py-3.5 rounded-2xl bg-primary text-white shadow-md shadow-primary/20 active:scale-[0.97] transition-all"
        @click="
          addMe();
          nextTick(() => openAddParticipantSheet());
        "
      >
        <div class="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
          <UIcon name="person" size="sm" class="text-white" />
        </div>
        <div class="text-left flex-1">
          <p class="text-sm font-semibold">Добавить «Я»</p>
          <p class="text-xs text-white/60">Я участвую в покупке</p>
        </div>
        <UIcon name="add" size="sm" class="text-white/70" />
      </button>

      <button
        type="button"
        class="text-sm text-text-secondary-light dark:text-text-secondary-dark underline underline-offset-2"
        @click="openAddParticipantSheet"
      >
        Добавить другого участника
      </button>
    </div>

    <!-- Items list -->
    <div v-else class="flex-1 overflow-y-auto no-scrollbar px-5 pt-3 pb-4">
      <!-- Assignment progress bar -->
      <div class="mb-3">
        <div class="flex items-center justify-between mb-1.5">
          <span class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark">
            Назначено {{ assignedCount }} из {{ items.length }}
          </span>
          <span
            class="text-xs font-medium tabular-nums"
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

      <!-- Items list -->
      <div class="space-y-2">
        <AssignableItemRow
          v-for="item in items"
          :key="item.id"
          :item="item"
          :participants="participants"
          :currency="currency"
          :charges="charges"
          :active-brush-id="activeParticipantId"
          @tap-row="handleTapRow(item)"
        />
      </div>
    </div>

    <!-- Footer -->
    <div
      class="flex-shrink-0 border-t border-border-light dark:border-border-dark px-5 pt-3 pb-[calc(1.25rem+var(--safe-area-inset-bottom))] bg-background-light dark:bg-background-dark"
    >
      <!-- Unassigned warning -->
      <Transition name="section-slide">
        <div
          v-if="unassignedCount > 0 && participants.length > 0"
          class="flex items-center gap-2 mb-3 px-3 py-2.5 rounded-xl bg-warning/[0.08] border border-warning/20"
          role="alert"
        >
          <UIcon name="warning" size="sm" class="text-warning flex-shrink-0" />
          <p class="text-xs text-warning font-medium flex-1">
            {{ unassignedCount }}
            {{ pluralize(unassignedCount, 'позиция', 'позиции', 'позиций') }} без участника
          </p>
        </div>
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
    <!-- Add participant modal -->
    <UModal v-model="addParticipantOpen" title="Добавить участников">
      <div class="space-y-4">
        <!-- "Я" quick-add -->
        <button
          v-if="!hasMe"
          type="button"
          class="flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-primary/[0.06] border border-primary/15 active:scale-[0.98] transition-all"
          @click="addMe"
        >
          <div class="w-9 h-9 rounded-full bg-primary flex items-center justify-center">
            <UIcon name="person" size="sm" class="text-white" />
          </div>
          <div class="text-left flex-1">
            <p class="text-sm font-semibold text-primary">Добавить «Я»</p>
            <p class="text-xs text-text-secondary-light dark:text-text-secondary-dark">
              Вы участвуете в этом чеке
            </p>
          </div>
          <UIcon name="check_circle" size="sm" class="text-success" />
        </button>

        <!-- Saved contacts multi-select -->
        <div v-if="availableContacts.length > 0">
          <p
            class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark mb-2"
          >
            Сохранённые контакты
          </p>
          <div class="space-y-1.5 max-h-48 overflow-y-auto no-scrollbar">
            <button
              v-for="contact in availableContacts"
              :key="contact.id"
              type="button"
              class="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-all active:scale-[0.98]"
              :class="
                selectedContactIds.has(contact.id)
                  ? 'bg-primary/10 border border-primary/30'
                  : 'bg-surface-light dark:bg-surface-dark border border-transparent'
              "
              @click="toggleContactSelection(contact.id)"
            >
              <InitialAvatar :name="contact.name" :color="contact.color" size="md" />
              <span
                class="flex-1 text-left text-sm font-medium text-text-primary-light dark:text-text-primary-dark"
              >
                {{ contact.name }}
              </span>
              <div
                class="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all"
                :class="
                  selectedContactIds.has(contact.id)
                    ? 'bg-primary border-primary'
                    : 'border-border-light dark:border-border-dark'
                "
              >
                <UIcon
                  v-if="selectedContactIds.has(contact.id)"
                  name="check"
                  size="xs"
                  class="text-white"
                />
              </div>
            </button>
          </div>
        </div>

        <!-- Empty contacts hint -->
        <p
          v-else-if="people.length === 0"
          class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark text-center py-2"
        >
          Нет сохранённых контактов. Введите имя ниже.
        </p>

        <!-- Manual name input -->
        <div>
          <p
            class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark mb-2"
          >
            Или введите имя
          </p>
          <div class="flex items-center gap-2">
            <UInput
              ref="manualInputRef"
              v-model="newName"
              placeholder="Имя участника"
              :error="nameError"
              @keydown="(e: KeyboardEvent) => e.key === 'Enter' && confirmAddManual()"
              @update:model-value="nameError = ''"
            />
            <button
              v-if="newName.trim()"
              type="button"
              class="h-10 px-3 rounded-xl bg-primary/10 text-primary text-sm font-medium shrink-0 active:scale-95 transition-transform"
              @click="confirmAddManual"
            >
              <UIcon name="add" size="sm" />
            </button>
            <button
              v-if="
                newName.trim() &&
                !people.some((p) => p.name.toLowerCase() === newName.trim().toLowerCase())
              "
              type="button"
              class="h-10 px-3 rounded-xl bg-surface-light dark:bg-surface-dark text-text-secondary-light dark:text-text-secondary-dark text-sm shrink-0 active:scale-95 transition-transform"
              title="Сохранить в контакты"
              @click="handleSaveAndAdd(newName.trim())"
            >
              <UIcon name="person_add" size="sm" />
            </button>
          </div>
        </div>

        <!-- "Кто платит?" selector -->
        <div v-if="participants.length > 0">
          <p
            class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark mb-2"
          >
            Кто платит?
          </p>
          <div class="flex flex-wrap gap-1.5">
            <button
              type="button"
              class="px-3 py-1.5 rounded-full text-xs font-medium transition-all active:scale-95"
              :class="
                selectedPaidById === null
                  ? 'bg-primary text-white'
                  : 'bg-surface-light dark:bg-surface-dark text-text-secondary-light dark:text-text-secondary-dark border border-border-light dark:border-border-dark'
              "
              @click="selectedPaidById = null"
            >
              Сам
            </button>
            <!-- "Я" as payer (always available) -->
            <button
              v-if="!participants.some((p) => p.isMe)"
              type="button"
              class="px-3 py-1.5 rounded-full text-xs font-medium transition-all active:scale-95"
              :class="
                selectedPaidById === ME_PAYER_ID
                  ? 'bg-primary text-white'
                  : 'bg-surface-light dark:bg-surface-dark text-text-secondary-light dark:text-text-secondary-dark border border-border-light dark:border-border-dark'
              "
              @click="selectedPaidById = ME_PAYER_ID"
            >
              Я
            </button>
            <button
              v-for="payer in availablePayers"
              :key="payer.id"
              type="button"
              class="px-3 py-1.5 rounded-full text-xs font-medium transition-all active:scale-95"
              :class="
                selectedPaidById === payer.id
                  ? 'text-white'
                  : 'bg-surface-light dark:bg-surface-dark text-text-secondary-light dark:text-text-secondary-dark border border-border-light dark:border-border-dark'
              "
              :style="selectedPaidById === payer.id ? { backgroundColor: payer.color } : {}"
              @click="selectedPaidById = payer.id"
            >
              {{ payer.name }}
            </button>
          </div>
        </div>

        <!-- Added participants preview -->
        <div v-if="participants.length > 0">
          <p class="text-xs font-medium text-text-tertiary-light dark:text-text-tertiary-dark mb-2">
            Уже добавлены
          </p>
          <div class="flex flex-wrap gap-1.5">
            <span
              v-for="p in participants"
              :key="p.id"
              class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-light dark:bg-surface-dark text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark"
            >
              {{ p.name }}
              <button
                type="button"
                class="text-text-tertiary-light dark:text-text-tertiary-dark hover:text-danger transition-colors"
                @click="handleRemoveParticipant(p.id)"
              >
                <UIcon name="close" size="xs" />
              </button>
            </span>
          </div>
        </div>
      </div>

      <template #actions>
        <UButton
          v-if="selectedContactIds.size > 0"
          variant="primary"
          size="lg"
          full-width
          @click="confirmAddAll"
        >
          Добавить {{ selectedContactIds.size }}
          {{ pluralize(selectedContactIds.size, 'контакт', 'контакта', 'контактов') }}
        </UButton>
        <UButton
          v-else
          variant="secondary"
          size="lg"
          full-width
          @click="addParticipantOpen = false"
        >
          Готово
        </UButton>
      </template>
    </UModal>
  </div>
</template>

<style>
@import '../transitions.css';
</style>

<style scoped>
.chip-list-enter-active,
.chip-list-leave-active {
  transition: all 0.2s ease;
}
.chip-list-enter-from,
.chip-list-leave-to {
  opacity: 0;
  transform: scale(0.8);
}
</style>
