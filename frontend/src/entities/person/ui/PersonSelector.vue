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
  }>(),
  {
    placeholder: 'Имя человека',
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: string];
  'save-person': [name: string];
  select: [name: string];
}>();

const isFocused = ref(false);

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
  isFocused.value = true;
}

function handleBlur() {
  isFocused.value = false;
}

function selectPerson(person: Person) {
  emit('update:modelValue', person.name);
  emit('select', person.name);
  isFocused.value = false;
}

function handleCreate() {
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
            if (canSave) handleCreate();
            else if (filteredPeople.length > 0) selectPerson(filteredPeople[0]);
          }
        }
      "
    />

    <!-- Inline list (in-flow, not absolute) -->
    <div
      v-if="showList"
      class="mt-2 bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-xl max-h-72 overflow-y-auto overscroll-contain animate-in fade-in slide-in-from-top-2 duration-200"
    >
      <div class="py-1 flex flex-col min-w-0">
        <!-- Create New Action -->
        <button
          v-if="canSave"
          type="button"
          class="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-hover-light dark:hover:bg-surface-hover-dark transition-colors active:bg-surface-light dark:active:bg-surface-dark border-b border-border-light/50 dark:border-border-dark/50"
          @mousedown.prevent
          @touchend.prevent="handleCreate"
          @click="handleCreate"
        >
          <div class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <UIcon name="add" size="sm" class="text-primary" />
          </div>
          <div class="flex-1 text-left min-w-0 flex flex-col">
            <span class="text-sm font-semibold text-primary truncate">
              Создать «{{ modelValue.trim() }}»
            </span>
            <span class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark">
              Новый контакт
            </span>
          </div>
        </button>

        <!-- Existing Contacts -->
        <button
          v-for="person in filteredPeople"
          :key="person.id"
          type="button"
          class="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-surface-hover-light dark:hover:bg-surface-hover-dark transition-colors active:bg-surface-light dark:active:bg-surface-dark"
          @mousedown.prevent
          @touchend.prevent="selectPerson(person)"
          @click="selectPerson(person)"
        >
          <InitialAvatar :name="person.name" :color="person.color" size="md" class="shrink-0" />
          <span
            class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark truncate text-left"
          >
            {{ person.name }}
          </span>
        </button>
      </div>
    </div>
  </div>
</template>
