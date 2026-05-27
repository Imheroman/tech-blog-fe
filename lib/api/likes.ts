/**
 * likes.ts — 게시글 좋아요 상태 데이터 계층 (서버 전용 BFF 모듈).
 *
 * 페이지와 Route Handler 양쪽에서 직접 호출합니다.
 * 페이지가 BFF 자신의 엔드포인트를 self-HTTP 하지 않도록 공유 모듈로 분리했습니다.
 *
 * Mock 모드: 인메모리 Map으로 로컬 개발. 서버 재시작 시 초기화됩니다.
 * Real 모드: serverFetch 를 통해 백엔드 `/api/v1/posts/:slug/like` 에 위임합니다.
 */
import "server-only";

import { posts } from "@/lib/blog-data";
import { isMockMode } from "@/lib/auth/oauth-config";
import { serverFetchJson, SessionExpiredError } from "@/lib/api/server-fetch";

// ---------------------------------------------------------------------------
// 공개 타입
// ---------------------------------------------------------------------------

export interface LikeState {
  likeCount: number;
  isLiked: boolean;
}

// ---------------------------------------------------------------------------
// Mock 인메모리 스토어
// in-memory dev store, resets on server restart.
// ---------------------------------------------------------------------------

/** slug → 이번 세션에서 좋아요를 누른 userId 집합 */
const mockLikers = new Map<string, Set<string>>();

/**
 * blog-data 의 likeCount 를 시드값으로 반환합니다.
 * 시드는 정적 더미 수치이고, mockLikers 의 toggles 는 그 위에 누산됩니다.
 */
function mockSeedCount(slug: string): number {
  return posts.find((p) => p.slug === slug)?.likeCount ?? 0;
}

function getMockLikers(slug: string): Set<string> {
  if (!mockLikers.has(slug)) {
    mockLikers.set(slug, new Set<string>());
  }
  // 위에서 set 했으므로 항상 존재
  return mockLikers.get(slug) as Set<string>;
}

function mockState(slug: string, userId: string | null): LikeState {
  const likers = getMockLikers(slug);
  return {
    likeCount: mockSeedCount(slug) + likers.size,
    isLiked: userId !== null ? likers.has(userId) : false,
  };
}

// ---------------------------------------------------------------------------
// Real 모드 헬퍼
// ---------------------------------------------------------------------------

/**
 * 세션 없이 공개 좋아요 수를 조회합니다.
 * SessionExpiredError(비인증)나 그 외 에러 발생 시 기본값으로 안전하게 폴백합니다.
 */
async function safeGetCount(slug: string): Promise<LikeState> {
  try {
    const state = await serverFetchJson<unknown>(`/api/v1/posts/${slug}/like`);
    if (isLikeState(state)) {
      return state;
    }
    return { likeCount: 0, isLiked: false };
  } catch {
    return { likeCount: 0, isLiked: false };
  }
}

/** unknown → LikeState 타입 가드 */
function isLikeState(value: unknown): value is LikeState {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v["likeCount"] === "number" && typeof v["isLiked"] === "boolean";
}

// ---------------------------------------------------------------------------
// 공개 API
// ---------------------------------------------------------------------------

/**
 * 게시글의 좋아요 상태를 반환합니다.
 * userId 가 null 이면 isLiked 는 항상 false (비인증 공개 조회).
 */
export async function getLikeState(
  slug: string,
  userId: string | null,
): Promise<LikeState> {
  if (isMockMode()) {
    return mockState(slug, userId);
  }

  try {
    const state = await serverFetchJson<unknown>(`/api/v1/posts/${slug}/like`);
    if (isLikeState(state)) {
      return state;
    }
    return { likeCount: 0, isLiked: false };
  } catch (err) {
    if (err instanceof SessionExpiredError) {
      return safeGetCount(slug);
    }
    throw err;
  }
}

/**
 * 좋아요를 설정합니다 (idempotent).
 * 이미 좋아요 상태여도 같은 상태를 반환합니다.
 */
export async function setLike(slug: string, userId: string): Promise<LikeState> {
  if (isMockMode()) {
    getMockLikers(slug).add(userId);
    return mockState(slug, userId);
  }

  const state = await serverFetchJson<unknown>(`/api/v1/posts/${slug}/like`, {
    method: "PUT",
  });
  if (isLikeState(state)) {
    return state;
  }
  return { likeCount: 0, isLiked: true };
}

/**
 * 좋아요를 해제합니다 (idempotent).
 * 이미 좋아요가 없는 상태여도 같은 상태를 반환합니다.
 */
export async function unsetLike(slug: string, userId: string): Promise<LikeState> {
  if (isMockMode()) {
    getMockLikers(slug).delete(userId);
    return mockState(slug, userId);
  }

  const state = await serverFetchJson<unknown>(`/api/v1/posts/${slug}/like`, {
    method: "DELETE",
  });
  if (isLikeState(state)) {
    return state;
  }
  return { likeCount: 0, isLiked: false };
}
