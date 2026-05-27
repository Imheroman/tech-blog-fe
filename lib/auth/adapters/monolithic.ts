import "server-only";

/**
 * monolithic.ts — Spring Boot 모놀리식 백엔드를 대상으로 하는 실제 인증 어댑터.
 *
 * [백엔드 확인 게이트 — 아직 미완료]
 * 아래 항목은 백엔드 팀과 확인이 필요한 열린 질문입니다:
 *   1. 로그인 엔드포인트 경로: `/api/v1/auth/login` 가 맞는지.
 *   2. 리프레시 토큰 전달 방식: JSON body vs Set-Cookie — `extractTokens` 헬퍼가 양쪽을 모두 처리하지만
 *      실제 응답 구조에 따라 우선순위 조정이 필요할 수 있음.
 *   3. 재발급 엔드포인트(`/api/v1/auth/reissue`) 가 쿠키 기반 서버-투-서버 요청을 허용하는지.
 *   4. 사용자 조회 엔드포인트(`/api/v1/auth/me`) 의 응답 필드명: `id` / `nickname` / `name` / `role`.
 */

import setCookie from "set-cookie-parser";

import type { AuthPort, AuthResult, OAuthCompleteParams, OAuthProvider, Role, Session, Tokens } from "@/lib/auth/port";
import { AuthError } from "@/lib/auth/port";

// ---------------------------------------------------------------------------
// 환경 변수
// ---------------------------------------------------------------------------

const BASE = process.env.API_BASE_URL ?? "http://localhost:8080";

// ---------------------------------------------------------------------------
// Role 가드
// ---------------------------------------------------------------------------

const VALID_ROLES: ReadonlySet<string> = new Set<Role>(["USER", "ADMIN", "SUPER_ADMIN"]);

function isRole(value: unknown): value is Role {
  return typeof value === "string" && VALID_ROLES.has(value);
}

// ---------------------------------------------------------------------------
// 토큰 추출 헬퍼
// ---------------------------------------------------------------------------

/**
 * fetch Response + 파싱된 JSON body 에서 Tokens 를 추출합니다.
 *
 * 리프레시 토큰은 두 가지 경로로 올 수 있습니다:
 *   A) JSON body.refreshToken
 *   B) Set-Cookie 헤더 (쿠키 이름에 "refresh" 가 포함된 항목)
 *
 * Set-Cookie 파싱에는 set-cookie-parser 를 사용합니다.
 * `String.split(",")` 기반 파싱은 쿠키 날짜 포맷이 쉼표를 포함할 수 있어 사용하지 않습니다.
 *
 * accessExp 우선순위:
 *   1. body.accessExp (숫자, epoch 초)
 *   2. 액세스 쿠키의 maxAge (now + maxAge)
 *   3. 기본값 now + 900
 */
function extractTokens(res: Response, body: unknown): Tokens {
  const now = Math.floor(Date.now() / 1000);
  const b = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};

  // 액세스 토큰: JSON body 우선
  const accessToken =
    typeof b["accessToken"] === "string" ? b["accessToken"] : "";

  // 리프레시 토큰: JSON body → Set-Cookie 순서로 탐색
  let refreshToken: string | undefined;

  if (typeof b["refreshToken"] === "string" && b["refreshToken"]) {
    refreshToken = b["refreshToken"];
  }

  if (!refreshToken) {
    // Set-Cookie 헤더 파싱 (set-cookie-parser 사용)
    const rawCookies = res.headers.getSetCookie();
    if (rawCookies.length > 0) {
      const parsed = setCookie.parse(rawCookies);
      const refreshCookie = parsed.find((c) => c.name.toLowerCase().includes("refresh"));
      if (refreshCookie) {
        refreshToken = refreshCookie.value;
      }
    }
  }

  if (!refreshToken) {
    throw new AuthError("UPSTREAM_ERROR", "no refresh token");
  }

  // accessExp 결정
  let accessExp: number;
  if (typeof b["accessExp"] === "number" && b["accessExp"] > 0) {
    accessExp = b["accessExp"];
  } else {
    // 액세스 쿠키의 maxAge 시도 (있을 경우)
    const rawCookies = res.headers.getSetCookie();
    const parsed = rawCookies.length > 0 ? setCookie.parse(rawCookies) : [];
    const accessCookie = parsed.find((c) => c.name.toLowerCase().includes("access"));
    if (accessCookie?.maxAge != null && accessCookie.maxAge > 0) {
      accessExp = now + accessCookie.maxAge;
    } else {
      accessExp = now + 900;
    }
  }

  return { accessToken, refreshToken, accessExp };
}

// ---------------------------------------------------------------------------
// JSON 파싱 헬퍼 (unknown 타입 보장)
// ---------------------------------------------------------------------------

async function parseJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// /me 응답 → Session 변환
// ---------------------------------------------------------------------------

/**
 * GET /api/v1/auth/me 응답 본문을 Session 으로 변환합니다.
 * 응답 필드: `id`, `nickname` (또는 `name`), `role`
 */
function bodyToSession(body: unknown): Session {
  const b = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};

  const userId = String(b["id"] ?? "");
  const nickname =
    typeof b["nickname"] === "string"
      ? b["nickname"]
      : typeof b["name"] === "string"
        ? b["name"]
        : "";
  const role: Role = isRole(b["role"]) ? b["role"] : "USER";

  return { userId, role, nickname };
}

// ---------------------------------------------------------------------------
// 모놀리식 어댑터 구현
// ---------------------------------------------------------------------------

export const monolithicAuthAdapter: AuthPort = {
  supportsCredentials: true,

  async signInWithCredentials(email: string, password: string): Promise<AuthResult> {
    const res = await fetch(`${BASE}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
    });

    if (!res.ok) {
      if (res.status === 401) throw new AuthError("INVALID_CREDENTIALS");
      throw new AuthError("UPSTREAM_ERROR", `login failed: ${res.status}`);
    }

    const body = await parseJson(res);
    const tokens = extractTokens(res, body);
    const session = await monolithicAuthAdapter.getUser(tokens.accessToken);
    return { session, tokens };
  },

  async oauthAuthorizeUrl(
    provider: OAuthProvider,
    params: { state: string; redirectUri: string; nonce?: string; codeChallenge?: string },
  ): Promise<string> {
    // 실제 클라이언트 ID 는 환경 변수에서 주입됩니다 (OAuth 에픽에서 배선 예정).
    // 환경 변수가 없으면 문서용 플레이스홀더를 사용합니다.
    const clientIdEnvKey =
      provider === "google" ? "GOOGLE_CLIENT_ID" : "KAKAO_CLIENT_ID";
    const clientId = process.env[clientIdEnvKey] ?? `__${clientIdEnvKey}__`;

    const authorizeBase =
      provider === "google"
        ? "https://accounts.google.com/o/oauth2/v2/auth"
        : "https://kauth.kakao.com/oauth/authorize";

    const qs = new URLSearchParams({
      client_id: clientId,
      redirect_uri: params.redirectUri,
      response_type: "code",
      state: params.state,
    });

    if (params.nonce) qs.set("nonce", params.nonce);
    if (params.codeChallenge) {
      qs.set("code_challenge", params.codeChallenge);
      qs.set("code_challenge_method", "S256");
    }

    return `${authorizeBase}?${qs.toString()}`;
  },

  async oauthComplete(provider: OAuthProvider, params: OAuthCompleteParams): Promise<AuthResult> {
    const res = await fetch(`${BASE}/api/v1/auth/oauth/${provider}/callback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        authorizationCode: params.code,
        redirectUri: params.redirectUri,
        deviceId: params.deviceId,
      }),
      cache: "no-store",
    });

    if (!res.ok) {
      if (res.status === 401) throw new AuthError("OAUTH_FAILED");
      throw new AuthError("UPSTREAM_ERROR", `oauth callback failed: ${res.status}`);
    }

    const body = await parseJson(res);
    const tokens = extractTokens(res, body);
    const session = await monolithicAuthAdapter.getUser(tokens.accessToken);
    return { session, tokens };
  },

  async reissue(refreshToken: string): Promise<Tokens> {
    const res = await fetch(`${BASE}/api/v1/auth/reissue`, {
      method: "POST",
      headers: {
        // 서버-투-서버 요청: 쿠키 헤더로 리프레시 토큰 전달
        "Cookie": `refreshToken=${refreshToken}`,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      throw new AuthError("REISSUE_FAILED", `reissue failed: ${res.status}`);
    }

    const body = await parseJson(res);
    return extractTokens(res, body);
  },

  async signOut(refreshToken?: string): Promise<void> {
    const headers: Record<string, string> = {};
    if (refreshToken) {
      headers["Cookie"] = `refreshToken=${refreshToken}`;
    }
    // 로그아웃은 best-effort: 서버 오류를 무시합니다.
    await fetch(`${BASE}/api/v1/auth/logout`, {
      method: "POST",
      headers,
      cache: "no-store",
    }).catch(() => undefined);
  },

  async getUser(accessToken: string): Promise<Session> {
    const res = await fetch(`${BASE}/api/v1/auth/me`, {
      headers: { "Authorization": `Bearer ${accessToken}` },
      cache: "no-store",
    });

    if (!res.ok) {
      if (res.status === 401) throw new AuthError("UNAUTHORIZED");
      throw new AuthError("UPSTREAM_ERROR", `getUser failed: ${res.status}`);
    }

    const body = await parseJson(res);
    return bodyToSession(body);
  },
};
