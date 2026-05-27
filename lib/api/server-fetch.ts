/**
 * server-fetch.ts — 인증된 서버-to-서버 fetch (BFF 전용).
 *
 * 이 모듈은 Route Handler 또는 Server Action 에서만 사용해야 합니다.
 * s.save() / destroySession() 은 쿠키를 씁니다 —
 * RSC(Server Component) 렌더링 중에는 쿠키 쓰기가 차단되므로 호출하지 마세요.
 *
 * 순환 의존 방지: 이 모듈은 lib/dal.ts 를 임포트하지 않습니다.
 * 인가 에러가 필요하면 이 모듈의 SessionExpiredError 를 사용하세요.
 */
import "server-only";

import { getSession, destroySession } from "../auth/session";
import { reissueSingleFlight } from "../auth/single-flight";

// ---------------------------------------------------------------------------
// 설정
// ---------------------------------------------------------------------------

const BASE = process.env.API_BASE_URL ?? "http://localhost:8080";

/** 액세스 토큰 만료 전 선제 재발급 버퍼 (초). */
const SKEW_SECONDS = 30;

// ---------------------------------------------------------------------------
// 에러 타입
// ---------------------------------------------------------------------------

/**
 * 세션이 없거나 토큰 재발급에 실패한 경우 throw 됩니다.
 * 호출자는 로그인 페이지로 리다이렉트해야 합니다.
 */
export class SessionExpiredError extends Error {
  constructor(message?: string) {
    super(message ?? "세션이 만료되었습니다.");
    this.name = "SessionExpiredError";
  }
}

/**
 * 업스트림(백엔드)이 non-OK 응답을 반환한 경우 throw 됩니다.
 * Problem Details (RFC 9457) 에서 파싱됩니다.
 */
export class UpstreamError extends Error {
  readonly status: number;
  readonly code: string | undefined;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "UpstreamError";
    this.status = status;
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// 내부 헬퍼
// ---------------------------------------------------------------------------

/** Problem Details 타입 가드. */
function isProblemDetails(value: unknown): value is {
  title: string;
  status: number;
  detail: string;
  code?: string;
} {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v["title"] === "string" &&
    typeof v["status"] === "number" &&
    typeof v["detail"] === "string"
  );
}

/**
 * non-OK 응답에서 UpstreamError 를 생성합니다.
 * Content-Type 이 application/problem+json 이 아니면 제네릭 에러를 반환합니다.
 */
async function parseProblem(res: Response): Promise<UpstreamError> {
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (isProblemDetails(body)) {
    return new UpstreamError(
      body.status,
      body.detail,
      typeof body.code === "string" ? body.code : undefined,
    );
  }

  return new UpstreamError(
    res.status,
    res.statusText || `HTTP ${res.status}`,
  );
}

// ---------------------------------------------------------------------------
// 핵심 fetch
// ---------------------------------------------------------------------------

/**
 * Authorization 헤더를 자동으로 붙여 백엔드를 호출합니다.
 * 액세스 토큰이 곧 만료되면 선제적으로, 401 응답을 받으면 반응적으로 재발급합니다.
 * 재발급 실패 시 세션을 파기하고 SessionExpiredError 를 throw 합니다.
 *
 * 주의: Route Handler 또는 Server Action 에서만 호출하세요 (쿠키 쓰기 필요).
 *
 * @param path  API 경로 — BASE 뒤에 붙습니다. 예: "/api/v1/posts"
 * @param init  RequestInit (cache 는 내부에서 "no-store" 로 강제됩니다)
 */
export async function serverFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const s = await getSession();

  // 세션 자체가 없으면 즉시 실패
  if (!s.accessToken) {
    throw new SessionExpiredError("no session");
  }

  // ----- 선제 재발급 (proactive reissue) -----
  if (
    s.accessExp !== undefined &&
    s.refreshToken !== undefined &&
    Date.now() / 1000 >= s.accessExp - SKEW_SECONDS
  ) {
    try {
      const tokens = await reissueSingleFlight(
        s.userId ?? "anon",
        s.refreshToken,
      );
      s.accessToken = tokens.accessToken;
      s.refreshToken = tokens.refreshToken;
      s.accessExp = tokens.accessExp;
      await s.save();
    } catch {
      await destroySession();
      throw new SessionExpiredError("토큰 선제 재발급에 실패했습니다.");
    }
  }

  // ----- 본 요청 -----
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${s.accessToken}`,
    },
  });

  // ----- 반응 재발급 (reactive reissue) — 1회만 -----
  if (response.status === 401 && s.refreshToken !== undefined) {
    try {
      const tokens = await reissueSingleFlight(
        s.userId ?? "anon",
        s.refreshToken,
      );
      s.accessToken = tokens.accessToken;
      s.refreshToken = tokens.refreshToken;
      s.accessExp = tokens.accessExp;
      await s.save();
    } catch {
      await destroySession();
      throw new SessionExpiredError("토큰 반응 재발급에 실패했습니다.");
    }

    const retryResponse = await fetch(`${BASE}${path}`, {
      ...init,
      cache: "no-store",
      headers: {
        ...init?.headers,
        Authorization: `Bearer ${s.accessToken}`,
      },
    });

    if (retryResponse.status === 401) {
      await destroySession();
      throw new SessionExpiredError("재발급 후에도 401 응답을 받았습니다.");
    }

    return retryResponse;
  }

  return response;
}

// ---------------------------------------------------------------------------
// JSON 편의 래퍼
// ---------------------------------------------------------------------------

/**
 * serverFetch 를 호출하고 JSON 으로 파싱해 반환합니다.
 * non-OK 응답은 UpstreamError 로 throw 됩니다.
 *
 * 주의: 반환 타입 T 는 런타임 검증 없이 캐스팅됩니다.
 * 중요한 데이터는 zod 등으로 호출자 쪽에서 shape 를 검증하세요.
 *
 * @param path  API 경로
 * @param init  RequestInit
 */
export async function serverFetchJson<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await serverFetch(path, init);

  if (!res.ok) {
    throw await parseProblem(res);
  }

  return (await res.json()) as T;
}
