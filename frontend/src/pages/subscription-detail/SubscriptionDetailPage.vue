<script setup lang="ts">
import { computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ROUTE_NAMES } from '@/shared/config/routeNames';
import { AppHeader } from '@/widgets/header';
import { SubscriptionForm, useCreateSubscription } from '@/features/create-subscription';
import { EditSubscriptionForm } from '@/features/edit-subscription';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import { navigateBack } from '@/app/router';
import { useHaptics } from '@/shared/lib/haptics';
import type { RecurringSubscriptionInsert } from '@/entities/recurring-subscription';

const router = useRouter();
const route = useRoute();
const { trigger } = useHaptics();
const { userId } = useCurrentUser();

const isNewMode = computed(() => route.name === ROUTE_NAMES.NEW_SUBSCRIPTION);
const subscriptionId = computed(() => (route.params.id as string) || null);

const pageTitle = computed(() => (isNewMode.value ? 'Новая подписка' : 'Подписка'));

// Create mode
const { formData, isSubmitting, createSubscription } = useCreateSubscription(userId);

function handleFormUpdate(data: RecurringSubscriptionInsert) {
  formData.value = data;
}

async function handleCreate() {
  const success = await createSubscription();
  if (success) {
    trigger('success');
    router.replace({ name: ROUTE_NAMES.SUBSCRIPTIONS_LIST });
  }
}

function handleSaved() {
  // Stay on page after edit
}

function handleDeleted() {
  router.replace({ name: ROUTE_NAMES.SUBSCRIPTIONS_LIST });
}

function goBack() {
  navigateBack();
}
</script>

<template>
  <div
    class="h-full flex flex-col relative bg-background-light dark:bg-background-dark pb-28 md:pb-8 overflow-y-auto"
  >
    <!-- Header -->
    <AppHeader :title="pageTitle" show-back blur @back="goBack" />

    <main class="px-5 pt-6 pb-6">
      <!-- Create mode -->
      <template v-if="isNewMode">
        <SubscriptionForm
          :form-data="formData"
          :is-submitting="isSubmitting"
          submit-label="Создать"
          show-preset-picker
          @update:form-data="handleFormUpdate"
          @submit="handleCreate"
        />
      </template>

      <!-- Edit mode -->
      <template v-else>
        <EditSubscriptionForm
          :user-id="userId"
          :subscription-id="subscriptionId"
          @saved="handleSaved"
          @deleted="handleDeleted"
        />
      </template>
    </main>
  </div>
</template>
