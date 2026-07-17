// Cookie configuration (общая для auth.controller и TMA-auth в telegram-import)
export const REFRESH_TOKEN_COOKIE = 'refresh_token';

const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true';

export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: COOKIE_SECURE,
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/api/auth',
};

// Demo accounts get shorter cookie lifetime
export const DEMO_COOKIE_OPTIONS = {
  ...COOKIE_OPTIONS,
  maxAge: 60 * 60 * 1000, // 1 hour
};
