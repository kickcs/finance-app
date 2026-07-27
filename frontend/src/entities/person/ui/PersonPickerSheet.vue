<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import {
  DrawerRoot,
  DrawerPortal,
  DrawerOverlay,
  DrawerContent,
  DrawerHandle,
  DrawerTitle,
} from 'vaul-vue';
import { UIcon, UInput, InitialAvatar } from '@/shared/ui';
import { useIsDesktop } from '@/shared/lib/composables/useIsDesktop';
import { useDrawerKeyboard } from '@/shared/lib/composables';
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

const drawerContentRef = ref<{ $el?: HTMLElement } | null>(null);
const footerRef = ref<HTMLDivElement | null>(null);
const scrollContainerRef = ref<HTMLDivElement | null>(null);

const { setupKeyboardListener, cleanupKeyboardListener } = useDrawerKeyboard(
  drawerContentRef,
  footerRef,
  scrollContainerRef,
);

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
// выбирать пальцем, а не печатать.
watch(
  () => props.open,
  async (open) => {
    if (open) {
      searchQuery.value = '';
      await nextTick();
      if (!props.open) return;
      if (isDesktop.value) searchInputRef.value?.focus();
      else setupKeyboardListener();
    } else {
      cleanupKeyboardListener();
    }
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
  <DrawerRoot
    :open="open"
    :direction="isDesktop ? 'right' : 'bottom'"
    @update:open="emit('update:open', $event)"
  >
    <DrawerPortal>
      <DrawerOverlay class="fixed inset-0 z-50 bg-black/40" />
      <DrawerContent
        ref="drawerContentRef"
        class="fixed z-50 flex flex-col bg-card-light dark:bg-card-dark"
        :class="
          isDesktop
            ? 'top-0 right-0 bottom-0 w-[420px] rounded-l-2xl border-l border-border-light dark:border-border-dark'
            : 'bottom-0 left-0 right-0 max-h-[90dvh] rounded-t-2xl border-t border-border-light dark:border-border-dark'
        "
      >
        <div v-if="!isDesktop" class="flex justify-center pb-1 pt-3">
          <DrawerHandle class="h-1 w-10 rounded-full bg-border-light dark:bg-border-dark" />
        </div>

        <div class="flex items-center justify-between px-5 pb-3" :class="{ 'pt-4': isDesktop }">
          <DrawerTitle
            class="text-base font-semibold text-text-primary-light dark:text-text-primary-dark"
          >
            Люди
          </DrawerTitle>
          <button
            type="button"
            aria-label="Закрыть"
            class="flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary-light transition-colors hover:bg-surface-light dark:text-text-secondary-dark dark:hover:bg-surface-dark"
            @click="emit('update:open', false)"
          >
            <UIcon name="close" size="sm" />
          </button>
        </div>

        <div class="px-5 pb-3">
          <UInput
            ref="searchInputRef"
            v-model="searchQuery"
            variant="search"
            placeholder="Поиск или новое имя..."
            data-testid="person-sheet-search"
            @keydown.enter.prevent="handleSearchEnter"
          />
        </div>

        <div
          ref="scrollContainerRef"
          class="flex-1 overflow-y-auto overscroll-contain px-5 pb-5"
          data-vaul-no-drag
        >
          <button
            v-if="canCreate"
            type="button"
            data-testid="person-sheet-create"
            class="mb-1 flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-surface-light dark:hover:bg-surface-dark"
            @click="handleCreate"
          >
            <span
              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10"
            >
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
        </div>

        <!-- Пустой подвал держит отступ под системную полосу жестов: без него
             последняя строка списка упиралась бы в край экрана. -->
        <div ref="footerRef" class="px-5 pb-[calc(env(safe-area-inset-bottom,16px)+0.75rem)]" />
      </DrawerContent>
    </DrawerPortal>
  </DrawerRoot>
</template>
