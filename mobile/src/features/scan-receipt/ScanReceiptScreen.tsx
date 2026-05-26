import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAccounts } from '@/entities/account/api';
import { usePeople } from '@/entities/person/api/usePeople';
import { useUser } from '@/shared/api/composables/useAuth';
import { useProfile } from '@/shared/api/composables/useProfile';
import { ENTITY_COLORS } from '@/shared/config/colors';
import { formatCurrency } from '@/shared/lib/format';
import { Button } from '@/shared/ui/button';
import { Icon } from '@/shared/ui/icon';
import { InitialAvatar } from '@/shared/ui/initial-avatar';
import { ProgressBar } from '@/shared/ui/progress-bar';
import { Spinner } from '@/shared/ui/spinner';

import {
  useReceiptParticipants,
  toReceiptParticipants,
} from './useReceiptParticipants';
import { useScanReceipt } from './useScanReceipt';
import type { ScanReceiptResponse } from './types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Step = 'camera' | 'review' | 'participants';

// ---------------------------------------------------------------------------
// Root screen
// ---------------------------------------------------------------------------

export function ScanReceiptScreen() {
  const router = useRouter();
  const user = useUser();
  const { data: profile } = useProfile(user?.id ?? null);
  const { data: accounts } = useAccounts(user?.id ?? null);
  const { data: people } = usePeople(user?.id ?? null);

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [result, setResult] = useState<ScanReceiptResponse | null>(null);
  const [step, setStep] = useState<Step>('camera');
  const { scan, isScanning, error } = useScanReceipt();

  const participants = toReceiptParticipants(people ?? []);
  const receiptState = useReceiptParticipants();

  function handleScanResult(response: ScanReceiptResponse) {
    receiptState.reset();
    setResult(response);
    setStep('review');
  }

  async function handleCapture() {
    if (!cameraRef.current || capturing || isScanning) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        skipProcessing: true,
      });
      if (!photo?.uri) return;
      const response = await scan({ uri: photo.uri, mimeType: 'image/jpeg' });
      handleScanResult(response);
    } catch (e) {
      Alert.alert('Ошибка', e instanceof Error ? e.message : 'Не удалось обработать снимок');
    } finally {
      setCapturing(false);
    }
  }

  async function handlePickFromLibrary() {
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.85,
    });
    if (picked.canceled || picked.assets.length === 0) return;
    const asset = picked.assets[0]!;
    try {
      const response = await scan({
        uri: asset.uri,
        mimeType: asset.mimeType ?? 'image/jpeg',
        fileName: asset.fileName ?? null,
      });
      handleScanResult(response);
    } catch (e) {
      Alert.alert('Ошибка', e instanceof Error ? e.message : 'Не удалось обработать чек');
    }
  }

  function handleRetry() {
    setResult(null);
    setStep('camera');
    receiptState.reset();
  }

  async function handleSubmit() {
    if (!result || !user) return;

    const accountId =
      profile?.default_account_id ??
      accounts?.[0]?.id;

    if (!accountId) {
      Alert.alert('Нет счёта', 'Сначала создайте счёт в приложении');
      return;
    }

    const currency = result.currency || profile?.currency || 'USD';

    try {
      await receiptState.submit(user.id, result, participants, {
        accountId,
        categoryId: 'food_and_dining',
        currency,
        storeName: result.storeName,
      });
      router.back();
    } catch {
      Alert.alert('Ошибка', receiptState.submitError ?? 'Не удалось сохранить');
    }
  }

  // --------------------------------------------------
  // Permission gate
  // --------------------------------------------------

  if (!permission) {
    return (
      <View className="flex-1 items-center justify-center bg-background-light dark:bg-background-dark">
        <ActivityIndicator />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark">
        <View className="flex-1 items-center justify-center gap-4 px-6">
          <Icon name="account_balance_wallet" size={56} color="#0A84FF" />
          <Text className="text-center text-lg font-semibold text-text-light dark:text-text-dark">
            Нужен доступ к камере
          </Text>
          <Text className="text-center text-sm text-text-muted-light dark:text-text-muted-dark">
            Чтобы сфотографировать чек и распознать позиции.
          </Text>
          <Button title="Разрешить" onPress={requestPermission} />
          <Pressable onPress={handlePickFromLibrary} hitSlop={12}>
            <Text className="text-primary-light">Выбрать из галереи</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // --------------------------------------------------
  // Step routing
  // --------------------------------------------------

  if (result && step === 'review') {
    return (
      <ScanResultView
        result={result}
        onClose={() => router.back()}
        onRetry={handleRetry}
        onNext={() => setStep('participants')}
      />
    );
  }

  if (result && step === 'participants') {
    return (
      <AssignParticipantsView
        result={result}
        participants={participants}
        selectedIds={receiptState.selectedIds}
        isSubmitting={receiptState.isSubmitting}
        submitError={receiptState.submitError}
        onToggleParticipant={receiptState.toggleParticipant}
        onBack={() => setStep('review')}
        onSubmit={handleSubmit}
      />
    );
  }

  // --------------------------------------------------
  // Camera view (step 1)
  // --------------------------------------------------

  return (
    <View className="flex-1 bg-black">
      <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" />
      <SafeAreaView edges={['top']} className="absolute left-0 right-0 top-0">
        <View className="flex-row items-center justify-between px-4 py-3">
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Закрыть"
            className="h-10 w-10 items-center justify-center rounded-full bg-black/40"
          >
            <Icon name="close" size={24} color="#FFFFFF" />
          </Pressable>
          <Text className="text-base font-semibold text-white">Чек</Text>
          <Pressable
            onPress={handlePickFromLibrary}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Из галереи"
            className="h-10 w-10 items-center justify-center rounded-full bg-black/40"
          >
            <Icon name="account_balance_wallet" size={20} color="#FFFFFF" />
          </Pressable>
        </View>
      </SafeAreaView>
      <SafeAreaView edges={['bottom']} className="absolute bottom-0 left-0 right-0">
        <View className="items-center pb-6">
          {error ? (
            <Text className="mb-3 max-w-[80%] text-center text-sm text-danger-light">{error}</Text>
          ) : null}
          <Pressable
            onPress={handleCapture}
            disabled={capturing || isScanning}
            accessibilityRole="button"
            accessibilityLabel="Сделать снимок"
            className="h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-white/20"
          >
            {capturing || isScanning ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <View className="h-16 w-16 rounded-full bg-white" />
            )}
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Step 2: Review receipt items
// ---------------------------------------------------------------------------

interface ScanResultViewProps {
  result: ScanReceiptResponse;
  onClose: () => void;
  onRetry: () => void;
  onNext: () => void;
}

function ScanResultView({ result, onClose, onRetry, onNext }: ScanResultViewProps) {
  return (
    <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark">
      <View className="flex-row items-center justify-between px-4 py-3">
        <Pressable onPress={onClose} hitSlop={12}>
          <Icon name="close" size={24} />
        </Pressable>
        <Text className="text-base font-semibold text-text-light dark:text-text-dark">
          Распознанный чек
        </Text>
        <Pressable onPress={onRetry} hitSlop={12}>
          <Text className="text-primary-light">Заново</Text>
        </Pressable>
      </View>

      <ScrollView className="flex-1 px-5" contentContainerClassName="gap-3 pb-8">
        {result.storeName ? (
          <Text className="text-lg font-semibold text-text-light dark:text-text-dark">
            {result.storeName}
          </Text>
        ) : null}
        {result.date ? (
          <Text className="text-sm text-text-muted-light dark:text-text-muted-dark">
            {result.date}
          </Text>
        ) : null}

        <View className="mt-3 gap-2">
          {result.items.map((item, idx) => (
            <View
              key={`${item.name}-${idx}`}
              className="flex-row items-start justify-between rounded-xl bg-surface-light p-3 dark:bg-surface-dark"
            >
              <View className="flex-1 pr-3">
                <Text className="text-sm font-medium text-text-light dark:text-text-dark">
                  {item.name}
                </Text>
                {item.quantity !== 1 ? (
                  <Text className="text-xs text-text-muted-light dark:text-text-muted-dark">
                    {item.quantity} × {formatCurrency(item.unitPrice, result.currency)}
                  </Text>
                ) : null}
              </View>
              <Text className="text-sm font-semibold text-text-light dark:text-text-dark">
                {formatCurrency(item.totalPrice, result.currency)}
              </Text>
            </View>
          ))}
        </View>

        {result.serviceChargeAmount != null ? (
          <View className="mt-2 flex-row items-center justify-between">
            <Text className="text-sm text-text-muted-light dark:text-text-muted-dark">
              Сервисный сбор
              {result.serviceChargePercent ? ` (${result.serviceChargePercent}%)` : ''}
            </Text>
            <Text className="text-sm text-text-light dark:text-text-dark">
              {formatCurrency(result.serviceChargeAmount, result.currency)}
            </Text>
          </View>
        ) : null}

        <View className="mt-3 flex-row items-center justify-between border-t border-surface-light pt-3 dark:border-surface-dark">
          <Text className="text-base font-semibold text-text-light dark:text-text-dark">Итого</Text>
          <Text className="text-base font-bold text-text-light dark:text-text-dark">
            {formatCurrency(result.totalAmount, result.currency)}
          </Text>
        </View>

        {result.hashtags.length > 0 ? (
          <View className="mt-2 flex-row flex-wrap gap-2">
            {result.hashtags.map((tag) => (
              <View key={tag} className="rounded-full bg-primary-light/15 px-3 py-1">
                <Text className="text-xs text-primary-light">#{tag}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>

      <View className="px-5 pb-4">
        <Button title="Далее — участники" onPress={onNext} />
      </View>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Step 3: Assign participants
// ---------------------------------------------------------------------------

interface AssignParticipantsViewProps {
  result: ScanReceiptResponse;
  participants: Array<{ id: string; name: string; color: string }>;
  selectedIds: string[];
  isSubmitting: boolean;
  submitError: string | null;
  onToggleParticipant: (id: string) => void;
  onBack: () => void;
  onSubmit: () => void;
}

function AssignParticipantsView({
  result,
  participants,
  selectedIds,
  isSubmitting,
  submitError,
  onToggleParticipant,
  onBack,
  onSubmit,
}: AssignParticipantsViewProps) {
  // Per-person equal share (for display only)
  const divisor = selectedIds.length + 1; // +1 for the current user
  const baseShare =
    selectedIds.length > 0 ? Math.floor(result.totalAmount / divisor) : 0;

  const assignProgress = selectedIds.length > 0 ? 1 : 0;

  return (
    <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3">
        <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="Назад">
          <Icon name="arrow_back" size={24} />
        </Pressable>
        <Text className="text-base font-semibold text-text-light dark:text-text-dark">
          Разделить чек
        </Text>
        {/* spacer */}
        <View className="w-6" />
      </View>

      {/* Total amount pill */}
      <View className="mx-5 mb-4 items-center">
        <View className="rounded-2xl bg-surface-light px-5 py-3 dark:bg-surface-dark">
          <Text className="text-center text-xs text-text-muted-light dark:text-text-muted-dark">
            Итого
          </Text>
          <Text className="text-center text-xl font-bold text-text-light dark:text-text-dark">
            {formatCurrency(result.totalAmount, result.currency)}
          </Text>
          {result.storeName ? (
            <Text className="text-center text-xs text-text-muted-light dark:text-text-muted-dark">
              {result.storeName}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Assignment progress */}
      {selectedIds.length > 0 ? (
        <View className="mx-5 mb-3 gap-1">
          <View className="flex-row items-center justify-between">
            <Text className="text-xs text-text-muted-light dark:text-text-muted-dark">
              {selectedIds.length} участн. · по {formatCurrency(baseShare, result.currency)} каждый
            </Text>
            <Text className="text-xs font-medium text-success">Готово</Text>
          </View>
          <ProgressBar value={assignProgress} variant="success" />
        </View>
      ) : null}

      {/* People list */}
      <ScrollView className="flex-1 px-5" contentContainerClassName="gap-2 pb-6">
        {participants.length === 0 ? (
          <EmptyParticipantsState />
        ) : (
          participants.map((participant) => {
            const isSelected = selectedIds.includes(participant.id);
            return (
              <Pressable
                key={participant.id}
                onPress={() => onToggleParticipant(participant.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isSelected }}
                accessibilityLabel={participant.name}
                className={[
                  'flex-row items-center gap-3 rounded-2xl border p-4',
                  isSelected
                    ? 'border-primary bg-primary/[0.06] dark:bg-primary/[0.10]'
                    : 'border-border-light bg-card-light dark:border-border-dark dark:bg-card-dark',
                ].join(' ')}
              >
                <InitialAvatar name={participant.name} color={participant.color} size="md" />
                <View className="flex-1">
                  <Text className="text-sm font-medium text-text-light dark:text-text-dark">
                    {participant.name}
                  </Text>
                  {isSelected && selectedIds.length > 0 ? (
                    <Text className="text-xs text-text-muted-light dark:text-text-muted-dark">
                      Должен {formatCurrency(baseShare, result.currency)}
                    </Text>
                  ) : null}
                </View>
                <View
                  className={[
                    'h-6 w-6 items-center justify-center rounded-full border-2',
                    isSelected
                      ? 'border-primary bg-primary'
                      : 'border-border-light dark:border-border-dark',
                  ].join(' ')}
                >
                  {isSelected ? <Icon name="check" size={14} color="#FFFFFF" /> : null}
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      {/* Footer */}
      <View className="gap-2 px-5 pb-4">
        {submitError ? (
          <Text className="text-center text-xs text-danger-light">{submitError}</Text>
        ) : null}
        {selectedIds.length > 0 ? (
          <View className="rounded-xl bg-surface-light px-4 py-2 dark:bg-surface-dark">
            <Text className="text-center text-xs text-text-muted-light dark:text-text-muted-dark">
              Будет создан долг для {selectedIds.length}{' '}
              {selectedIds.length === 1 ? 'участника' : 'участников'}
            </Text>
          </View>
        ) : null}
        <Button
          title={
            isSubmitting
              ? 'Сохраняем…'
              : selectedIds.length > 0
                ? 'Сохранить и создать долги'
                : 'Сохранить без долгов'
          }
          onPress={onSubmit}
          disabled={isSubmitting}
        />
      </View>
    </SafeAreaView>
  );
}

function EmptyParticipantsState() {
  return (
    <View className="flex-1 items-center justify-center gap-3 py-10">
      <View className="h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
        <Icon name="group_add" size={28} color="#0A84FF" />
      </View>
      <Text className="text-center text-sm font-semibold text-text-light dark:text-text-dark">
        Нет контактов
      </Text>
      <Text className="max-w-[260px] text-center text-xs text-text-muted-light dark:text-text-muted-dark">
        Добавьте людей в разделе «Долги», чтобы делить чеки.
      </Text>
      <Text className="mt-2 text-center text-xs text-text-muted-light dark:text-text-muted-dark">
        Вы можете сохранить чек без долгов.
      </Text>
    </View>
  );
}
