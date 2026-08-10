// 身分証を持たない人でも開ける道と、身分証を持つ人なら通り過ぎる道の一覧。
// app/app/_layout.tsx と app/src/auth/useIdentity.ts がともにこれを見る。

export const WELCOME_PATH = "/welcome";
export const ONBOARDING_PATH = "/onboarding";
export const TERMS_PATH = "/terms";
export const PRIVACY_PATH = "/privacy";
export const JOIN_PATH_PREFIX = "/join/";

const PUBLIC_PATHS: readonly string[] = [WELCOME_PATH, ONBOARDING_PATH, TERMS_PATH, PRIVACY_PATH];
const GUEST_ONLY_PATHS: readonly string[] = [WELCOME_PATH, ONBOARDING_PATH];

// 身分証がなくても開ける道かどうか。
export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.includes(pathname) || pathname.startsWith(JOIN_PATH_PREFIX);
}

// 身分証を持つ人なら通り過ぎ、ホームへ送り返す道かどうか。
export function isGuestOnlyPath(pathname: string): boolean {
  return GUEST_ONLY_PATHS.includes(pathname);
}
