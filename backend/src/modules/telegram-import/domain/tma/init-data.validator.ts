import { createHmac, timingSafeEqual } from 'crypto';

export interface TmaInitData {
  telegramUserId: string;
  telegramUsername: string | null;
}

export const INIT_DATA_MAX_AGE_SECONDS = 3600;

/**
 * Валидация initData Telegram Mini App по алгоритму из
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 * secret_key = HMAC_SHA256(key="WebAppData", data=bot_token);
 * hash = hex(HMAC_SHA256(data_check_string, secret_key)).
 */
export function validateTmaInitData(
  initData: string,
  botToken: string,
  nowMs: number = Date.now(),
): TmaInitData | null {
  if (!initData || !botToken) return null;

  const params = new URLSearchParams(initData);
  const receivedHash = params.get('hash');
  if (!receivedHash) return null;
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join('\n');

  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const computedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  const computed = Buffer.from(computedHash, 'hex');
  const received = Buffer.from(receivedHash, 'hex');
  if (computed.length !== received.length || !timingSafeEqual(computed, received)) return null;

  const authDate = Number(params.get('auth_date'));
  if (!Number.isFinite(authDate)) return null;
  if (nowMs / 1000 - authDate > INIT_DATA_MAX_AGE_SECONDS) return null;

  const userJson = params.get('user');
  if (!userJson) return null;
  try {
    const user = JSON.parse(userJson) as { id?: number | string; username?: string };
    if (user.id === undefined || user.id === null) return null;
    return {
      telegramUserId: String(user.id),
      telegramUsername: user.username ?? null,
    };
  } catch {
    return null;
  }
}
