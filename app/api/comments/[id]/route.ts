/**
 * route.ts — 개별 댓글 API Route Handler.
 *
 * PATCH  /api/comments/:id  — 댓글/답글 수정 (작성자만)
 * DELETE /api/comments/:id  — 댓글/답글 소프트 삭제 (작성자 또는 ADMIN+)
 */
export const runtime = "nodejs";

import { type NextRequest } from "next/server";
import { requireRole, AuthzError } from "@/lib/dal";
import { assertSameOrigin, problemJson, OriginError } from "@/lib/http/origin";
import {
  updateComment,
  softDeleteComment,
  ValidationError,
  NotFoundError,
  ForbiddenError,
} from "@/lib/api/comments";

// ---------------------------------------------------------------------------
// 타입
// ---------------------------------------------------------------------------

interface RouteContext {
  params: Promise<{ id: string }>;
}

// ---------------------------------------------------------------------------
// 공통 에러 매핑 헬퍼
// ---------------------------------------------------------------------------

function mapCommentError(err: unknown): Response {
  if (err instanceof OriginError) {
    return problemJson(403, "FORBIDDEN_ORIGIN", err.message);
  }
  if (err instanceof AuthzError) {
    const code = err.reason === "UNAUTHENTICATED" ? "UNAUTHENTICATED" : "FORBIDDEN";
    return problemJson(err.status, code, err.message);
  }
  if (err instanceof ValidationError) {
    return problemJson(400, err.code, err.message);
  }
  if (err instanceof NotFoundError) {
    return problemJson(404, err.code, err.message);
  }
  if (err instanceof ForbiddenError) {
    return problemJson(403, err.code, err.message);
  }
  return problemJson(500, "INTERNAL", "서버 내부 오류가 발생했습니다.");
}

// ---------------------------------------------------------------------------
// PATCH — 댓글 수정 (작성자만)
// ---------------------------------------------------------------------------

export async function PATCH(
  req: NextRequest,
  { params }: RouteContext,
): Promise<Response> {
  try {
    // 1. CSRF Origin 검사
    assertSameOrigin(req);

    // 2. 인증·인가 검사
    const { userId, role } = await requireRole("USER");

    // 3. id 파싱
    const { id } = await params;

    // 4. 요청 바디 파싱
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return problemJson(400, "VALIDATION_FAILED", "요청 본문이 올바른 JSON 이 아닙니다.");
    }

    if (typeof body !== "object" || body === null) {
      return problemJson(400, "VALIDATION_FAILED", "요청 본문이 객체여야 합니다.");
    }

    const { content } = body as Record<string, unknown>;
    if (typeof content !== "string") {
      return problemJson(400, "VALIDATION_FAILED", "content 필드가 필요합니다.");
    }

    // 5. 수정 실행
    const comment = await updateComment(id, { userId, role }, content);
    return Response.json(comment);
  } catch (err) {
    return mapCommentError(err);
  }
}

// ---------------------------------------------------------------------------
// DELETE — 소프트 삭제 (작성자 또는 ADMIN+), 멱등
// ---------------------------------------------------------------------------

export async function DELETE(
  req: NextRequest,
  { params }: RouteContext,
): Promise<Response> {
  try {
    // 1. CSRF Origin 검사
    assertSameOrigin(req);

    // 2. 인증·인가 검사
    const { userId, role } = await requireRole("USER");

    // 3. id 파싱
    const { id } = await params;

    // 4. 소프트 삭제 실행
    const tombstone = await softDeleteComment(id, { userId, role });

    // tombstone 을 200 으로 반환 (이미 삭제된 경우 포함 — 멱등)
    return Response.json(tombstone);
  } catch (err) {
    return mapCommentError(err);
  }
}
