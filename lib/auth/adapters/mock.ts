import "server-only";

import type { AuthPort, AuthResult, OAuthCompleteParams, OAuthProvider, Role, Session, Tokens } from "@/lib/auth/port";
import { AuthError } from "@/lib/auth/port";

// ---------------------------------------------------------------------------
// 내부 헬퍼
// ---------------------------------------------------------------------------

/** 개발용 불투명 토큰 쌍을 생성합니다. */
function makeTokens(): Tokens {
  const rand = (): string => Math.random().toString(36).slice(2);
  return {
    accessToken: `mock-access-${rand()}${rand()}`,
    refreshToken: `mock-refresh-${rand()}${rand()}`,
    accessExp: Math.floor(Date.now() / 1000) + 900,
  };
}

/** 이메일 접두사로 Role 을 결정합니다. */
function roleFromEmail(email: string): Role {
  const local = email.split("@")[0] ?? "";
  if (local.startsWith("super")) return "SUPER_ADMIN";
  if (local.startsWith("admin")) return "ADMIN";
  return "USER";
}

/** 이메일 로컬 파트(@ 앞)를 nickname 으로 사용합니다. */
function nicknameFromEmail(email: string): string {
  return email.split("@")[0] ?? email;
}

// ---------------------------------------------------------------------------
// Mock 어댑터 구현
// ---------------------------------------------------------------------------

export const mockAuthAdapter: AuthPort = {
  supportsCredentials: true,

  async signInWithCredentials(email: string, password: string): Promise<AuthResult> {
    if (password !== "password") {
      throw new AuthError("INVALID_CREDENTIALS", "비밀번호가 올바르지 않습니다.");
    }
    const session: Session = {
      userId: `mock-${nicknameFromEmail(email)}`,
      role: roleFromEmail(email),
      nickname: nicknameFromEmail(email),
    };
    return { session, tokens: makeTokens() };
  },

  async oauthAuthorizeUrl(
    provider: OAuthProvider,
    params: { state: string; redirectUri: string; nonce?: string; codeChallenge?: string },
  ): Promise<string> {
    const qs = new URLSearchParams({ state: params.state, redirect_uri: params.redirectUri });
    if (params.nonce) qs.set("nonce", params.nonce);
    if (params.codeChallenge) qs.set("code_challenge", params.codeChallenge);
    return `https://mock-oauth.local/${provider}/authorize?${qs.toString()}`;
  },

  async oauthComplete(provider: OAuthProvider, _params: OAuthCompleteParams): Promise<AuthResult> {
    const session: Session = {
      userId: "1",
      role: "USER",
      nickname: `${provider}-user`,
    };
    return { session, tokens: makeTokens() };
  },

  async reissue(refreshToken: string): Promise<Tokens> {
    if (!refreshToken) {
      throw new AuthError("REISSUE_FAILED", "리프레시 토큰이 없습니다.");
    }
    // 실제 순환과 동일하게 새 토큰 쌍 반환 (만료 시각 갱신됨).
    return makeTokens();
  },

  async signOut(_refreshToken?: string): Promise<void> {
    // mock 에서는 별도 서버 무효화 없이 즉시 완료.
    return;
  },

  async getUser(accessToken: string): Promise<Session> {
    if (!accessToken) {
      throw new AuthError("UNAUTHORIZED", "액세스 토큰이 없습니다.");
    }
    // mock 에서는 불투명 토큰에서 role 을 디코딩할 수 없으므로 고정 세션을 반환합니다.
    // 실제 어댑터는 /me 엔드포인트 응답에서 role 을 파싱합니다.
    return { userId: "1", role: "USER", nickname: "dev-user" };
  },
};
