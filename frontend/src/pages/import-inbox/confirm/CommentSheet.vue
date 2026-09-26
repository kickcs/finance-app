<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import { UOverlay } from '@/shared/ui/overlay';
import { UInput, UButton } from '@/shared/ui';
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

watch(
  () => props.open,
  (open) => {
    if (open) {
      draft.value = props.modelValue;
      nextTick(() => inputWrapRef.value?.querySelector('input')?.focus());
    }
  },
);
</script>

<template>
  <UOverlay
    :model-value="open"
    title="Комментарий"
    fill
    @update:model-value="emit('update:open', $event)"
  >
    <template #action>
      <UButton variant="primary" size="sm" @click="save">Сохранить</UButton>
    </template>

    <div class="space-y-3">
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
  </UOverlay>
</template>
