/**
 * admin-posts.ts — 관리자 게시글 데이터 계층 (서버 전용 BFF 모듈).
 *
 * Route Handler 에서 직접 호출합니다.
 * BFF 가 자신의 엔드포인트를 self-HTTP 하지 않도록 공유 모듈로 분리했습니다.
 *
 * Mock 모드: 인메모리 posts 배열을 직접 변경합니다. 서버 재시작 시 초기화됩니다.
 * Real 모드: serverFetch 를 통해 백엔드 `/api/v1/posts/:slug` 에 위임합니다.
 *
 * 이후 create / delete 함수가 이 모듈에 추가됩니다.
 */
import "server-only";

import { posts } from "@/lib/blog-data";
import { isMockMode } from "@/lib/auth/oauth-config";
import { serverFetchJson } from "@/lib/api/server-fetch";

// ---------------------------------------------------------------------------
// 공개 타입
// ---------------------------------------------------------------------------

export type PostStatus = "draft" | "published";

export interface PostStatusResult {
  slug: string;
  status: PostStatus;
}

// ---------------------------------------------------------------------------
// 에러 타입
// ---------------------------------------------------------------------------

export class NotFoundError extends Error {
  constructor(slug: string) {
    super(`게시글을 찾을 수 없습니다: ${slug}`);
    this.name = "NotFoundError";
  }
}

// ---------------------------------------------------------------------------
// Real 모드 헬퍼
// ---------------------------------------------------------------------------

/** unknown → PostStatusResult 타입 가드 */
function isPostStatusResult(value: unknown): value is PostStatusResult {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v["slug"] === "string" &&
    (v["status"] === "draft" || v["status"] === "published")
  );
}

// ---------------------------------------------------------------------------
// 공개 API
// ---------------------------------------------------------------------------

/**
 * 게시글의 발행 상태를 변경합니다 (idempotent).
 *
 * Mock 모드: 동일 프로세스 내의 posts 배열을 직접 변경합니다.
 *   — 공개 페이지의 getPostBySlug 등이 같은 배열을 참조하므로 즉시 반영됩니다.
 *   — 서버 재시작 시 초기 더미 데이터로 되돌아갑니다.
 * Real 모드: 백엔드 PATCH /api/v1/posts/:slug 에 위임합니다.
 *
 * @throws NotFoundError — Mock 모드에서 slug 에 해당하는 게시글이 없을 때
 */
export async function setPostStatus(
  slug: string,
  status: PostStatus,
): Promise<PostStatusResult> {
  if (isMockMode()) {
    const post = posts.find((p) => p.slug === slug);
    if (post === undefined) {
      throw new NotFoundError(slug);
    }
    // 단일 프로세스 개발 편의 — 같은 배열을 참조하는 공개 read 에도 즉시 반영됩니다.
    post.status = status;
    return { slug, status };
  }

  const result = await serverFetchJson<unknown>(`/api/v1/posts/${slug}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });

  if (!isPostStatusResult(result)) {
    throw new Error(
      `백엔드 응답이 PostStatusResult 형식이 아닙니다: ${JSON.stringify(result)}`,
    );
  }

  return result;
}
