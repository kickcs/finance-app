const SAFE_ALIAS = /^[a-z_][a-z0-9_]*$/i;

/** Алиас таблицы вставляется в текст SQL, а не параметром, поэтому пускаем только простые имена. */
export function assertSqlAlias(alias: string, reserved: readonly string[] = []): void {
  if (!SAFE_ALIAS.test(alias) || reserved.includes(alias)) {
    throw new Error(`Недопустимый алиас таблицы: ${alias}`);
  }
}
