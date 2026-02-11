<script setup lang="ts">
import { computed } from 'vue'
import { TabsRoot, TabsList, TabsTrigger } from 'reka-ui'
import { cn } from '@/shared/lib/utils'

export interface Tab {
  id: string
  label: string
}

export interface TabsProps {
  items: Tab[]
  modelValue: string
  size?: 'sm' | 'md'
  variant?: 'pills' | 'underline'
}

const props = withDefaults(defineProps<TabsProps>(), {
  size: 'md',
  variant: 'pills',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const sizeClasses = computed(() => ({
  container: props.size === 'sm' ? 'gap-0.5' : 'gap-1',
  button: props.size === 'sm' ? 'py-1.5 px-3 text-xs' : 'py-2 px-4 text-sm',
}))
</script>

<template>
  <TabsRoot
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event as string)"
  >
    <!-- Pills variant -->
    <TabsList
      v-if="variant === 'pills'"
      :class="cn(
        'bg-surface-light dark:bg-surface-dark rounded-lg p-1 flex items-center w-full overflow-x-auto no-scrollbar',
        sizeClasses.container
      )"
    >
      <TabsTrigger
        v-for="tab in items"
        :key="tab.id"
        :value="tab.id"
        :class="cn(
          'flex-1 min-w-fit flex-shrink-0 font-medium rounded-md transition-all duration-150 border-none outline-none whitespace-nowrap',
          sizeClasses.button,
          'data-[state=active]:bg-card-light dark:data-[state=active]:bg-card-dark',
          'data-[state=active]:text-text-primary-light dark:data-[state=active]:text-text-primary-dark',
          'data-[state=inactive]:text-text-secondary-light dark:data-[state=inactive]:text-text-secondary-dark',
          'data-[state=inactive]:bg-transparent',
          'hover:text-text-primary-light dark:hover:text-text-primary-dark',
          'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0'
        )"
      >
        {{ tab.label }}
      </TabsTrigger>
    </TabsList>

    <!-- Underline variant -->
    <TabsList
      v-else
      :class="cn(
        'flex items-center w-full overflow-x-auto no-scrollbar border-b border-border-light dark:border-border-dark',
        sizeClasses.container
      )"
    >
      <TabsTrigger
        v-for="tab in items"
        :key="tab.id"
        :value="tab.id"
        :class="cn(
          'relative min-w-fit flex-shrink-0 font-medium transition-all duration-150 border-none outline-none whitespace-nowrap -mb-px',
          sizeClasses.button,
          'data-[state=active]:text-primary',
          'data-[state=inactive]:text-text-secondary-light dark:data-[state=inactive]:text-text-secondary-dark',
          'hover:text-text-primary-light dark:hover:text-text-primary-dark',
          'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0',
          'data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-0 data-[state=active]:after:right-0 data-[state=active]:after:h-0.5 data-[state=active]:after:bg-primary data-[state=active]:after:rounded-full'
        )"
      >
        {{ tab.label }}
      </TabsTrigger>
    </TabsList>
  </TabsRoot>
</template>
