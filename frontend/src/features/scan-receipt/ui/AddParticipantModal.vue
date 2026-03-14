<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { UButton, UIcon, UModal, UInput, InitialAvatar } from '@/shared/ui';
import { pluralize } from '@/shared/lib/format/pluralize';
import { useHaptics } from '@/shared/lib/haptics';
import { usePeople } from '@/entities/person';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import type { Participant } from '../model/types';

const props = defineProps<{
  open: boolean;
  participants: Participant[];
  hasMe: boolean;
}>();
const emit = defineEmits<{
  'update:open': [value: boolean];
  addParticipant: [name: string, isMe: boolean, paidById: string | null];
  removeParticipant: [id: string];
}>();

const { trigger } = useHaptics();
const { userId } = useCurrentUser();
const { people, createPerson } = usePeople(userId);

const newName = ref('');
const nameError = ref('');
const selectedContactIds = ref<Set<string>>(new Set());
const selectedPaidById = ref<string | null>(null);
const pendingNames = ref<Set<string>>(new Set());
const manualInputRef = ref<InstanceType<typeof UInput> | null>(null);

/** Special constant for "Я" as payer when not yet added as participant */
const ME_PAYER_ID = '__ME__';

/** Names already added as participants (lowercase for comparison), includes locally pending adds */
const existingNames = computed(() => {
  const names = new Set(props.participants.map((p) => p.name.toLowerCase()));
  for (const name of pendingNames.value) names.add(name);
  return names;
});

/** Saved contacts not yet added */
const availableContacts = computed(() =>
  people.value.filter((p) => !existingNames.value.has(p.name.toLowerCase())),
);

// Reset internal state when modal opens
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      newName.value = '';
      nameError.value = '';
      selectedContactIds.value = new Set();
      pendingNames.value = new Set();
      selectedPaidById.value = null;
    }
  },
);

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
  emit('update:open', false);
}

async function handleSaveAndAdd(name: string) {
  await createPerson({ name });
  // Person will appear in availableContacts on next tick
  trigger('selection');
}

const modalOpen = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value),
});
</script>

<template>
  <UModal v-model="modalOpen" title="Добавить участников">
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
        <p class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark mb-2">
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
        <p class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark mb-2">
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
        <p class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark mb-2">
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
            v-for="payer in participants"
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
              @click="emit('removeParticipant', p.id)"
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
      <UButton v-else variant="secondary" size="lg" full-width @click="emit('update:open', false)">
        Готово
      </UButton>
    </template>
  </UModal>
</template>
