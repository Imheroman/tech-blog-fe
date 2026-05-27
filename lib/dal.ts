/**
 * dal.ts — 데이터 접근 계층 (서버 전용 인가 가드).
 *
 * 이 계층은 UX 수준의 조기 실패(fast-fail) 및 심층 방어(defense-in-depth) 목적입니다.
 * 최종 권한 검증은 백엔드에서 수행합니다 — 여기서 통과했다고 신뢰하지 마세요.
 * 클라이언트가 전달한 역할/플래그는 믿지 않고, 항상 서버 세션에서 읽습니다.
 *
 * 주의: 토큰 재발급(reissue)은 이 계층에서 수행하지 않습니다.
 * RSC 렌더링 중에는 쿠키 쓰기가 불가능하기 때문입니다.
 * 재발급은 Route Handler / Server Action 컨텍스트의 server-fetch 에서 처리합니다.
 */
import "server-only";

import { cache } from "react";
import { getCurrentUser } from "./auth/session";
import type { Role } from "./auth/port";

// ---------------------------------------------------------------------------
// 역할 계층 (Role hierarchy)
// ---------------------------------------------------------------------------

/** 역할 서열 맵. 숫자가 클수록 상위 역할입니다. */
const ROLE_RANK: Record<Role, number> = {
  USER: 1,
  ADMIN: 2,
  SUPER_ADMIN: 3,
};

/** 역할의 서열 값을 반환합니다. */
function roleRank(role: Role): number {
  return ROLE_RANK[role];
}

// ---------------------------------------------------------------------------
// 에러 타입
// ---------------------------------------------------------------------------

export class AuthzError extends Error {
  readonly status: 401 | 403;
  readonly reason: "UNAUTHENTICATED" | "FORBIDDEN";

  constructor(
    status: 401 | 403,
    reason: "UNAUTHENTICATED" | "FORBIDDEN",
    message?: string,
  ) {
    super(message ?? reason);
    this.name = "AuthzError";
    this.status = status;
    this.reason = reason;
  }
}

// ---------------------------------------------------------------------------
// 가드 함수
// ---------------------------------------------------------------------------

/**
 * 현재 요청의 사용자를 반환합니다.
 * 로그인하지 않은 경우 null 을 반환합니다.
 *
 * `cache()` 로 감싸져 있으므로 단일 요청 내에서 중복 세션 읽기가 제거됩니다.
 * RSC 읽기 전용 — 세션을 쓰거나 저장하지 않습니다.
 */
export const getUser = cache(
  async (): Promise<{ userId: string; role: Role } | null> => {
    return getCurrentUser();
  },
);

/**
 * 인증된 사용자를 요구합니다.
 * 세션이 없으면 `AuthzError(401, "UNAUTHENTICATED")` 를 throw 합니다.
 */
export async function requireAuth(): Promise<{ userId: string; role: Role }> {
  const user = await getUser();
  if (user === null) {
    throw new AuthzError(401, "UNAUTHENTICATED", "로그인이 필요합니다.");
  }
  return user;
}

/**
 * 특정 역할 이상의 사용자를 요구합니다.
 *
 * 역할 서열: SUPER_ADMIN(3) > ADMIN(2) > USER(1).
 * `allowed` 중 최저 서열 이상이면 통과합니다
 * (예: `requireRole("ADMIN")` 은 ADMIN 과 SUPER_ADMIN 이 통과).
 *
 * @throws AuthzError(401) — 미인증
 * @throws AuthzError(403) — 인증되었으나 역할 서열 부족
 */
export async function requireRole(
  ...allowed: Role[]
): Promise<{ userId: string; role: Role }> {
  const user = await requireAuth();

  // 허용 역할 중 최소 서열을 기준으로 비교합니다.
  const minAllowedRank = Math.min(...allowed.map(roleRank));

  if (roleRank(user.role) < minAllowedRank) {
    throw new AuthzError(
      403,
      "FORBIDDEN",
      `이 작업을 수행할 권한이 없습니다. 필요한 최소 역할: ${allowed.join(", ")}`,
    );
  }

  return user;
}
