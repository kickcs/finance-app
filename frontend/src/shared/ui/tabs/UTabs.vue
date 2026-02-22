<script setup lang="ts">
import { computed, ref, watch, onMounted, nextTick } from 'vue';
import { TabsRoot, TabsList, TabsTrigger } from 'reka-ui';
import { useResizeObserver } from '@vueuse/core';
import { cn } from '@/shared/lib/utils';

export interface Tab {
  id: string;
  label: string;
}

export interface TabsProps {
  items: Tab[];
  modelValue: string;
  size?: 'sm' | 'md';
  variant?: 'pills' | 'underline';
}

const props = withDefaults(defineProps<TabsProps>(), {
  size: 'md',
  variant: 'pills',
});

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const sizeClasses = computed(() => ({
  container: props.size === 'sm' ? 'gap-0.5' : 'gap-1',
  button: props.size === 'sm' ? 'py-1.5 px-3 text-xs' : 'py-2 px-4 text-sm',
}));

// --- Sliding indicator (pills variant) ---
const pillsList = ref<InstanceType<typeof TabsList> | null>(null);
const indicatorStyle = ref({ left: '0px', width: '0px' });

function updateIndicator() {
  const el = pillsList.value?.$el as HTMLElement | undefined;
  if (!el) return;
  const active = el.querySelector<HTMLElement>('[data-state=active]');
  if (!active) return;
  const containerRect = el.getBoundingClientRect();
  const activeRect = active.getBoundingClientRect();
  indicatorStyle.value = {
    left: `${activeRect.left - containerRect.left + el.scrollLeft}px`,
    width: `${activeRect.width}px`,
  };
}

const pillsEl = computed(() =>
  props.variant === 'pills' ? (pillsList.value?.$el as HTMLElement | undefined) : undefined,
);

useResizeObserver(pillsEl, updateIndicator);

onMounted(() => {
  if (props.variant !== 'pills') return;
  nextTick(updateIndicator);
});

watch(
  () => props.modelValue,
  () => {
    if (props.variant === 'pills') nextTick(updateIndicator);
  },
);
watch(
  () => props.items,
  () => {
    if (props.variant === 'pills') nextTick(updateIndicator);
  },
);
</script>

<template>
  <TabsRoot
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event as string)"
  >
    <!-- Pills variant -->
    <TabsList
      v-if="variant === 'pills'"
      ref="pillsList"
      :class="
        cn(
          'relative bg-surface-light dark:bg-surface-dark rounded-lg p-1 flex items-center w-full overflow-x-auto no-scrollbar',
        )
      "
    >
      <!-- Sliding indicator -->
      <span
        class="absolute top-1 bottom-1 rounded-md bg-card-light dark:bg-card-dark shadow-sm pointer-events-none transition-all duration-250 ease-out"
        :style="indicatorStyle"
      />
      <TabsTrigger
        v-for="tab in items"
        :key="tab.id"
        :value="tab.id"
        :class="
          cn(
            'relative z-10 flex-1 min-w-fit flex-shrink-0 font-medium rounded-md transition-colors duration-200 border-none outline-none whitespace-nowrap text-center',
            sizeClasses.button,
            'data-[state=active]:text-text-primary-light dark:data-[state=active]:text-text-primary-dark',
            'data-[state=inactive]:text-text-secondary-light dark:data-[state=inactive]:text-text-secondary-dark',
            'hover:text-text-primary-light dark:hover:text-text-primary-dark',
            'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0',
          )
        "
      >
        {{ tab.label }}
      </TabsTrigger>
    </TabsList>

    <!-- Underline variant -->
    <TabsList
      v-else
      :class="
        cn(
          'flex items-center w-full overflow-x-auto no-scrollbar border-b border-border-light dark:border-border-dark',
          sizeClasses.container,
        )
      "
    >
      <TabsTrigger
        v-for="tab in items"
        :key="tab.id"
        :value="tab.id"
        :class="
          cn(
            'relative min-w-fit flex-shrink-0 font-medium transition-all duration-150 border-none outline-none whitespace-nowrap -mb-px',
            sizeClasses.button,
            'data-[state=active]:text-primary',
            'data-[state=inactive]:text-text-secondary-light dark:data-[state=inactive]:text-text-secondary-dark',
            'hover:text-text-primary-light dark:hover:text-text-primary-dark',
            'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0',
            'data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-0 data-[state=active]:after:right-0 data-[state=active]:after:h-0.5 data-[state=active]:after:bg-primary data-[state=active]:after:rounded-full',
          )
        "
      >
        {{ tab.label }}
      </TabsTrigger>
    </TabsList>
  </TabsRoot>
</template>
