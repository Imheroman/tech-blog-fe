/**
 * comments.ts — 댓글 + 1-depth 답글 데이터 계층 (서버 전용 BFF 모듈).
 *
 * 페이지와 Route Handler 양쪽에서 직접 호출합니다.
 * 페이지가 BFF 자신의 엔드포인트를 self-HTTP 하지 않도록 공유 모듈로 분리했습니다.
 *
 * Mock 모드: 인메모리 Map으로 로컬 개발. 서버 재시작 시 초기화됩니다.
 * Real 모드: serverFetchJson 을 통해 백엔드 /api/v1/... 에 위임합니다.
 *
 * avatarUrl 플레이스홀더: dicebear initials SVG (결정론적, 호스팅 불필요).
 *   https://api.dicebear.com/9.x/initials/svg?seed=<name>
 */
import "server-only";

import { isMockMode } from "@/lib/auth/oauth-config";
import { serverFetchJson } from "@/lib/api/server-fetch";
import type { Envelope } from "@/lib/api/public-fetch";

// Re-export Envelope so callers can import from one place.
export type { Envelope };

// ---------------------------------------------------------------------------
// 도메인 타입
// ---------------------------------------------------------------------------

export interface CommentAuthor {
  id: string;
  name: string;
  /** dicebear initials placeholder — never null */
  avatarUrl: string;
}

export interface Comment {
  id: string;
  author: CommentAuthor;
  content: string;
  /** RFC 3339 UTC */
  createdAt: string;
  editedAt: string | null;
  /** roots only: 삭제되지 않은 자식 수 */
  replyCount: number;
  /** tombstone flag */
  isDeleted: boolean;
  /** root 의 첫 페이지 replies (최대 3건, mock) */
  replies: Comment[];
}

// ---------------------------------------------------------------------------
// 에러 타입
// ---------------------------------------------------------------------------

export class ValidationError extends Error {
  readonly code = "VALIDATION_FAILED" as const;
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends Error {
  readonly code = "NOT_FOUND" as const;
  constructor(message?: string) {
    super(message ?? "댓글을 찾을 수 없습니다.");
    this.name = "NotFoundError";
  }
}

export class ForbiddenError extends Error {
  readonly code = "FORBIDDEN" as const;
  constructor(message?: string) {
    super(message ?? "이 작업을 수행할 권한이 없습니다.");
    this.name = "ForbiddenError";
  }
}

// ---------------------------------------------------------------------------
// Mock 인메모리 스토어
// in-memory dev store, resets on server restart.
// ---------------------------------------------------------------------------

interface CommentRecord {
  id: string;
  /** 게시글 slug */
  slug: string;
  /** null = root comment */
  parentId: string | null;
  authorId: string;
  authorName: string;
  content: string;
  /** RFC 3339 UTC */
  createdAt: string;
  editedAt: string | null;
  isDeleted: boolean;
}

/** slug → 해당 게시글의 모든 댓글·답글 레코드 */
const mockStore = new Map<string, CommentRecord[]>();

// ---------------------------------------------------------------------------
// Mock 유틸
// ---------------------------------------------------------------------------

/** dicebear initials SVG — 결정론적, 서드파티 호스팅 없이 사용 가능 */
function avatarUrl(name: string): string {
  return `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(name)}`;
}

function nowIso(): string {
  return new Date().toISOString().replace(".000Z", "Z");
}

/**
 * 슬러그 첫 조회 시 샘플 데이터를 시드합니다.
 * dev 데모 목적 — UI 가 비어 있지 않도록 합니다.
 */
function seedIfEmpty(slug: string): void {
  if (mockStore.has(slug)) return;

  const rootA = crypto.randomUUID();
  const rootB = crypto.randomUUID();
  const replyA = crypto.randomUUID();

  const seed: CommentRecord[] = [
    {
      id: rootA,
      slug,
      parentId: null,
      authorId: "seed-user-1",
      authorName: "김개발",
      content: "좋은 글 감사합니다! 많이 배웠어요.",
      createdAt: "2025-01-10T09:00:00Z",
      editedAt: null,
      isDeleted: false,
    },
    {
      id: rootB,
      slug,
      parentId: null,
      authorId: "seed-user-2",
      authorName: "이프론트",
      content: "Next.js 예제가 정말 도움이 됐습니다.",
      createdAt: "2025-01-11T14:30:00Z",
      editedAt: null,
      isDeleted: false,
    },
    {
      id: replyA,
      slug,
      parentId: rootA,
      authorId: "seed-user-2",
      authorName: "이프론트",
      content: "저도 같은 생각입니다!",
      createdAt: "2025-01-10T10:15:00Z",
      editedAt: null,
      isDeleted: false,
    },
  ];

  mockStore.set(slug, seed);
}

function getRecords(slug: string): CommentRecord[] {
  seedIfEmpty(slug);
  return mockStore.get(slug) as CommentRecord[];
}

/** CommentRecord → Comment (root 기준 트리 조립) */
function toComment(record: CommentRecord, allRecords: CommentRecord[]): Comment {
  const children = allRecords.filter((r) => r.parentId === record.id);
  const nonDeletedChildren = children.filter((r) => !r.isDeleted);

  // replies: 삭제된 것 포함 최대 3건 (tombstone 도 UI 에 표시 가능)
  const replies = children.slice(0, 3).map((r) => toLeafComment(r));

  return {
    id: record.id,
    author: {
      id: record.authorId,
      name: record.authorName,
      avatarUrl: avatarUrl(record.authorName),
    },
    content: record.isDeleted ? "" : record.content,
    createdAt: record.createdAt,
    editedAt: record.editedAt,
    replyCount: nonDeletedChildren.length,
    isDeleted: record.isDeleted,
    replies,
  };
}

/** 자식 노드 — replies 는 빈 배열 (1-level 보장) */
function toLeafComment(record: CommentRecord): Comment {
  return {
    id: record.id,
    author: {
      id: record.authorId,
      name: record.authorName,
      avatarUrl: avatarUrl(record.authorName),
    },
    content: record.isDeleted ? "" : record.content,
    createdAt: record.createdAt,
    editedAt: record.editedAt,
    replyCount: 0,
    isDeleted: record.isDeleted,
    replies: [],
  };
}

function makeEnvelope<T>(
  data: T[],
  page: number,
  size: number,
  total: number,
  sort: string,
): Envelope<T> {
  const totalPages = Math.max(1, Math.ceil(total / size));
  return {
    data,
    page,
    size,
    totalElements: total,
    totalPages,
    hasNext: page < totalPages - 1,
    sort,
  };
}

// ---------------------------------------------------------------------------
// 입력 검증
// ---------------------------------------------------------------------------

function validateContent(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new ValidationError("댓글 내용을 입력해 주세요.");
  }
  return trimmed;
}

// ---------------------------------------------------------------------------
// Real 모드 타입 가드
// ---------------------------------------------------------------------------

function isComment(value: unknown): value is Comment {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v["id"] === "string" &&
    typeof v["content"] === "string" &&
    typeof v["createdAt"] === "string" &&
    typeof v["isDeleted"] === "boolean" &&
    typeof v["replyCount"] === "number" &&
    Array.isArray(v["replies"])
  );
}

function isEnvelopeComment(value: unknown): value is Envelope<Comment> {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    Array.isArray(v["data"]) &&
    typeof v["page"] === "number" &&
    typeof v["size"] === "number" &&
    typeof v["totalElements"] === "number" &&
    typeof v["totalPages"] === "number" &&
    typeof v["hasNext"] === "boolean" &&
    typeof v["sort"] === "string"
  );
}

// ---------------------------------------------------------------------------
// 공개 API — listComments
// ---------------------------------------------------------------------------

export interface ListCommentsParams {
  page?: number;
  size?: number;
  sort?: string;
}

/**
 * 게시글 루트 댓글 목록을 페이지네이션 봉투로 반환합니다.
 * 공개 API (인증 불필요).
 */
export async function listComments(
  slug: string,
  { page = 0, size = 10, sort = "createdAt,desc" }: ListCommentsParams = {},
): Promise<Envelope<Comment>> {
  if (isMockMode()) {
    const records = getRecords(slug);
    const roots = records
      .filter((r) => r.parentId === null)
      .sort((a, b) =>
        sort.includes("asc")
          ? a.createdAt.localeCompare(b.createdAt)
          : b.createdAt.localeCompare(a.createdAt),
      );

    const total = roots.length;
    const start = page * size;
    const page_data = roots.slice(start, start + size).map((r) => toComment(r, records));

    return makeEnvelope(page_data, page, size, total, sort);
  }

  const qs = new URLSearchParams({
    page: String(page),
    size: String(size),
    sort,
  });
  const raw = await serverFetchJson<unknown>(`/api/v1/posts/${slug}/comments?${qs}`);
  if (isEnvelopeComment(raw)) return raw;
  return makeEnvelope([], page, size, 0, sort);
}

// ---------------------------------------------------------------------------
// 공개 API — createComment
// ---------------------------------------------------------------------------

/**
 * 루트 댓글을 생성합니다. USER 이상 필요 (호출 전 Route Handler에서 인가).
 *
 * author.name 처리:
 *   - Mock 모드: `사용자-${userId.slice(0,6)}` (세션에 표시 이름 없음)
 *   - Real 모드: 백엔드가 author 를 세션에서 채우므로 name 을 전송하지 않음.
 */
export async function createComment(
  slug: string,
  user: { userId: string; name: string },
  rawContent: string,
): Promise<Comment> {
  const content = validateContent(rawContent);

  if (isMockMode()) {
    const records = getRecords(slug);
    const record: CommentRecord = {
      id: crypto.randomUUID(),
      slug,
      parentId: null,
      authorId: user.userId,
      authorName: user.name,
      content,
      createdAt: nowIso(),
      editedAt: null,
      isDeleted: false,
    };
    records.push(record);
    return toComment(record, records);
  }

  const raw = await serverFetchJson<unknown>(`/api/v1/posts/${slug}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (isComment(raw)) return raw;
  throw new Error("백엔드 댓글 응답 형식이 올바르지 않습니다.");
}

// ---------------------------------------------------------------------------
// 공개 API — listReplies
// ---------------------------------------------------------------------------

export interface ListRepliesParams {
  page?: number;
  size?: number;
}

/**
 * 루트 댓글의 답글 목록을 페이지네이션 봉투로 반환합니다.
 * 공개 API (인증 불필요).
 */
export async function listReplies(
  rootId: string,
  { page = 0, size = 10 }: ListRepliesParams = {},
): Promise<Envelope<Comment>> {
  const sort = "createdAt,asc";

  if (isMockMode()) {
    // rootId 가 속한 slug 를 역조회합니다.
    const slug = findSlugByCommentId(rootId);
    if (slug === null) return makeEnvelope([], page, size, 0, sort);

    const records = getRecords(slug);
    const root = records.find((r) => r.id === rootId);
    if (!root) return makeEnvelope([], page, size, 0, sort);

    // 1-level 보장: rootId 가 자식이면 부모를 pivot 으로 사용
    const pivotId = root.parentId ?? root.id;

    const children = records
      .filter((r) => r.parentId === pivotId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    const total = children.length;
    const page_data = children
      .slice(page * size, page * size + size)
      .map((r) => toLeafComment(r));

    return makeEnvelope(page_data, page, size, total, sort);
  }

  const qs = new URLSearchParams({ page: String(page), size: String(size) });
  const raw = await serverFetchJson<unknown>(`/api/v1/comments/${rootId}/replies?${qs}`);
  if (isEnvelopeComment(raw)) return raw;
  return makeEnvelope([], page, size, 0, sort);
}

// ---------------------------------------------------------------------------
// 공개 API — createReply
// ---------------------------------------------------------------------------

/**
 * 답글을 생성합니다. 1-level 보장:
 *   rootId 가 이미 답글이면 그 부모 댓글(root)을 parentId 로 사용합니다.
 */
export async function createReply(
  rootId: string,
  user: { userId: string; name: string },
  rawContent: string,
): Promise<Comment> {
  const content = validateContent(rawContent);

  if (isMockMode()) {
    const slug = findSlugByCommentId(rootId);
    if (slug === null) throw new NotFoundError();

    const records = getRecords(slug);
    const target = records.find((r) => r.id === rootId);
    if (!target) throw new NotFoundError();

    // 1-level 보장: target 이 이미 자식이면 그 부모로 플래튼
    const parentId = target.parentId ?? target.id;

    const record: CommentRecord = {
      id: crypto.randomUUID(),
      slug,
      parentId,
      authorId: user.userId,
      authorName: user.name,
      content,
      createdAt: nowIso(),
      editedAt: null,
      isDeleted: false,
    };
    records.push(record);
    return toLeafComment(record);
  }

  const raw = await serverFetchJson<unknown>(`/api/v1/comments/${rootId}/replies`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (isComment(raw)) return raw;
  throw new Error("백엔드 답글 응답 형식이 올바르지 않습니다.");
}

// ---------------------------------------------------------------------------
// 공개 API — updateComment
// ---------------------------------------------------------------------------

/**
 * 댓글/답글 내용을 수정합니다. 작성자만 수정 가능합니다.
 *
 * @throws NotFoundError  — id 없음
 * @throws ForbiddenError — 작성자 불일치
 * @throws ValidationError — 내용 빈 문자열
 */
export async function updateComment(
  id: string,
  actor: { userId: string; role: string },
  rawContent: string,
): Promise<Comment> {
  const content = validateContent(rawContent);

  if (isMockMode()) {
    const slug = findSlugByCommentId(id);
    if (slug === null) throw new NotFoundError();

    const records = getRecords(slug);
    const idx = records.findIndex((r) => r.id === id);
    if (idx === -1) throw new NotFoundError();

    const record = records[idx] as CommentRecord;

    if (record.authorId !== actor.userId) {
      throw new ForbiddenError("댓글 작성자만 수정할 수 있습니다.");
    }

    const updated: CommentRecord = {
      ...record,
      content,
      editedAt: nowIso(),
    };
    records[idx] = updated;

    const isRoot = updated.parentId === null;
    return isRoot ? toComment(updated, records) : toLeafComment(updated);
  }

  const raw = await serverFetchJson<unknown>(`/api/v1/comments/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (isComment(raw)) return raw;
  throw new Error("백엔드 댓글 수정 응답 형식이 올바르지 않습니다.");
}

// ---------------------------------------------------------------------------
// 공개 API — softDeleteComment
// ---------------------------------------------------------------------------

/**
 * 댓글/답글을 소프트 삭제합니다 (tombstone).
 * 작성자 또는 ADMIN/SUPER_ADMIN 만 삭제 가능합니다.
 * 이미 삭제된 경우 멱등하게 tombstone 을 반환합니다.
 *
 * @throws NotFoundError  — id 없음
 * @throws ForbiddenError — 작성자·관리자 아님
 */
export async function softDeleteComment(
  id: string,
  actor: { userId: string; role: string },
): Promise<Comment> {
  if (isMockMode()) {
    const slug = findSlugByCommentId(id);
    if (slug === null) throw new NotFoundError();

    const records = getRecords(slug);
    const idx = records.findIndex((r) => r.id === id);
    if (idx === -1) throw new NotFoundError();

    const record = records[idx] as CommentRecord;

    const isAuthor = record.authorId === actor.userId;
    const isAdmin = actor.role === "ADMIN" || actor.role === "SUPER_ADMIN";

    if (!isAuthor && !isAdmin) {
      throw new ForbiddenError("댓글 작성자 또는 관리자만 삭제할 수 있습니다.");
    }

    // 이미 삭제된 경우 멱등하게 tombstone 반환
    if (record.isDeleted) {
      return record.parentId === null
        ? toComment(record, records)
        : toLeafComment(record);
    }

    const deleted: CommentRecord = {
      ...record,
      isDeleted: true,
      content: "",
    };
    records[idx] = deleted;

    return deleted.parentId === null
      ? toComment(deleted, records)
      : toLeafComment(deleted);
  }

  const raw = await serverFetchJson<unknown>(`/api/v1/comments/${id}`, {
    method: "DELETE",
  });
  if (isComment(raw)) return raw;
  // 204 No Content 시 tombstone 구조 반환
  return {
    id,
    author: { id: "", name: "", avatarUrl: avatarUrl("") },
    content: "",
    createdAt: "",
    editedAt: null,
    replyCount: 0,
    isDeleted: true,
    replies: [],
  };
}

// ---------------------------------------------------------------------------
// Mock 전용 내부 유틸
// ---------------------------------------------------------------------------

/** 전체 mockStore 를 순회해 commentId 가 속한 slug 를 찾습니다. */
function findSlugByCommentId(commentId: string): string | null {
  for (const [slug, records] of mockStore.entries()) {
    if (records.some((r) => r.id === commentId)) return slug;
  }
  return null;
}
