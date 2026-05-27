/**
 * admin-posts.ts — 관리자 게시글 데이터 계층 (서버 전용 BFF 모듈).
 *
 * Route Handler 에서 직접 호출합니다.
 * BFF 가 자신의 엔드포인트를 self-HTTP 하지 않도록 공유 모듈로 분리했습니다.
 *
 * Mock 모드: 인메모리 posts 배열을 직접 변경합니다. 서버 재시작 시 초기화됩니다.
 * Real 모드: serverFetch 를 통해 백엔드 `/api/v1/posts/:slug` 에 위임합니다.
 */
import "server-only";

import { type Post, posts } from "@/lib/blog-data";
import { isMockMode } from "@/lib/auth/oauth-config";
import { serverFetch, serverFetchJson } from "@/lib/api/server-fetch";

// ---------------------------------------------------------------------------
// 공개 타입
// ---------------------------------------------------------------------------

export type PostStatus = "draft" | "published";

export interface PostStatusResult {
  slug: string;
  status: PostStatus;
}

/** 게시글 생성 입력. 모든 필드 필수. */
export interface PostInput {
  title: string;
  excerpt: string;
  content: string;
  category: string;
  thumbnail: string;
  status: PostStatus;
}

/** 게시글 부분 수정 입력. 모든 필드 선택적. */
export type PostPatch = Partial<PostInput>;

// ---------------------------------------------------------------------------
// 에러 타입
// ---------------------------------------------------------------------------

export class NotFoundError extends Error {
  constructor(slug: string) {
    super(`게시글을 찾을 수 없습니다: ${slug}`);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends Error {
  constructor(slug: string) {
    super(`이미 존재하는 슬러그입니다: ${slug}`);
    this.name = "ConflictError";
  }
}

// ---------------------------------------------------------------------------
// 내부 유틸
// ---------------------------------------------------------------------------

/**
 * 제목을 URL-safe 슬러그로 변환합니다.
 * - 소문자 변환 후 공백 → "-", 영숫자·하이픈 외 제거, 연속 하이픈 축소.
 * - 한국어 등 비ASCII 문자가 모두 제거돼 빈 문자열이 되면 `post-${Date.now()}` 폴백.
 */
function toSlug(title: string): string {
  const candidate = title
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");

  return candidate.length > 0 ? candidate : `post-${Date.now()}`;
}

/**
 * 기존 슬러그 목록에 충돌이 없는 유일한 슬러그를 반환합니다.
 * 충돌 시 `-2`, `-3`, … 을 순차적으로 붙입니다.
 */
function uniqueSlug(base: string, existing: string[]): string {
  if (!existing.includes(base)) return base;

  let counter = 2;
  while (existing.includes(`${base}-${counter}`)) {
    counter += 1;
  }
  return `${base}-${counter}`;
}

/**
 * 본문 길이에서 읽기 시간(분)을 추정합니다.
 * 공백 기준 단어 수를 200 wpm 으로 나눕니다.
 */
function estimateReadTime(content: string): number {
  const wordishCount = content.trim().split(/\s+/).length;
  return Math.max(1, Math.round(wordishCount / 200));
}

// ---------------------------------------------------------------------------
// Real 모드 타입 가드
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

/** unknown → Post 타입 가드 (백엔드 응답 검증용). */
function isPost(value: unknown): value is Post {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v["slug"] === "string" &&
    typeof v["title"] === "string" &&
    typeof v["excerpt"] === "string" &&
    typeof v["content"] === "string" &&
    typeof v["category"] === "string" &&
    typeof v["publishedAt"] === "string" &&
    typeof v["readTimeMinutes"] === "number" &&
    typeof v["thumbnail"] === "string" &&
    typeof v["views"] === "number" &&
    (v["status"] === "draft" || v["status"] === "published") &&
    typeof v["likeCount"] === "number" &&
    typeof v["commentCount"] === "number"
  );
}

/** unknown → Post[] 타입 가드 */
function isPostArray(value: unknown): value is Post[] {
  return Array.isArray(value) && value.every(isPost);
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

/**
 * 새 게시글을 생성합니다.
 *
 * Mock 모드: posts 배열 앞에 삽입합니다 (dev-only, 재시작 시 초기화).
 * Real 모드: 백엔드 POST /api/v1/posts (201) 에 위임합니다.
 *
 * @throws ConflictError — 동일 슬러그가 이미 존재할 때 (Mock 모드)
 */
export async function createPost(input: PostInput): Promise<Post> {
  if (isMockMode()) {
    const existingSlugs = posts.map((p) => p.slug);
    const baseSlug = toSlug(input.title);
    const slug = uniqueSlug(baseSlug, existingSlugs);

    // uniqueSlug 는 항상 미사용 슬러그를 반환하므로 여기선 충돌 불가.
    // 그러나 외부에서 동일 base 를 직접 지정해 올 수 있으므로 guard 유지.
    if (existingSlugs.includes(slug)) {
      throw new ConflictError(slug);
    }

    const newPost: Post = {
      slug,
      title: input.title,
      excerpt: input.excerpt,
      content: input.content,
      category: input.category,
      thumbnail: input.thumbnail,
      status: input.status,
      publishedAt: new Date().toISOString(),
      readTimeMinutes: estimateReadTime(input.content),
      views: 0,
      likeCount: 0,
      commentCount: 0,
    };

    // dev-only 인메모리 변경 — 재시작 시 초기화됩니다.
    posts.unshift(newPost);
    return newPost;
  }

  const result = await serverFetchJson<unknown>("/api/v1/posts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!isPost(result)) {
    throw new Error(
      `백엔드 응답이 Post 형식이 아닙니다: ${JSON.stringify(result)}`,
    );
  }

  return result;
}

/**
 * 게시글을 부분 수정합니다.
 *
 * Mock 모드: posts 배열에서 해당 항목을 직접 변경합니다.
 * Real 모드: 백엔드 PATCH /api/v1/posts/:slug 에 위임합니다.
 *
 * @throws NotFoundError — slug 에 해당하는 게시글이 없을 때
 */
export async function updatePost(slug: string, patch: PostPatch): Promise<Post> {
  if (isMockMode()) {
    const index = posts.findIndex((p) => p.slug === slug);
    if (index === -1) {
      throw new NotFoundError(slug);
    }

    const existing = posts[index];

    // content 가 변경된 경우 readTimeMinutes 재산정
    const newContent = patch.content ?? existing.content;
    const readTimeMinutes =
      patch.content !== undefined
        ? estimateReadTime(newContent)
        : existing.readTimeMinutes;

    const updated: Post = {
      ...existing,
      ...(patch.title !== undefined && { title: patch.title }),
      ...(patch.excerpt !== undefined && { excerpt: patch.excerpt }),
      ...(patch.content !== undefined && { content: patch.content }),
      ...(patch.category !== undefined && { category: patch.category }),
      ...(patch.thumbnail !== undefined && { thumbnail: patch.thumbnail }),
      ...(patch.status !== undefined && { status: patch.status }),
      readTimeMinutes,
      updatedAt: new Date().toISOString(),
    };

    // dev-only 인메모리 변경 — 재시작 시 초기화됩니다.
    posts[index] = updated;
    return updated;
  }

  const result = await serverFetchJson<unknown>(`/api/v1/posts/${slug}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });

  if (!isPost(result)) {
    throw new Error(
      `백엔드 응답이 Post 형식이 아닙니다: ${JSON.stringify(result)}`,
    );
  }

  return result;
}

/**
 * 게시글을 삭제합니다.
 *
 * Mock 모드: posts 배열에서 제거합니다 (dev-only, 재시작 시 초기화).
 * Real 모드: 백엔드 DELETE /api/v1/posts/:slug (204) 에 위임합니다.
 *
 * @throws NotFoundError — slug 에 해당하는 게시글이 없을 때
 */
export async function deletePost(slug: string): Promise<void> {
  if (isMockMode()) {
    const index = posts.findIndex((p) => p.slug === slug);
    if (index === -1) {
      throw new NotFoundError(slug);
    }

    // dev-only 인메모리 변경 — 재시작 시 초기화됩니다.
    posts.splice(index, 1);
    return;
  }

  // DELETE는 204(빈 바디)를 반환하므로 JSON 파싱 없이 raw Response로 처리한다.
  const res = await serverFetch(`/api/v1/posts/${slug}`, { method: "DELETE" });
  if (res.status === 404) {
    throw new NotFoundError(slug);
  }
  if (!res.ok) {
    throw new Error(`게시글 삭제 실패: HTTP ${res.status}`);
  }
}

/**
 * 관리자용 게시글 전체 목록을 반환합니다 (draft 포함).
 *
 * Mock 모드: 인메모리 posts 배열을 그대로 반환합니다.
 * Real 모드: 백엔드 GET /api/v1/posts 에 위임합니다.
 *   — 주의: 백엔드 admin-scope 엔드포인트/파라미터 확정 전 (백엔드 확인 필요).
 *     현재는 admin=true 쿼리 파라미터를 사용하는 임시 구현입니다.
 */
export async function listAllPostsForAdmin(): Promise<Post[]> {
  if (isMockMode()) {
    // dev-only — 동일 참조를 반환해 공개 read 와 같은 배열을 봅니다.
    return posts;
  }

  // TODO: 백엔드 admin-list 엔드포인트/스코핑 확정 후 경로 갱신 필요.
  const result = await serverFetchJson<unknown>("/api/v1/posts?admin=true");

  if (!isPostArray(result)) {
    throw new Error(
      `백엔드 응답이 Post[] 형식이 아닙니다: ${JSON.stringify(result)}`,
    );
  }

  return result;
}

/**
 * 관리자용 단일 게시글 조회 (draft 포함).
 *
 * Mock 모드: 인메모리 posts 배열에서 slug 로 찾습니다.
 * Real 모드: 백엔드 GET /api/v1/posts/:slug 에 위임합니다.
 */
export async function getPostForAdmin(slug: string): Promise<Post | null> {
  if (isMockMode()) {
    return posts.find((p) => p.slug === slug) ?? null;
  }

  let result: unknown;
  try {
    result = await serverFetchJson<unknown>(`/api/v1/posts/${slug}`);
  } catch (err) {
    // 404 는 null 반환, 그 외는 re-throw
    if (
      typeof err === "object" &&
      err !== null &&
      "status" in err &&
      (err as { status: number }).status === 404
    ) {
      return null;
    }
    throw err;
  }

  if (!isPost(result)) {
    throw new Error(
      `백엔드 응답이 Post 형식이 아닙니다: ${JSON.stringify(result)}`,
    );
  }

  return result;
}
