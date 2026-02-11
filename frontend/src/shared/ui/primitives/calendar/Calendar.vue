<script setup lang="ts">
import type { DateValue } from '@internationalized/date'
import {
  CalendarCell,
  CalendarCellTrigger,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHead,
  CalendarGridRow,
  CalendarHeadCell,
  CalendarHeader,
  CalendarHeading,
  CalendarNext,
  CalendarPrev,
  CalendarRoot,
} from 'reka-ui'
import { type HTMLAttributes } from 'vue'
import { cn } from '@/shared/lib/utils'

const props = defineProps<{
  modelValue?: DateValue
  class?: HTMLAttributes['class']
  locale?: string
  maxValue?: DateValue
}>()

const emit = defineEmits<{
  'update:modelValue': [value: DateValue | undefined]
}>()
</script>

<template>
  <CalendarRoot
    v-slot="{ grid, weekDays }"
    :model-value="modelValue"
    :locale="locale"
    :max-value="maxValue"
    :class="cn('p-3', props.class)"
    @update:model-value="emit('update:modelValue', $event as DateValue | undefined)"
  >
    <CalendarHeader class="relative flex w-full items-center justify-between pt-1">
      <CalendarPrev
        class="inline-flex size-7 items-center justify-center rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="size-4"
        >
          <path d="m15 18-6-6 6-6" />
        </svg>
      </CalendarPrev>

      <CalendarHeading class="text-sm font-medium" />

      <CalendarNext
        class="inline-flex size-7 items-center justify-center rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="size-4"
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
      </CalendarNext>
    </CalendarHeader>

    <div class="flex flex-col gap-y-4 mt-4 sm:flex-row sm:gap-x-4 sm:gap-y-0">
      <CalendarGrid
        v-for="month in grid"
        :key="month.value.toString()"
        class="w-full border-collapse select-none space-y-1"
      >
        <CalendarGridHead>
          <CalendarGridRow class="flex">
            <CalendarHeadCell
              v-for="day in weekDays"
              :key="day"
              class="w-8 rounded-md text-[0.8rem] font-normal text-gray-500 dark:text-gray-400"
            >
              {{ day }}
            </CalendarHeadCell>
          </CalendarGridRow>
        </CalendarGridHead>
        <CalendarGridBody>
          <CalendarGridRow
            v-for="(weekDates, index) in month.rows"
            :key="`weekDate-${index}`"
            class="flex w-full mt-2"
          >
            <CalendarCell
              v-for="weekDate in weekDates"
              :key="weekDate.toString()"
              :date="weekDate"
              class="relative size-8 p-0 text-center text-sm focus-within:relative focus-within:z-20"
            >
              <CalendarCellTrigger
                :day="weekDate"
                :month="month.value"
                class="inline-flex size-8 items-center justify-center rounded-md text-sm transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 data-[selected]:bg-primary data-[selected]:text-white data-[disabled]:text-gray-300 dark:data-[disabled]:text-gray-600 data-[disabled]:pointer-events-none data-[outside-view]:text-gray-400 dark:data-[outside-view]:text-gray-500 data-[today]:bg-gray-100 dark:data-[today]:bg-gray-800"
              />
            </CalendarCell>
          </CalendarGridRow>
        </CalendarGridBody>
      </CalendarGrid>
    </div>
  </CalendarRoot>
</template>
