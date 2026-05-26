import { ErrorCode, useIAP, type Purchase } from 'expo-iap';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { useUser } from '@/shared/api/composables/useAuth';
import { http } from '@/shared/api/http';

import {
  ALL_PRODUCT_SKUS,
  PRODUCT_IDS,
  ensureIAPConnection,
  planFromSku,
  type ProductPlan,
} from './iap';

export interface UpgradeProductOption {
  plan: ProductPlan;
  sku: string;
  displayPrice: string;
}

interface VerifyReceiptInput {
  platform: 'ios' | 'android';
  productId: string;
  transactionId: string;
  receipt: string;
}

async function verifyReceiptOnBackend(input: VerifyReceiptInput): Promise<void> {
  await http('/api/subscription/iap/verify-receipt', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

function purchaseToReceipt(purchase: Purchase): string | null {
  // iOS StoreKit2: JWS in `purchaseToken`. Android Play Billing: signed
  // payload in `purchaseToken` too. Either way, that field is what the
  // backend forwards to App Store Server API / Google Play Developer API.
  if ('purchaseToken' in purchase && typeof purchase.purchaseToken === 'string') {
    return purchase.purchaseToken;
  }
  return null;
}

export interface UseUpgradeResult {
  connected: boolean;
  options: UpgradeProductOption[];
  isLoadingProducts: boolean;
  purchasingPlan: ProductPlan | null;
  lastError: string | null;
  isAvailable: boolean;
  purchase: (plan: ProductPlan) => Promise<void>;
  restore: () => Promise<void>;
}

export function useUpgrade(): UseUpgradeResult {
  const user = useUser();
  const isAvailable = Platform.OS === 'ios' || Platform.OS === 'android';
  const [purchasingPlan, setPurchasingPlan] = useState<ProductPlan | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const verifiedTxnIds = useRef<Set<string>>(new Set());

  const {
    connected,
    subscriptions,
    fetchProducts,
    requestPurchase,
    finishTransaction,
    restorePurchases,
  } = useIAP({
    onPurchaseSuccess: async (purchase) => {
      const txnId =
        ('transactionId' in purchase && purchase.transactionId) ||
        ('originalTransactionIdentifierIOS' in purchase &&
          purchase.originalTransactionIdentifierIOS) ||
        null;
      // Guard against StoreKit replay events delivering the same transaction
      // twice in a single session — happens on iOS sandbox after a reconnect.
      if (txnId && verifiedTxnIds.current.has(txnId)) {
        await finishTransaction({ purchase, isConsumable: false }).catch(() => undefined);
        return;
      }

      const receipt = purchaseToReceipt(purchase);
      const productId = purchase.productId ?? purchase.ids?.[0];
      if (!receipt || !productId) {
        setLastError('Не удалось получить подтверждение покупки');
        return;
      }

      try {
        await verifyReceiptOnBackend({
          platform: Platform.OS === 'ios' ? 'ios' : 'android',
          productId,
          transactionId: txnId ?? productId,
          receipt,
        });
        if (txnId) verifiedTxnIds.current.add(txnId);
        // Acknowledge only AFTER backend confirmed activation — otherwise a
        // dropped network response leaves the user paying without premium.
        await finishTransaction({ purchase, isConsumable: false });
        setPurchasingPlan(null);
        setLastError(null);
      } catch (e) {
        setLastError(e instanceof Error ? e.message : 'Сервер не подтвердил покупку');
      }
    },
    onPurchaseError: (error) => {
      setPurchasingPlan(null);
      if (error.code === ErrorCode.UserCancelled) {
        setLastError(null);
        return;
      }
      setLastError(error.message);
    },
  });

  useEffect(() => {
    if (!isAvailable || !user) return;
    let cancelled = false;
    (async () => {
      try {
        setIsLoadingProducts(true);
        await ensureIAPConnection();
        if (cancelled) return;
        await fetchProducts({ skus: [...ALL_PRODUCT_SKUS], type: 'subs' });
      } catch (e) {
        if (!cancelled) {
          setLastError(e instanceof Error ? e.message : 'Не удалось загрузить тарифы');
        }
      } finally {
        if (!cancelled) setIsLoadingProducts(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // intentionally re-fetch only on user id change — fetchProducts identity
    // from useIAP is stable enough for our purposes.
  }, [isAvailable, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const options = useMemo<UpgradeProductOption[]>(() => {
    return subscriptions.flatMap((product) => {
      const plan = planFromSku(product.id);
      if (!plan) return [];
      return [{ plan, sku: product.id, displayPrice: product.displayPrice }];
    });
  }, [subscriptions]);

  const purchase = useCallback(
    async (plan: ProductPlan) => {
      if (!isAvailable) {
        setLastError('Покупки доступны только в мобильном приложении');
        return;
      }
      const sku = PRODUCT_IDS[plan];
      setLastError(null);
      setPurchasingPlan(plan);
      try {
        await requestPurchase({
          request: {
            ios: { sku },
            android: { skus: [sku] },
          },
          type: 'subs',
        });
      } catch (e) {
        setPurchasingPlan(null);
        if (e instanceof Error) setLastError(e.message);
      }
    },
    [isAvailable, requestPurchase],
  );

  const restore = useCallback(async () => {
    if (!isAvailable) return;
    setLastError(null);
    try {
      await restorePurchases();
    } catch (e) {
      if (e instanceof Error) setLastError(e.message);
    }
  }, [isAvailable, restorePurchases]);

  return {
    connected,
    options,
    isLoadingProducts,
    purchasingPlan,
    lastError,
    isAvailable,
    purchase,
    restore,
  };
}
