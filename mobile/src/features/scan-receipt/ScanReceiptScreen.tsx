import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { formatCurrency } from '@/shared/lib/format';
import { Button } from '@/shared/ui/button';
import { Icon } from '@/shared/ui/icon';

import { useScanReceipt } from './useScanReceipt';
import type { ScanReceiptResponse } from './types';

export function ScanReceiptScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [result, setResult] = useState<ScanReceiptResponse | null>(null);
  const { scan, isScanning, error } = useScanReceipt();

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
      setResult(response);
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
      setResult(response);
    } catch (e) {
      Alert.alert('Ошибка', e instanceof Error ? e.message : 'Не удалось обработать чек');
    }
  }

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

  if (result) {
    return <ScanResultView result={result} onClose={() => router.back()} onRetry={() => setResult(null)} />;
  }

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

interface ScanResultViewProps {
  result: ScanReceiptResponse;
  onClose: () => void;
  onRetry: () => void;
}

function ScanResultView({ result, onClose, onRetry }: ScanResultViewProps) {
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
              Сервисный сбор{result.serviceChargePercent ? ` (${result.serviceChargePercent}%)` : ''}
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
              <View
                key={tag}
                className="rounded-full bg-primary-light/15 px-3 py-1"
              >
                <Text className="text-xs text-primary-light">#{tag}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>

      <View className="px-5 pb-4">
        <Button title="Готово" onPress={onClose} />
      </View>
    </SafeAreaView>
  );
}
