/** Firebase compat / modular auth errors expose a `code`; app-thrown Errors use `message`. */

export function firebaseAuthCode(err: unknown): string | undefined {
  if (err === null || typeof err !== 'object') return undefined;
  const raw = (err as { code?: unknown }).code;
  return typeof raw === 'string' ? raw : undefined;
}

export function appThrownMessage(err: unknown): string | undefined {
  return err instanceof Error ? err.message : undefined;
}

export function isReferrerBlockedAuth(code: string): boolean {
  return code.startsWith('auth/requests-from-referer');
}
