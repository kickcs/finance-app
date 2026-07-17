import { createHmac } from 'crypto';
import { validateTmaInitData } from './init-data.validator';

const BOT_TOKEN = '123456:TEST-TOKEN';

/** Собирает валидный initData тем же алгоритмом, что описан в доке Telegram */
function buildInitData(
  fields: Record<string, string>,
  token: string = BOT_TOKEN,
  tamperHash?: string,
): string {
  const dataCheckString = Object.entries(fields)
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('\n');
  const secretKey = createHmac('sha256', 'WebAppData').update(token).digest();
  const hash = tamperHash ?? createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  const params = new URLSearchParams(fields);
  params.set('hash', hash);
  return params.toString();
}

const NOW_MS = 1_800_000_000_000; // фиксированное "сейчас"
const FRESH_AUTH_DATE = String(Math.floor(NOW_MS / 1000) - 60);
const USER_JSON = JSON.stringify({ id: 42, username: 'kickcs', first_name: 'A' });

describe('validateTmaInitData', () => {
  it('валидный initData → telegramUserId и username', () => {
    const initData = buildInitData({ auth_date: FRESH_AUTH_DATE, user: USER_JSON });
    expect(validateTmaInitData(initData, BOT_TOKEN, NOW_MS)).toEqual({
      telegramUserId: '42',
      telegramUsername: 'kickcs',
    });
  });

  it('user без username → telegramUsername null', () => {
    const initData = buildInitData({
      auth_date: FRESH_AUTH_DATE,
      user: JSON.stringify({ id: 42, first_name: 'A' }),
    });
    expect(validateTmaInitData(initData, BOT_TOKEN, NOW_MS)?.telegramUsername).toBeNull();
  });

  it('подделанный hash → null', () => {
    const initData = buildInitData(
      { auth_date: FRESH_AUTH_DATE, user: USER_JSON },
      BOT_TOKEN,
      'a'.repeat(64),
    );
    expect(validateTmaInitData(initData, BOT_TOKEN, NOW_MS)).toBeNull();
  });

  it('изменённое поле после подписи → null', () => {
    const initData = buildInitData({ auth_date: FRESH_AUTH_DATE, user: USER_JSON });
    const tampered = initData.replace('%22id%22%3A42', '%22id%22%3A43');
    expect(validateTmaInitData(tampered, BOT_TOKEN, NOW_MS)).toBeNull();
  });

  it('чужой bot token → null', () => {
    const initData = buildInitData({ auth_date: FRESH_AUTH_DATE, user: USER_JSON }, 'other:token');
    expect(validateTmaInitData(initData, BOT_TOKEN, NOW_MS)).toBeNull();
  });

  it('auth_date старше часа → null', () => {
    const stale = String(Math.floor(NOW_MS / 1000) - 3601);
    const initData = buildInitData({ auth_date: stale, user: USER_JSON });
    expect(validateTmaInitData(initData, BOT_TOKEN, NOW_MS)).toBeNull();
  });

  it('нет поля user → null', () => {
    const initData = buildInitData({ auth_date: FRESH_AUTH_DATE });
    expect(validateTmaInitData(initData, BOT_TOKEN, NOW_MS)).toBeNull();
  });

  it('битый hash не hex-длины / пустая строка / пустой токен → null', () => {
    const initData = buildInitData(
      { auth_date: FRESH_AUTH_DATE, user: USER_JSON },
      BOT_TOKEN,
      'zz',
    );
    expect(validateTmaInitData(initData, BOT_TOKEN, NOW_MS)).toBeNull();
    expect(validateTmaInitData('', BOT_TOKEN, NOW_MS)).toBeNull();
    const ok = buildInitData({ auth_date: FRESH_AUTH_DATE, user: USER_JSON });
    expect(validateTmaInitData(ok, '', NOW_MS)).toBeNull();
  });
});
