<script setup lang="ts">
import { ref } from 'vue';
import { UButton, UIcon, USpinner, ConfirmDeleteModal } from '@/shared/ui';
import { SubscriptionForm } from '@/features/create-subscription';
import { useHaptics } from '@/shared/lib/haptics';
import { useEditSubscription } from '../model/useEditSubscription';
import type { MaybeRefOrGetter } from 'vue';
import type { RecurringSubscriptionInsert } from '@/entities/recurring-subscription';

const props = defineProps<{
  userId: MaybeRefOrGetter<string | null>;
  subscriptionId: MaybeRefOrGetter<string | null>;
}>();

const emit = defineEmits<{
  saved: [];
  deleted: [];
}>();

const { trigger } = useHaptics();
const showDeleteModal = ref(false);

const {
  subscription,
  formData,
  isLoading,
  isSubmitting,
  isPaused,
  error,
  saveSubscription,
  togglePause,
  removeSubscription,
} = useEditSubscription(props.userId, props.subscriptionId);

function handleFormUpdate(data: RecurringSubscriptionInsert) {
  formData.value = data;
}

async function handleSave() {
  const success = await saveSubscription();
  if (success) {
    trigger('success');
    emit('saved');
  }
}

async function handleTogglePause() {
  trigger('selection');
  await togglePause();
}

async function handleDelete() {
  const success = await removeSubscription();
  if (success) {
    trigger('success');
    showDeleteModal.value = false;
    emit('deleted');
  }
}
</script>

<template>
  <div v-if="isLoading" class="flex items-center justify-center py-12">
    <USpinner />
  </div>

  <div v-else-if="subscription" class="space-y-5">
    <SubscriptionForm
      :form-data="formData"
      :is-submitting="isSubmitting"
      :show-preset-picker="false"
      submit-label="Сохранить"
      @update:form-data="handleFormUpdate"
      @submit="handleSave"
    />

    <!-- Action buttons -->
    <div class="flex gap-3">
      <UButton variant="secondary" size="lg" full-width @click="handleTogglePause">
        <UIcon :name="isPaused ? 'play_arrow' : 'pause'" size="sm" />
        {{ isPaused ? 'Возобновить' : 'Приостановить' }}
      </UButton>
      <UButton
        variant="secondary"
        size="lg"
        class="!text-danger shrink-0"
        @click="(trigger('selection'), (showDeleteModal = true))"
      >
        <UIcon name="delete" size="sm" />
      </UButton>
    </div>

    <!-- Error -->
    <p v-if="error" class="text-sm text-danger">{{ error }}</p>

    <!-- Delete confirmation -->
    <ConfirmDeleteModal
      v-model:model-value="showDeleteModal"
      title="Удалить подписку?"
      :warning-text="`Подписка «${subscription.name}» будет удалена. Это действие нельзя отменить.`"
      confirm-label="Удалить"
      @confirm="handleDelete"
    />
  </div>
</template>
