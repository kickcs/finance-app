<script setup lang="ts">
import { ref, computed } from 'vue';
import { UIcon, UInput, InitialAvatar } from '@/shared/ui';
import type { Person } from '../model/types';

const props = withDefaults(
  defineProps<{
    modelValue: string;
    people: Person[];
    label?: string;
    placeholder?: string;
    /** When false, selecting a free-text name only emits 'select' without 'save-person' */
    autoSave?: boolean;
  }>(),
  {
    placeholder: 'Имя человека',
    autoSave: true,
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: string];
  'save-person': [name: string];
  select: [name: string];
}>();

const isFocused = ref(false);
let blurTimeout: ReturnType<typeof setTimeout> | null = null;

const sortedPeople = computed(() => {
  return [...props.people].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
});

const filteredPeople = computed(() => {
  const query = props.modelValue.trim().toLowerCase();
  if (!query) return sortedPeople.value;
  return sortedPeople.value.filter((p) => p.name.toLowerCase().includes(query));
});

const canSave = computed(() => {
  const trimmed = props.modelValue.trim();
  if (!trimmed) return false;
  return !props.people.some((p) => p.name.toLowerCase() === trimmed.toLowerCase());
});

const showList = computed(() => {
  return isFocused.value && (filteredPeople.value.length > 0 || canSave.value);
});

function handleInput(val: string | number) {
  emit('update:modelValue', String(val));
  isFocused.value = true;
}

function handleFocus() {
  if (blurTimeout) {
    clearTimeout(blurTimeout);
    blurTimeout = null;
  }
  isFocused.value = true;
}

function handleBlur() {
  blurTimeout = setTimeout(() => {
    isFocused.value = false;
  }, 300);
}

function selectPerson(person: Person) {
  emit('update:modelValue', person.name);
  emit('select', person.name);
  isFocused.value = false;
}

function handleAdd() {
  const name = props.modelValue.trim();
  if (!name) return;
  if (props.autoSave) {
    emit('save-person', name);
  }
  emit('select', name);
  isFocused.value = false;
}

function handleSaveAndAdd() {
  const name = props.modelValue.trim();
  if (!name) return;
  emit('save-person', name);
  emit('select', name);
  isFocused.value = false;
}
</script>

<template>
  <div class="w-full">
    <div v-if="label" class="mb-2">
      <span class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark">
        {{ label }}
      </span>
    </div>

    <!-- Input -->
    <UInput
      :model-value="String(modelValue)"
      type="text"
      :placeholder="placeholder"
      @update:model-value="handleInput"
      @focus="handleFocus"
      @blur="handleBlur"
      @keydown="
        (e: KeyboardEvent) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (canSave) handleAdd();
            else if (filteredPeople.length > 0) selectPerson(filteredPeople[0]);
          }
        }
      "
    />

    <!-- Inline list (in-flow, not absolute) -->
    <Transition
      enter-active-class="person-list-enter-active"
      enter-from-class="person-list-enter-from"
      enter-to-class="person-list-enter-to"
      leave-active-class="transition-all duration-200 ease-in"
      leave-from-class="opacity-100 max-h-36 scale-y-100 origin-top"
      leave-to-class="opacity-0 max-h-0 scale-y-95 origin-top"
    >
      <div
        v-if="showList"
        class="mt-2 bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-xl max-h-36 overflow-y-auto overflow-x-hidden overscroll-contain"
      >
        <div class="p-2">
          <!-- Existing Contacts (2-column grid) -->
          <div class="grid grid-cols-2 gap-1.5">
            <button
              v-for="(person, i) in filteredPeople"
              :key="person.id"
              type="button"
              class="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-surface-hover-light dark:hover:bg-surface-hover-dark transition-all active:bg-surface-light dark:active:bg-surface-dark"
              :style="{ animationDelay: `${i * 30}ms` }"
              style="animation: person-item-in 200ms ease-out both"
              @mousedown.prevent
              @touchend.prevent="selectPerson(person)"
              @click="selectPerson(person)"
            >
              <InitialAvatar :name="person.name" :color="person.color" size="sm" class="shrink-0" />
              <span
                class="text-xs font-medium text-text-primary-light dark:text-text-primary-dark truncate text-left"
              >
                {{ person.name }}
              </span>
            </button>
          </div>

          <!-- Add / Create actions (at bottom) -->
          <template v-if="canSave">
            <div
              v-if="filteredPeople.length > 0"
              class="border-t border-border-light/50 dark:border-border-dark/50 mt-1.5 pt-1.5"
            />
            <!-- When autoSave=false: "Add" (no contact creation) -->
            <button
              v-if="!autoSave"
              type="button"
              class="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-surface-hover-light dark:hover:bg-surface-hover-dark transition-colors active:bg-surface-light dark:active:bg-surface-dark"
              @mousedown.prevent
              @touchend.prevent="handleAdd"
              @click="handleAdd"
            >
              <div
                class="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0"
              >
                <UIcon name="add" size="xs" class="text-primary" />
              </div>
              <span class="text-xs font-medium text-primary truncate text-left">
                Добавить «{{ modelValue.trim() }}»
              </span>
            </button>

            <!-- Save as contact (secondary when autoSave=false, primary when autoSave=true) -->
            <button
              type="button"
              class="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-surface-hover-light dark:hover:bg-surface-hover-dark transition-colors active:bg-surface-light dark:active:bg-surface-dark"
              @mousedown.prevent
              @touchend.prevent="autoSave ? handleAdd() : handleSaveAndAdd()"
              @click="autoSave ? handleAdd() : handleSaveAndAdd()"
            >
              <div
                class="w-7 h-7 rounded-full bg-surface-light dark:bg-surface-dark flex items-center justify-center shrink-0"
              >
                <UIcon
                  :name="autoSave ? 'add' : 'person_add'"
                  size="xs"
                  class="text-text-secondary-light dark:text-text-secondary-dark"
                />
              </div>
              <span
                class="text-xs text-text-secondary-light dark:text-text-secondary-dark truncate text-left"
              >
                {{
                  autoSave
                    ? `Создать «${modelValue.trim()}»`
                    : `Сохранить и добавить «${modelValue.trim()}»`
                }}
              </span>
            </button>
          </template>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.person-list-enter-active {
  transition:
    opacity 350ms ease-out,
    max-height 350ms ease-out,
    margin-top 350ms ease-out;
  overflow: hidden;
}
.person-list-enter-from {
  opacity: 0;
  max-height: 0;
  margin-top: 0;
}
.person-list-enter-to {
  opacity: 1;
  max-height: 9rem;
  margin-top: 0.5rem;
}

@keyframes person-item-in {
  from {
    opacity: 0;
    transform: translateY(-6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
