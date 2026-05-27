/**
 * public-fetch.ts — 공개 블로그 API 데이터 페칭 계층.
 *
 * 현재 구현은 lib/blog-data.ts 의 정적 배열을 로컬 데이터 소스로 사용합니다.
 * 실제 백엔드 연결 시, 아래 "LOCAL DATA SOURCE SEAM" 주석 구역을 제거하고
 * 각 함수 내부의 fetch 호출 한 줄로 교체하면 됩니다.
 *
 * TODO(cache): 백엔드 연결 후 "use cache" opt-in 적용
 *              (next.config.mjs 에서 cacheComponents 활성화 필요).
 */

import { posts as allPosts, categories as allCategories } from "@/lib/blog-data";
import type { Post } from "@/lib/blog-data";

// ---------------------------------------------------------------------------
// 공개 API Base URL (환경 변수로 주입).
// 실제 fetch 전환 시 이 상수를 사용합니다.
// ---------------------------------------------------------------------------
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8080/api/v1";
// eslint-disable-next-line @typescript-eslint/no-unused-vars — future real-fetch branch
void API_BASE;

// ---------------------------------------------------------------------------
// Types — API contract (SSOT)
// ---------------------------------------------------------------------------

/** Offset-pagination 응답 봉투. */
export interface Envelope<T> {
  data: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
  sort: string;
}

/**
 * RFC 9457 Problem Details 에러 형태.
 * 400 에러에는 `errors` 배열이 추가됩니다.
 */
export type ProblemDetails =
  | {
      type: string;
      title: string;
      status: number;
      detail: string;
      instance: string;
      code: string;
      errors?: never;
    }
  | {
      type: string;
      title: string;
      status: number;
      detail: string;
      instance: string;
      code: "VALIDATION_FAILED";
      errors: Array<{ field: string; message: string }>;
    };

/**
 * 목록 API 응답 형태 — content 필드 없는 요약본.
 * `status` 필드는 관리 전용이므로 공개 summary 에 포함하지 않습니다.
 */
export type PostSummary = Omit<Post, "content" | "status">;

/** 상세 API 응답 형태 — content 포함 전체 본문. status 는 공개 API 미노출. */
export type PostDetail = Omit<Post, "status">;

// ---------------------------------------------------------------------------
// API category enum (FE-only "All" 은 쿼리 파라미터에서 생략)
// ---------------------------------------------------------------------------
export type ApiCategory = "Engineering" | "Frontend" | "Backend" | "DevOps" | "Design";

// ---------------------------------------------------------------------------
// 에러 파싱 헬퍼 (real-fetch 브랜치에서 사용)
// ---------------------------------------------------------------------------

/**
 * fetch Response 를 ProblemDetails 로 파싱합니다.
 * Content-Type 이 application/problem+json 이 아니면 제네릭 에러를 반환합니다.
 * unknown 을 받아 타입 가드로 좁히므로 any 가 없습니다.
 */
export async function parseProblem(res: Response): Promise<ProblemDetails> {
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (isProblemDetails(body)) {
    return body;
  }

  // 파싱 실패 시 제네릭 Problem Details 반환
  return {
    type: "about:blank",
    title: res.statusText || "Unknown Error",
    status: res.status,
    detail: `HTTP ${res.status}`,
    instance: res.url,
    code: "UNKNOWN_ERROR",
  };
}

function isProblemDetails(value: unknown): value is ProblemDetails {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v["type"] === "string" &&
    typeof v["title"] === "string" &&
    typeof v["status"] === "number" &&
    typeof v["detail"] === "string" &&
    typeof v["instance"] === "string" &&
    typeof v["code"] === "string"
  );
}

// ---------------------------------------------------------------------------
// LOCAL DATA SOURCE SEAM
// 이 구역 전체가 실제 fetch 전환 시 교체 대상입니다.
// ---------------------------------------------------------------------------

/** published 게시글만, publishedAt 내림차순 → slug 오름차순 정렬 */
function publishedSorted(): Post[] {
  return [...allPosts]
    .filter((p) => p.status === "published")
    .sort((a, b) => {
      const timeDiff =
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
      if (timeDiff !== 0) return timeDiff;
      // tie-breaker: slug 사전순
      return a.slug.localeCompare(b.slug);
    });
}

function toSummary(post: Post): PostSummary {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { content: _content, status: _status, ...summary } = post;
  return summary;
}

function toDetail(post: Post): PostDetail {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { status: _status, ...detail } = post;
  return detail;
}

// ---------------------------------------------------------------------------
// Public API functions
// ---------------------------------------------------------------------------

export interface GetPostsParams {
  /** 0-based 페이지 번호 (기본값 0) */
  page?: number;
  /** 페이지 크기 1–50 (기본값 4) */
  size?: number;
  /** 카테고리 필터. "All" 이거나 생략하면 전체 */
  category?: string;
  /** 검색어 */
  q?: string;
  /** 정렬 문자열. 예: "publishedAt,desc" */
  sort?: string;
}

/**
 * 게시글 목록을 페이지네이션 봉투로 반환합니다.
 *
 * TODO(real-fetch): 아래 로컬 구현 대신 아래 한 줄로 교체
 *   return fetch(`${API_BASE}/posts?${new URLSearchParams(params as Record<string, string>)}`).then(r => r.json())
 */
export async function getPosts(params: GetPostsParams = {}): Promise<Envelope<PostSummary>> {
  const {
    page = 0,
    size = 4,
    category,
    q,
    sort = "publishedAt,desc",
  } = params;

  // 유효 범위 클램프 (API 계약: size 1–50)
  const clampedSize = Math.min(50, Math.max(1, size));
  const clampedPage = Math.max(0, page);

  let result = publishedSorted();

  // category 필터 ("All" 또는 생략은 전체)
  if (category && category !== "All") {
    result = result.filter((p) => p.category === category);
  }

  // 검색어 필터
  if (q && q.trim()) {
    const lq = q.trim().toLowerCase();
    result = result.filter(
      (p) =>
        p.title.toLowerCase().includes(lq) ||
        p.excerpt.toLowerCase().includes(lq) ||
        p.category.toLowerCase().includes(lq),
    );
  }

  const totalElements = result.length;
  const totalPages = Math.max(1, Math.ceil(totalElements / clampedSize));

  // 범위 초과 페이지 → 빈 data (에러 아님)
  const start = clampedPage * clampedSize;
  const data: PostSummary[] =
    start >= totalElements ? [] : result.slice(start, start + clampedSize).map(toSummary);

  return {
    data,
    page: clampedPage,
    size: clampedSize,
    totalElements,
    totalPages,
    hasNext: clampedPage < totalPages - 1,
    sort,
  };
}

/**
 * slug 로 게시글 상세를 반환합니다. 없으면 null.
 * 페이지에서 null 수신 시 notFound() 호출.
 *
 * TODO(real-fetch): 아래 로컬 구현 대신 아래로 교체
 *   const res = await fetch(`${API_BASE}/posts/${slug}`)
 *   if (res.status === 404) return null
 *   if (!res.ok) throw await parseProblem(res)
 *   return res.json()
 */
export async function getPostBySlug(slug: string): Promise<PostDetail | null> {
  const post = allPosts.find((p) => p.slug === slug && p.status === "published");
  return post ? toDetail(post) : null;
}

/**
 * 인기 게시글을 views 내림차순으로 반환합니다.
 *
 * TODO(real-fetch): 아래 로컬 구현 대신 아래로 교체
 *   return fetch(`${API_BASE}/posts/popular?limit=${limit}`).then(r => r.json())
 */
export async function getPopularPosts(limit = 5): Promise<PostSummary[]> {
  const sorted = allPosts
    .filter((p) => p.status === "published")
    .sort((a, b) => b.views - a.views)
    .slice(0, limit);
  return sorted.map(toSummary);
}

/**
 * 카테고리 목록을 반환합니다. "All" 은 FE 전용이므로 포함.
 *
 * TODO(real-fetch): 아래 로컬 구현 대신 아래로 교체
 *   return fetch(`${API_BASE}/categories`).then(r => r.json())
 */
export async function getCategories(): Promise<string[]> {
  return [...allCategories];
}
