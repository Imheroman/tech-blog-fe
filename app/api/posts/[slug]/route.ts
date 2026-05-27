/**
 * route.ts — 게시글 개별 항목 관리자 API Route Handler.
 *
 * PATCH /api/posts/:slug — 부분 수정 (status 단독 포함, ADMIN 이상 필요)
 * DELETE /api/posts/:slug — 게시글 삭제 (ADMIN 이상 필요)
 *
 * PATCH 멱등성: 현재 상태와 동일한 값으로 요청해도 같은 결과를 반환합니다.
 */
export const runtime = "nodejs";

import { type NextRequest } from "next/server";
import { requireRole, AuthzError } from "@/lib/dal";
import { assertSameOrigin, problemJson, OriginError } from "@/lib/http/origin";
import {
  setPostStatus,
  updatePost,
  deletePost,
  NotFoundError,
  type PostStatus,
  type PostPatch,
} from "@/lib/api/admin-posts";

// ---------------------------------------------------------------------------
// 타입
// ---------------------------------------------------------------------------

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// ---------------------------------------------------------------------------
// 내부 유틸 — 공통 가드 헬퍼
// ---------------------------------------------------------------------------

/** Origin 검사 실패 시 Response 를 반환합니다. 통과 시 null. */
function checkOrigin(req: NextRequest): Response | null {
  try {
    assertSameOrigin(req);
    return null;
  } catch (err) {
    if (err instanceof OriginError) {
      return problemJson(403, "FORBIDDEN_ORIGIN", err.message);
    }
    throw err;
  }
}

/** 인가 검사 실패 시 Response 를 반환합니다. 통과 시 null. */
async function checkAdmin(): Promise<Response | null> {
  try {
    await requireRole("ADMIN");
    return null;
  } catch (err) {
    if (err instanceof AuthzError) {
      const code =
        err.reason === "UNAUTHENTICATED" ? "UNAUTHENTICATED" : "FORBIDDEN";
      return problemJson(err.status, code, err.message);
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// PATCH — 게시글 부분 수정 (idempotent)
//
// 요청 바디에 status 만 있으면 기존 setPostStatus 경로와 동일하게 동작합니다.
// 그 외 PostPatch 필드가 있으면 updatePost 로 위임합니다.
// 빈 바디(유효 키 없음)는 400 을 반환합니다.
// ---------------------------------------------------------------------------

export async function PATCH(
  req: NextRequest,
  { params }: RouteContext,
): Promise<Response> {
  // 1. CSRF Origin 검사
  const originErr = checkOrigin(req);
  if (originErr !== null) return originErr;

  // 2. 인가 검사 — ADMIN 이상 필요 (USER 는 403)
  const adminErr = await checkAdmin();
  if (adminErr !== null) return adminErr;

  // 3. 요청 바디 파싱
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return problemJson(400, "VALIDATION_FAILED", "요청 바디가 유효한 JSON 이 아닙니다.");
  }

  if (typeof body !== "object" || body === null) {
    return problemJson(400, "VALIDATION_FAILED", "요청 바디가 객체여야 합니다.");
  }

  const b = body as Record<string, unknown>;

  // 4. 각 필드 검증 (존재하는 키만)
  const patchableStringFields = [
    "title",
    "excerpt",
    "content",
    "category",
    "thumbnail",
  ] as const;

  for (const field of patchableStringFields) {
    if (field in b) {
      if (typeof b[field] !== "string" || (b[field] as string).trim().length === 0) {
        return problemJson(
          400,
          "VALIDATION_FAILED",
          `${field} 는 비어 있지 않은 문자열이어야 합니다.`,
        );
      }
    }
  }

  if ("status" in b && b["status"] !== "draft" && b["status"] !== "published") {
    return problemJson(400, "VALIDATION_FAILED", "status must be draft|published");
  }

  // 5. 유효 패치 키 수집
  const patch: PostPatch = {};
  if ("title" in b) patch.title = (b["title"] as string).trim();
  if ("excerpt" in b) patch.excerpt = (b["excerpt"] as string).trim();
  if ("content" in b) patch.content = (b["content"] as string).trim();
  if ("category" in b) patch.category = (b["category"] as string).trim();
  if ("thumbnail" in b) patch.thumbnail = (b["thumbnail"] as string).trim();
  if ("status" in b) patch.status = b["status"] as PostStatus;

  if (Object.keys(patch).length === 0) {
    return problemJson(400, "VALIDATION_FAILED", "수정할 필드가 하나 이상 있어야 합니다.");
  }

  // 6. 비즈니스 로직
  // status 만 변경하는 경우 기존 setPostStatus 로 위임해 동작을 유지합니다.
  const { slug } = await params;

  try {
    if (Object.keys(patch).length === 1 && patch.status !== undefined) {
      const result = await setPostStatus(slug, patch.status);
      return Response.json(result);
    }

    const updated = await updatePost(slug, patch);
    return Response.json(updated);
  } catch (err) {
    if (err instanceof NotFoundError) {
      return problemJson(404, "POST_NOT_FOUND", err.message);
    }
    return problemJson(500, "INTERNAL", "서버 내부 오류가 발생했습니다.");
  }
}

// ---------------------------------------------------------------------------
// DELETE — 게시글 삭제
// ---------------------------------------------------------------------------

export async function DELETE(
  req: NextRequest,
  { params }: RouteContext,
): Promise<Response> {
  // 1. CSRF Origin 검사
  const originErr = checkOrigin(req);
  if (originErr !== null) return originErr;

  // 2. 인가 검사 — ADMIN 이상 필요
  const adminErr = await checkAdmin();
  if (adminErr !== null) return adminErr;

  // 3. 비즈니스 로직
  const { slug } = await params;

  try {
    await deletePost(slug);
    return new Response(null, { status: 204 });
  } catch (err) {
    if (err instanceof NotFoundError) {
      return problemJson(404, "POST_NOT_FOUND", err.message);
    }
    return problemJson(500, "INTERNAL", "서버 내부 오류가 발생했습니다.");
  }
}
