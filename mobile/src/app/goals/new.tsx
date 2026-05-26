import { Stack } from 'expo-router';

import { GoalForm } from '@/features/create-goal/GoalForm';

export default function NewGoalScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Новая цель' }} />
      <GoalForm />
    </>
  );
}
