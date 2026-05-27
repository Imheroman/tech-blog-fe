import "server-only";

import { randomBytes } from "crypto";

// ---------------------------------------------------------------------------
// Provider 타입 + 가드
// ---------------------------------------------------------------------------

export type Provider = "google" | "kakao";

export function isProvider(x: string): x is Provider {
  return x === "google" || x === "kakao";
}

// ---------------------------------------------------------------------------
// Provider 설정
// ---------------------------------------------------------------------------

interface ProviderConfig {
  authorizeUrl: string;
  clientId: string | undefined;
  scope: string;
}

export function getProviderConfig(p: Provider): ProviderConfig {
  switch (p) {
    case "google":
      return {
        authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
        clientId: process.env.GOOGLE_CLIENT_ID,
        scope: "openid email profile",
      };
    case "kakao":
      return {
        authorizeUrl: "https://kauth.kakao.com/oauth/authorize",
        clientId: process.env.KAKAO_CLIENT_ID,
        scope: "profile_nickname account_email",
      };
  }
}

// ---------------------------------------------------------------------------
// 쿠키 이름 상수
// ---------------------------------------------------------------------------

export const STATE_COOKIE = "oauth_state";
export const NONCE_COOKIE = "oauth_nonce";
export const DEVICE_COOKIE = "device_id";
export const REDIRECT_COOKIE = "oauth_redirect";

// ---------------------------------------------------------------------------
// 암호 유틸
// ---------------------------------------------------------------------------

/** Node `crypto.randomBytes`로 base64url 토큰을 생성합니다. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

// ---------------------------------------------------------------------------
// 모드 헬퍼
// ---------------------------------------------------------------------------

/** `AUTH_MODE` 가 `"mock"` (기본값)이면 true를 반환합니다. */
export function isMockMode(): boolean {
  return (process.env.AUTH_MODE ?? "mock") === "mock";
}

// ---------------------------------------------------------------------------
// Open-redirect 가드
// ---------------------------------------------------------------------------

/**
 * 동일 출처 상대 경로만 허용합니다.
 * `/` 로 시작하고 `//` 로 시작하지 않는 경로만 통과하고, 그 외는 `"/"` 를 반환합니다.
 */
export function safeRelativePath(input: string | null | undefined): string {
  if (typeof input === "string" && input.startsWith("/") && !input.startsWith("//")) {
    return input;
  }
  return "/";
}
