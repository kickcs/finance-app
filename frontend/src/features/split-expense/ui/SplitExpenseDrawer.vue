<script setup lang="ts">
import { ref, computed, watch, nextTick, type ComponentPublicInstance } from 'vue';
import {
  DrawerRoot,
  DrawerPortal,
  DrawerOverlay,
  DrawerContent,
  DrawerHandle,
  DrawerTitle,
} from 'vaul-vue';
import { UIcon, UButton, UProgressBar, InitialAvatar } from '@/shared/ui';
import { formatCurrency, formatNumberWithSpaces } from '@/shared/lib/format/currency';
import { PersonSelector, usePeople } from '@/entities/person';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import type { SplitExpenseData, SplitMethod } from '../model/types';

const props = defineProps<{
  open: boolean;
  totalAmount: number;
  currency: string;
  splitData: SplitExpenseData;
  validationError?: string | null;
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
  addParticipant: [name: string, fromContacts: boolean, personColor?: string];
  removeParticipant: [id: string];
  updateParticipantAmount: [id: string, amount: number];
  setMethod: [method: SplitMethod];
  setMyShare: [amount: number];
  setIsIncluded: [included: boolean];
  setEnabled: [enabled: boolean];
}>();

const { userId } = useCurrentUser();
const { people, createPerson } = usePeople(userId);

const newParticipantName = ref('');

// Position drawer above iOS virtual keyboard via direct DOM manipulation.
// Using direct DOM instead of reactive state to avoid Vue re-renders
// that cause input focus loss when the keyboard appears.
let cleanupViewport: (() => void) | null = null;

function setupKeyboardListener() {
  const vv = window.visualViewport;
  if (!vv) return;

  const onResize = () => {
    const offset = Math.max(0, window.innerHeight - vv.height);
    const drawerEl = document.querySelector('[data-split-drawer]') as HTMLElement;
    const footerEl = document.querySelector('[data-split-drawer-footer]') as HTMLElement;

    if (drawerEl) {
      drawerEl.style.bottom = offset > 0 ? `${offset}px` : '';
      drawerEl.style.maxHeight = offset > 0 ? `${window.innerHeight - offset}px` : '';
    }
    if (footerEl) {
      footerEl.style.paddingBottom = offset > 0 ? '0.75rem' : '';
    }
    if (offset > 0) {
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
  };

  vv.addEventListener('resize', onResize);
  vv.addEventListener('scroll', onResize);
  cleanupViewport = () => {
    vv.removeEventListener('resize', onResize);
    vv.removeEventListener('scroll', onResize);
    const drawerEl = document.querySelector('[data-split-drawer]') as HTMLElement;
    const footerEl = document.querySelector('[data-split-drawer-footer]') as HTMLElement;
    if (drawerEl) {
      drawerEl.style.bottom = '';
      drawerEl.style.maxHeight = '';
    }
    if (footerEl) {
      footerEl.style.paddingBottom = '';
    }
  };
}

function cleanupKeyboardListener() {
  cleanupViewport?.();
  cleanupViewport = null;
}

const availablePeople = computed(() => {
  const addedNames = new Set(props.splitData.participants.map((p) => p.personName.toLowerCase()));
  return people.value.filter((p) => !addedNames.has(p.name.toLowerCase()));
});

const quickContacts = computed(() => {
  return availablePeople.value.slice(0, 8);
});

const totalToReturn = computed(() => {
  return props.splitData.participants.reduce((sum, p) => sum + p.amount, 0);
});

const totalSplit = computed(() => {
  return props.splitData.myShare + totalToReturn.value;
});

const progressColor = computed(() => {
  if (totalSplit.value > props.totalAmount + 1) return 'danger';
  if (totalSplit.value >= props.totalAmount - 1) return 'success';
  return 'primary';
});

const isBalanced = computed(() => {
  return Math.abs(totalSplit.value - props.totalAmount) <= 1;
});

const canApply = computed(() => {
  return props.splitData.participants.length > 0 && isBalanced.value;
});

const sectionFade = {
  enterActiveClass: 'section-fade-enter-active',
  enterFromClass: 'section-fade-enter-from',
  enterToClass: 'section-fade-enter-to',
  leaveActiveClass: 'section-fade-leave-active',
  leaveFromClass: 'section-fade-leave-from',
  leaveToClass: 'section-fade-leave-to',
};

// Editing state for custom amounts
const editingParticipantId = ref<string | null>(null);
const amountInputRefs: Record<string, HTMLInputElement | null> = {};
const refCallbacks: Record<string, (el: Element | ComponentPublicInstance | null) => void> = {};

function setAmountInputRef(id: string) {
  if (!refCallbacks[id]) {
    refCallbacks[id] = (el: Element | ComponentPublicInstance | null) => {
      amountInputRefs[id] = el as HTMLInputElement | null;
    };
  }
  return refCallbacks[id];
}

function findPerson(name: string) {
  return people.value.find((p) => p.name.toLowerCase() === name.toLowerCase());
}

function handleAddParticipant(name?: string) {
  const participantName = (typeof name === 'string' ? name : newParticipantName.value).trim();
  if (participantName) {
    const matched = findPerson(participantName);
    emit('addParticipant', participantName, !!matched, matched?.color);
    newParticipantName.value = '';
  }
}

function handleQuickAdd(person: { name: string; color: string }) {
  const matched = findPerson(person.name);
  emit('addParticipant', person.name, true, matched?.color || person.color);
}

function handleAmountTap(participantId: string) {
  if (props.splitData.method === 'equal') {
    emit('setMethod', 'custom');
  }
  editingParticipantId.value = participantId;
  nextTick(() => {
    const input = amountInputRefs[participantId];
    input?.focus();
    input?.select();
  });
}

function handleAmountBlur() {
  editingParticipantId.value = null;
}

function handleOpenChange(open: boolean) {
  emit('update:open', open);
}

// Auto-enable split when drawer opens + setup keyboard listener
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      if (!props.splitData.enabled) {
        emit('setEnabled', true);
      }
      setupKeyboardListener();
    } else {
      cleanupKeyboardListener();
    }
  },
);
</script>

<template>
  <DrawerRoot :open="open" @update:open="handleOpenChange">
    <DrawerPortal>
      <DrawerOverlay class="fixed inset-0 z-50 bg-black/40" />
      <DrawerContent
        data-split-drawer
        class="fixed bottom-0 left-0 right-0 z-50 flex flex-col rounded-t-2xl bg-card-light dark:bg-card-dark border-t border-border-light dark:border-border-dark"
        style="max-height: 90dvh"
      >
        <!-- Handle -->
        <div class="flex justify-center pt-3 pb-1">
          <DrawerHandle class="w-10 h-1 rounded-full bg-border-light dark:bg-border-dark" />
        </div>

        <!-- Header -->
        <div class="flex items-center justify-between px-5 pb-3">
          <DrawerTitle
            class="text-base font-semibold text-text-primary-light dark:text-text-primary-dark"
          >
            Разделить {{ formatCurrency(totalAmount, currency) }}
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
          class="flex-1 overflow-y-auto px-5 pb-5 space-y-4 overscroll-contain"
          data-vaul-no-drag
        >
          <!-- Person search -->
          <PersonSelector
            v-model="newParticipantName"
            :people="availablePeople"
            :auto-save="false"
            placeholder="Добавить участника..."
            @select="handleAddParticipant"
            @save-person="(name: string) => createPerson({ name })"
          />

          <!-- Quick contact chips -->
          <Transition v-bind="sectionFade">
            <div v-if="quickContacts.length > 0" class="flex gap-1.5 overflow-x-auto no-scrollbar">
              <button
                v-for="person in quickContacts"
                :key="person.id"
                type="button"
                class="flex items-center gap-1 px-2.5 py-1 rounded-full border border-dashed border-border-light dark:border-border-dark hover:border-primary hover:bg-primary-light text-text-tertiary-light dark:text-text-tertiary-dark hover:text-primary transition-all duration-150 shrink-0 active:scale-95"
                @click="handleQuickAdd(person)"
              >
                <UIcon name="add" size="xs" />
                <span class="text-xs whitespace-nowrap">{{ person.name }}</span>
              </button>
            </div>
          </Transition>

          <!-- Participants list -->
          <Transition v-bind="sectionFade">
            <div
              v-if="splitData.participants.length > 0 || splitData.isIncluded"
              class="space-y-1.5"
            >
              <div class="flex items-center justify-between">
                <span
                  class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark"
                >
                  Участники
                </span>
                <button
                  v-if="splitData.method === 'custom'"
                  type="button"
                  class="text-xs text-primary font-medium hover:underline"
                  @click="$emit('setMethod', 'equal')"
                >
                  Поровну
                </button>
              </div>

              <!-- My row -->
              <Transition v-bind="sectionFade">
                <div
                  v-if="splitData.isIncluded"
                  class="flex items-center gap-2.5 p-2.5 rounded-xl bg-primary/[0.04] dark:bg-primary/[0.08] border border-primary/10"
                >
                  <div
                    class="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0"
                  >
                    <UIcon name="person" size="sm" class="text-primary" />
                  </div>
                  <span
                    class="flex-1 min-w-0 text-sm font-medium text-text-primary-light dark:text-text-primary-dark"
                  >
                    Вы
                  </span>
                  <button
                    type="button"
                    class="text-sm font-semibold text-primary tabular-nums"
                    @click="handleAmountTap('my-share')"
                  >
                    <template v-if="editingParticipantId === 'my-share'">
                      <input
                        :ref="setAmountInputRef('my-share')"
                        :value="splitData.myShare ? formatNumberWithSpaces(splitData.myShare) : ''"
                        type="text"
                        inputmode="decimal"
                        class="w-20 text-right bg-transparent border-b-2 border-primary outline-none text-sm font-semibold text-primary tabular-nums"
                        @input="
                          $emit(
                            'setMyShare',
                            Number(($event.target as HTMLInputElement).value.replace(/\s/g, '')) ||
                              0,
                          )
                        "
                        @blur="handleAmountBlur"
                        @keydown.enter.prevent="handleAmountBlur"
                      />
                    </template>
                    <template v-else>
                      {{ formatCurrency(splitData.myShare, currency) }}
                    </template>
                  </button>
                </div>
              </Transition>

              <!-- Participant rows -->
              <TransitionGroup
                tag="div"
                class="space-y-1.5 relative"
                enter-active-class="participant-enter-active"
                enter-from-class="participant-enter-from"
                enter-to-class="participant-enter-to"
                leave-active-class="participant-leave-active"
                leave-from-class="participant-leave-from"
                leave-to-class="participant-leave-to"
                move-class="participant-move"
              >
                <div
                  v-for="participant in splitData.participants"
                  :key="participant.id"
                  class="flex items-center gap-2.5 p-2.5 rounded-xl bg-surface-light dark:bg-surface-dark"
                >
                  <InitialAvatar
                    :name="participant.personName"
                    :color="participant.personColor || '#3b82f6'"
                    size="md"
                    translucent
                  />
                  <span
                    class="flex-1 min-w-0 text-sm font-medium text-text-primary-light dark:text-text-primary-dark truncate"
                  >
                    {{ participant.personName }}
                  </span>

                  <!-- Amount: tap to edit -->
                  <button
                    v-if="editingParticipantId !== participant.id"
                    type="button"
                    class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark tabular-nums"
                    :class="
                      splitData.method === 'equal'
                        ? ''
                        : 'underline decoration-dashed decoration-text-tertiary-light dark:decoration-text-tertiary-dark underline-offset-4'
                    "
                    @click="handleAmountTap(participant.id)"
                  >
                    {{ formatCurrency(participant.amount, currency) }}
                  </button>
                  <input
                    v-else
                    :ref="setAmountInputRef(participant.id)"
                    :value="participant.amount ? formatNumberWithSpaces(participant.amount) : ''"
                    type="text"
                    inputmode="decimal"
                    class="w-20 text-right bg-transparent border-b-2 border-primary outline-none text-sm font-semibold text-primary tabular-nums"
                    @input="
                      $emit(
                        'updateParticipantAmount',
                        participant.id,
                        Number(($event.target as HTMLInputElement).value.replace(/\s/g, '')) || 0,
                      )
                    "
                    @blur="handleAmountBlur"
                    @keydown.enter.prevent="handleAmountBlur"
                  />

                  <button
                    type="button"
                    class="p-1 text-text-tertiary-light dark:text-text-tertiary-dark hover:text-danger transition-colors"
                    @click="$emit('removeParticipant', participant.id)"
                  >
                    <UIcon name="close" size="xs" />
                  </button>
                </div>
              </TransitionGroup>
            </div>
          </Transition>

          <!-- Not participating toggle -->
          <Transition v-bind="sectionFade">
            <button
              v-if="splitData.participants.length > 0"
              type="button"
              class="flex items-center gap-2 px-3 py-2 rounded-lg border transition-all active:scale-[0.98]"
              :class="
                splitData.isIncluded
                  ? 'border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark text-text-secondary-light dark:text-text-secondary-dark'
                  : 'border-primary bg-primary/[0.06] dark:bg-primary/[0.12] text-primary'
              "
              @click="$emit('setIsIncluded', !splitData.isIncluded)"
            >
              <div
                class="w-4 h-4 rounded border flex items-center justify-center transition-colors"
                :class="
                  !splitData.isIncluded
                    ? 'bg-primary border-primary text-white'
                    : 'border-text-tertiary-light dark:border-text-tertiary-dark'
                "
              >
                <UIcon v-if="!splitData.isIncluded" name="check" size="xs" />
              </div>
              <span class="text-xs font-medium">Я не участвую в расходе</span>
            </button>
          </Transition>

          <!-- Summary -->
          <Transition v-bind="sectionFade">
            <div
              v-if="splitData.participants.length > 0"
              class="p-3 rounded-xl bg-surface-light dark:bg-surface-dark space-y-2.5"
            >
              <div class="flex justify-between items-center text-sm">
                <span class="text-text-secondary-light dark:text-text-secondary-dark">
                  Распределено
                </span>
                <span
                  class="font-semibold tabular-nums"
                  :class="
                    isBalanced
                      ? 'text-success'
                      : 'text-text-primary-light dark:text-text-primary-dark'
                  "
                >
                  {{ formatCurrency(totalSplit, currency) }}
                  <span class="text-text-tertiary-light dark:text-text-tertiary-dark font-normal">
                    / {{ formatCurrency(totalAmount, currency) }}
                  </span>
                </span>
              </div>
              <UProgressBar
                :value="totalSplit"
                :max="totalAmount"
                :color="progressColor"
                size="sm"
              />

              <!-- Validation error -->
              <p v-if="validationError" class="text-xs text-danger flex items-center gap-1">
                <UIcon name="error" size="xs" />
                {{ validationError }}
              </p>
            </div>
          </Transition>
        </div>

        <!-- Footer -->
        <div
          data-split-drawer-footer
          class="px-5 pt-3 border-t border-border-light dark:border-border-dark"
          style="padding-bottom: calc(env(safe-area-inset-bottom, 16px) + 1.5rem)"
        >
          <UButton
            type="button"
            variant="primary"
            size="lg"
            full-width
            :disabled="!canApply"
            @click="$emit('update:open', false)"
          >
            Применить
          </UButton>
        </div>
      </DrawerContent>
    </DrawerPortal>
  </DrawerRoot>
</template>

<style scoped>
/* Section collapse — smooth height + opacity */
.section-fade-enter-active {
  transition:
    opacity 350ms ease-out,
    max-height 350ms ease-out;
  overflow: hidden;
}
.section-fade-enter-from {
  opacity: 0;
  max-height: 0;
}
.section-fade-enter-to {
  opacity: 1;
  max-height: 20rem;
}
.section-fade-leave-active {
  transition:
    opacity 200ms ease-in,
    max-height 300ms ease-in;
  overflow: hidden;
}
.section-fade-leave-from {
  opacity: 1;
  max-height: 20rem;
}
.section-fade-leave-to {
  opacity: 0;
  max-height: 0;
}

/* Participant rows */
.participant-enter-active {
  transition:
    opacity 350ms ease-out,
    max-height 350ms ease-out,
    transform 350ms ease-out,
    margin-bottom 350ms ease-out;
  overflow: hidden;
}
.participant-enter-from {
  opacity: 0;
  max-height: 0;
  transform: translateY(-8px) scale(0.95);
  margin-bottom: 0;
}
.participant-enter-to {
  opacity: 1;
  max-height: 4rem;
  transform: translateY(0) scale(1);
  margin-bottom: 0.375rem;
}

.participant-leave-active {
  transition:
    opacity 250ms ease-in,
    max-height 250ms ease-in,
    transform 250ms ease-in,
    margin-bottom 250ms ease-in;
  overflow: hidden;
}
.participant-leave-from {
  opacity: 1;
  max-height: 4rem;
  transform: translateX(0) scale(1);
  margin-bottom: 0.375rem;
}
.participant-leave-to {
  opacity: 0;
  max-height: 0;
  transform: translateX(30px) scale(0.95);
  margin-bottom: 0;
}

.participant-move {
  transition: transform 300ms ease-out;
}
</style>
