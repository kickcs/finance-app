<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { UIcon, UInput, InitialAvatar } from '@/shared/ui';
import { UOverlay } from '@/shared/ui/overlay';
import { useIsDesktop } from '@/shared/lib/composables/useIsDesktop';
import { personKey } from '../lib/foldDebtsByPersonName';
import type { Person } from '../model/types';

/**
 * Полный список людей с поиском — вторая половина `PersonPicker`.
 *
 * Здесь же заводится человек, которого ещё нет в контактах: свободный ввод,
 * который раньше умел текстовый `PersonSelector`, никуда не делся, просто
 * перестал быть единственным способом что-либо выбрать.
 */
const props = defineProps<{
  open: boolean;
  /** Уже отранжированный список — шит порядок не трогает. */
  people: Person[];
  /** Имена выбранных: одно в обычном режиме, сколько угодно в `multiple`. */
  selected: string[];
  multiple?: boolean;
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
  select: [name: string];
  create: [name: string];
}>();

const isDesktop = useIsDesktop();

const searchQuery = ref('');
const searchInputRef = ref<InstanceType<typeof UInput> | null>(null);

const selectedKeys = computed(() => new Set(props.selected.map(personKey)));

const filtered = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) return props.people;
  return props.people.filter((p) => p.name.toLowerCase().includes(query));
});

/** Имя, которого нет среди контактов, — предлагаем завести. */
const canCreate = computed(() => {
  const trimmed = searchQuery.value.trim();
  if (!trimmed) return false;
  return !props.people.some((p) => personKey(p.name) === personKey(trimmed));
});

// При открытии сбрасываем поиск. Автофокус только на desktop: на мобиле
// клавиатура сразу съела бы половину шита, а список для того и открыт, чтобы
// выбирать пальцем, а не печатать. Клавиатурный хак для мобилы теперь внутри
// UOverlay — здесь им управлять больше не нужно.
watch(
  () => props.open,
  async (open) => {
    if (!open) return;
    searchQuery.value = '';
    await nextTick();
    if (!props.open) return;
    if (isDesktop.value) searchInputRef.value?.focus();
  },
  { immediate: true },
);

function handleSelect(name: string) {
  emit('select', name);
  // Мультивыбор оставляет шит открытым: участников обычно несколько, и
  // переоткрывать его на каждого — та же морока, от которой уходим.
  if (!props.multiple) emit('update:open', false);
}

function handleCreate() {
  const name = searchQuery.value.trim();
  if (!name) return;
  emit('create', name);
  emit('select', name);
  searchQuery.value = '';
  if (!props.multiple) emit('update:open', false);
}

/** Enter — кнопка «Готово» мобильной клавиатуры: берём первое совпадение. */
function handleSearchEnter() {
  if (filtered.value.length > 0) handleSelect(filtered.value[0].name);
  else if (canCreate.value) handleCreate();
}
</script>

<template>
  <UOverlay
    :model-value="open"
    title="Люди"
    desktop="dialog"
    @update:model-value="emit('update:open', $event)"
  >
    <!-- Поиск: sticky над списком, чтобы не уезжал при скролле -->
    <div class="sticky -top-4 -mx-5 -mt-4 z-10 bg-card-light dark:bg-card-dark px-5 pt-4 pb-3">
      <UInput
        ref="searchInputRef"
        v-model="searchQuery"
        variant="search"
        placeholder="Поиск или новое имя..."
        data-testid="person-sheet-search"
        @keydown.enter.prevent="handleSearchEnter"
      />
    </div>

    <button
      v-if="canCreate"
      type="button"
      data-testid="person-sheet-create"
      class="mb-1 flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-surface-light dark:hover:bg-surface-dark"
      @click="handleCreate"
    >
      <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <UIcon name="person_add" size="sm" class="text-primary" />
      </span>
      <span class="min-w-0 flex-1 truncate text-sm font-medium text-primary">
        Создать «{{ searchQuery.trim() }}»
      </span>
    </button>

    <button
      v-for="person in filtered"
      :key="person.id"
      type="button"
      data-testid="person-sheet-row"
      class="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-surface-light dark:hover:bg-surface-dark"
      @click="handleSelect(person.name)"
    >
      <InitialAvatar :name="person.name" :color="person.color" size="md" translucent />
      <span
        class="min-w-0 flex-1 truncate text-sm font-medium text-text-primary-light dark:text-text-primary-dark"
      >
        {{ person.name }}
      </span>
      <UIcon
        v-if="selectedKeys.has(personKey(person.name))"
        name="check"
        size="sm"
        class="shrink-0 text-primary"
      />
    </button>

    <!-- Достижимо только на пустом списке контактов: как только в поиске
         появляется текст, которого нет среди имён, вместо этой строки
         встаёт «Создать «…»». Поэтому здесь не «ничего не найдено», а
         приглашение завести первого. -->
    <p
      v-if="!filtered.length && !canCreate"
      class="py-8 text-center text-sm text-text-tertiary-light dark:text-text-tertiary-dark"
    >
      Введите имя, чтобы добавить человека
    </p>

    <!-- Гарантированный отступ снизу под системную полосу жестов: без него
         последняя строка списка упиралась бы в край экрана. -->
    <div class="pb-[env(safe-area-inset-bottom)]" />
  </UOverlay>
</template>
