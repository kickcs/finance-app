<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import {
  DrawerRoot,
  DrawerPortal,
  DrawerOverlay,
  DrawerContent,
  DrawerHandle,
  DrawerTitle,
} from 'vaul-vue';
import { UInput, UButton, UIcon } from '@/shared/ui';
import { useIsDesktop } from '@/shared/lib/composables/useIsDesktop';
import { useDrawerKeyboard } from '@/shared/lib/composables/useDrawerKeyboard';
import { useHashtagSuggestions } from '@/features/add-transaction';
import type { Hashtag } from '@/entities/transaction';

const props = defineProps<{
  open: boolean;
  modelValue: string;
  hashtags: Hashtag[];
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
  'update:modelValue': [value: string];
}>();

const isDesktop = useIsDesktop();

// Черновик: применяется только по «Сохранить», закрытие свайпом не портит значение.
const draft = ref(props.modelValue);

const inputWrapRef = ref<HTMLDivElement | null>(null);

const { filtered, buildInsertedDescription } = useHashtagSuggestions(
  () => draft.value,
  () => props.hashtags,
);

function insertHashtag(tag: string) {
  draft.value = buildInsertedDescription(tag);
}

function save() {
  emit('update:modelValue', draft.value.trim());
  emit('update:open', false);
}

const drawerContentRef = ref<{ $el?: HTMLElement } | null>(null);
const footerRef = ref<HTMLDivElement | null>(null);
const scrollRef = ref<HTMLDivElement | null>(null);
const { setupKeyboardListener, cleanupKeyboardListener } = useDrawerKeyboard(
  drawerContentRef,
  footerRef,
  scrollRef,
);

watch(
  () => props.open,
  (open) => {
    if (open) {
      draft.value = props.modelValue;
      nextTick(() => {
        setupKeyboardListener();
        inputWrapRef.value?.querySelector('input')?.focus();
      });
    } else {
      cleanupKeyboardListener();
    }
  },
);
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
            : 'bottom-0 left-0 right-0 rounded-t-2xl border-t border-border-light dark:border-border-dark'
        "
      >
        <div v-if="!isDesktop" class="flex justify-center pt-3 pb-1">
          <DrawerHandle class="w-10 h-1 rounded-full bg-border-light dark:bg-border-dark" />
        </div>

        <div class="px-5 pb-2" :class="{ 'pt-4': isDesktop }">
          <div class="flex items-center justify-between">
            <DrawerTitle
              class="text-base font-semibold text-text-primary-light dark:text-text-primary-dark"
            >
              Комментарий
            </DrawerTitle>
            <button
              type="button"
              aria-label="Закрыть"
              class="w-8 h-8 rounded-lg flex items-center justify-center text-text-secondary-light dark:text-text-secondary-dark hover:bg-surface-light dark:hover:bg-surface-dark transition-colors"
              @click="emit('update:open', false)"
            >
              <UIcon name="close" size="sm" />
            </button>
          </div>
        </div>

        <div ref="scrollRef" class="px-5 space-y-3" data-vaul-no-drag>
          <div ref="inputWrapRef">
            <UInput
              :model-value="draft"
              placeholder="#продукты, #кафе, #такси..."
              @update:model-value="draft = $event as string"
              @keydown.enter.prevent="save"
            />
          </div>

          <div v-if="filtered.length > 0" class="flex gap-1.5 overflow-x-auto no-scrollbar py-1">
            <button
              v-for="h in filtered"
              :key="h.tag"
              type="button"
              class="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium bg-surface-light dark:bg-surface-dark text-text-secondary-light dark:text-text-secondary-dark border border-border-light dark:border-border-dark active:scale-95 transition-all"
              @mousedown.prevent="insertHashtag(h.tag)"
            >
              {{ h.tag }}
            </button>
          </div>
        </div>

        <div ref="footerRef" class="px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <UButton variant="primary" size="md" full-width @click="save">Сохранить</UButton>
        </div>
      </DrawerContent>
    </DrawerPortal>
  </DrawerRoot>
</template>
