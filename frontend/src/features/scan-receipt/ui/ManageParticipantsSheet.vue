<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { useTimeoutFn } from '@vueuse/core';
import { UButton, UIcon, UModal, UInput, InitialAvatar } from '@/shared/ui';
import { cn } from '@/shared/lib/utils';
import { useHaptics } from '@/shared/lib/haptics';
import { usePeople } from '@/entities/person';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import type { Participant } from '../model/types';

const props = defineProps<{
  open: boolean;
  participants: Participant[];
  hasMe: boolean;
  /** Сколько позиций назначено участнику — для подтверждения удаления */
  assignedCounts: Record<string, number>;
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
  add: [name: string, isMe: boolean];
  remove: [id: string];
  setPaidBy: [id: string, paidById: string | null];
}>();

const { trigger } = useHaptics();
const { userId } = useCurrentUser();
const { people, createPerson } = usePeople(userId);

const newName = ref('');
const nameError = ref('');
const pendingNames = ref<Set<string>>(new Set());
const manualInputRef = ref<InstanceType<typeof UInput> | null>(null);

// Раскрытый селектор «кто платит» (id участника)
const expandedPayerId = ref<string | null>(null);

// Удаление в два тапа: первый — подтверждение на кнопке
const confirmingRemoveId = ref<string | null>(null);
const { start: scheduleConfirmReset, stop: cancelConfirmReset } = useTimeoutFn(
  () => (confirmingRemoveId.value = null),
  2500,
  { immediate: false },
);

const existingNames = computed(() => {
  const names = new Set(props.participants.map((p) => p.name.toLowerCase()));
  for (const name of pendingNames.value) names.add(name);
  return names;
});

const availableContacts = computed(() =>
  people.value.filter((p) => !existingNames.value.has(p.name.toLowerCase())),
);

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      newName.value = '';
      nameError.value = '';
      pendingNames.value = new Set();
      expandedPayerId.value = null;
      confirmingRemoveId.value = null;
    }
  },
);

function payerName(participant: Participant): string | null {
  if (!participant.paidById) return null;
  return props.participants.find((p) => p.id === participant.paidById)?.name ?? null;
}

/** Кандидаты в плательщики: все, кроме самого участника и зависимых */
function payerOptions(participant: Participant): Participant[] {
  return props.participants.filter((p) => p.id !== participant.id && !p.paidById);
}

function togglePayerSelector(id: string) {
  expandedPayerId.value = expandedPayerId.value === id ? null : id;
  trigger('selection');
}

function choosePayer(participantId: string, paidById: string | null) {
  emit('setPaidBy', participantId, paidById);
  expandedPayerId.value = null;
}

function handleRemove(id: string) {
  if (confirmingRemoveId.value === id) {
    cancelConfirmReset();
    confirmingRemoveId.value = null;
    emit('remove', id);
    return;
  }
  const hasAssignments = (props.assignedCounts[id] ?? 0) > 0;
  if (!hasAssignments) {
    emit('remove', id);
    return;
  }
  trigger('warning');
  confirmingRemoveId.value = id;
  scheduleConfirmReset();
}

function addMe() {
  trigger('selection');
  emit('add', 'Я', true);
}

function addContact(name: string) {
  if (existingNames.value.has(name.toLowerCase())) return;
  pendingNames.value.add(name.toLowerCase());
  trigger('selection');
  emit('add', name, false);
}

function confirmAddManual() {
  const trimmed = newName.value.trim();
  if (!trimmed) return;
  if (existingNames.value.has(trimmed.toLowerCase())) {
    nameError.value = 'Этот участник уже добавлен';
    return;
  }
  pendingNames.value.add(trimmed.toLowerCase());
  emit('add', trimmed, false);
  newName.value = '';
  nameError.value = '';
  trigger('selection');
  nextTick(() => manualInputRef.value?.focus());
}

async function saveToContacts(name: string) {
  await createPerson({ name });
  trigger('selection');
}
</script>

<template>
  <UModal :model-value="open" title="Участники" @update:model-value="emit('update:open', $event)">
    <div class="space-y-5">
      <!-- Список участников -->
      <div v-if="participants.length > 0" class="space-y-1.5">
        <div
          v-for="p in participants"
          :key="p.id"
          class="rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark overflow-hidden"
        >
          <div class="flex items-center gap-3 px-3 py-2.5">
            <InitialAvatar :name="p.name" :color="p.color" size="md" translucent />

            <div class="flex-1 min-w-0">
              <p
                class="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark truncate"
              >
                {{ p.name }}
                <span
                  v-if="p.isMe"
                  class="text-xs font-normal text-text-tertiary-light dark:text-text-tertiary-dark"
                >
                  (вы)
                </span>
              </p>
              <!-- Кто платит за этого участника -->
              <button
                type="button"
                class="inline-flex items-center gap-1 text-xs transition-colors"
                :class="
                  p.paidById
                    ? 'text-primary font-medium'
                    : 'text-text-tertiary-light dark:text-text-tertiary-dark'
                "
                :aria-expanded="expandedPayerId === p.id"
                @click="togglePayerSelector(p.id)"
              >
                {{ p.paidById ? `Платит: ${payerName(p)}` : 'Платит сам' }}
                <UIcon :name="expandedPayerId === p.id ? 'expand_less' : 'expand_more'" size="xs" />
              </button>
            </div>

            <button
              type="button"
              :aria-label="
                confirmingRemoveId === p.id ? `Подтвердить удаление ${p.name}` : `Убрать ${p.name}`
              "
              :class="
                cn(
                  'h-8 rounded-lg flex items-center justify-center transition-all active:scale-90 shrink-0',
                  confirmingRemoveId === p.id
                    ? 'px-2.5 bg-danger text-white text-xs font-semibold'
                    : 'w-8 text-text-tertiary-light dark:text-text-tertiary-dark hover:text-danger hover:bg-danger/5',
                )
              "
              @click="handleRemove(p.id)"
            >
              <template v-if="confirmingRemoveId === p.id">Точно?</template>
              <UIcon v-else name="delete" size="xs" />
            </button>
          </div>

          <!-- Раскрывающийся выбор плательщика -->
          <Transition name="section-slide">
            <div
              v-if="expandedPayerId === p.id"
              class="px-3 pb-2.5 pt-0.5 flex flex-wrap gap-1.5 border-t border-border-light/50 dark:border-border-dark/50"
            >
              <button
                type="button"
                class="mt-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all active:scale-95"
                :class="
                  p.paidById === null
                    ? 'bg-primary text-white'
                    : 'bg-surface-light dark:bg-surface-dark text-text-secondary-light dark:text-text-secondary-dark border border-border-light dark:border-border-dark'
                "
                @click="choosePayer(p.id, null)"
              >
                Сам
              </button>
              <button
                v-for="payer in payerOptions(p)"
                :key="payer.id"
                type="button"
                class="mt-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all active:scale-95"
                :class="
                  p.paidById === payer.id
                    ? 'text-white'
                    : 'bg-surface-light dark:bg-surface-dark text-text-secondary-light dark:text-text-secondary-dark border border-border-light dark:border-border-dark'
                "
                :style="p.paidById === payer.id ? { backgroundColor: payer.color } : {}"
                @click="choosePayer(p.id, payer.id)"
              >
                {{ payer.name }}
              </button>
            </div>
          </Transition>
        </div>
      </div>

      <!-- Добавление -->
      <div class="space-y-3">
        <p
          class="text-xs font-semibold text-text-tertiary-light dark:text-text-tertiary-dark uppercase tracking-wide"
        >
          Добавить
        </p>

        <!-- «Я» -->
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
          <UIcon name="add" size="sm" class="text-primary/70" />
        </button>

        <!-- Контакты -->
        <div v-if="availableContacts.length > 0" class="flex flex-wrap gap-1.5">
          <button
            v-for="contact in availableContacts.slice(0, 8)"
            :key="contact.id"
            type="button"
            class="inline-flex items-center gap-1.5 pl-1.5 pr-3 py-1.5 rounded-full bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-xs font-medium text-text-primary-light dark:text-text-primary-dark active:scale-95 transition-all"
            @click="addContact(contact.name)"
          >
            <InitialAvatar :name="contact.name" :color="contact.color" size="xs" />
            {{ contact.name }}
            <UIcon
              name="add"
              size="xs"
              class="text-text-tertiary-light dark:text-text-tertiary-dark"
            />
          </button>
        </div>

        <!-- Имя вручную -->
        <div class="flex items-start gap-2">
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
            aria-label="Добавить участника"
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
            aria-label="Сохранить в контакты"
            title="Сохранить в контакты"
            class="h-10 px-3 rounded-xl bg-surface-light dark:bg-surface-dark text-text-secondary-light dark:text-text-secondary-dark text-sm shrink-0 active:scale-95 transition-transform"
            @click="saveToContacts(newName.trim())"
          >
            <UIcon name="person_add" size="sm" />
          </button>
        </div>
      </div>
    </div>

    <template #actions>
      <UButton variant="primary" size="lg" full-width @click="emit('update:open', false)">
        Готово
      </UButton>
    </template>
  </UModal>
</template>

<style>
@import './transitions.css';
</style>
