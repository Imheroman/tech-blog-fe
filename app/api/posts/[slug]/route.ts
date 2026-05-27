/**
 * route.ts — 게시글 관리자 API Route Handler.
 *
 * PATCH /api/posts/:slug — 발행 상태 토글 (ADMIN 이상 필요)
 *
 * 멱등성: 현재 상태와 동일한 status 로 PATCH 해도 같은 결과를 반환합니다.
 * 이후 POST(생성) / DELETE(삭제) 핸들러가 이 파일에 추가됩니다.
 */
export const runtime = "nodejs";

import { type NextRequest } from "next/server";
import { requireRole, AuthzError } from "@/lib/dal";
import { assertSameOrigin, problemJson, OriginError } from "@/lib/http/origin";
import {
  setPostStatus,
  NotFoundError,
  type PostStatus,
} from "@/lib/api/admin-posts";

// ---------------------------------------------------------------------------
// 타입
// ---------------------------------------------------------------------------

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// ---------------------------------------------------------------------------
// PATCH — 발행 상태 변경 (idempotent)
// ---------------------------------------------------------------------------

export async function PATCH(
  req: NextRequest,
  { params }: RouteContext,
): Promise<Response> {
  // 1. CSRF Origin 검사
  try {
    assertSameOrigin(req);
  } catch (err) {
    if (err instanceof OriginError) {
      return problemJson(403, "FORBIDDEN_ORIGIN", err.message);
    }
    throw err;
  }

  // 2. 인가 검사 — ADMIN 이상 필요 (USER 는 403)
  try {
    await requireRole("ADMIN");
  } catch (err) {
    if (err instanceof AuthzError) {
      const code =
        err.reason === "UNAUTHENTICATED" ? "UNAUTHENTICATED" : "FORBIDDEN";
      return problemJson(err.status, code, err.message);
    }
    throw err;
  }

  // 3. 요청 바디 파싱 + 입력 검증
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return problemJson(400, "VALIDATION_FAILED", "요청 바디가 유효한 JSON 이 아닙니다.");
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("status" in body) ||
    ((body as Record<string, unknown>)["status"] !== "draft" &&
      (body as Record<string, unknown>)["status"] !== "published")
  ) {
    return problemJson(400, "VALIDATION_FAILED", "status must be draft|published");
  }

  const status = (body as Record<string, unknown>)["status"] as PostStatus;

  // 4. 비즈니스 로직
  try {
    const { slug } = await params;
    const result = await setPostStatus(slug, status);
    return Response.json(result);
  } catch (err) {
    if (err instanceof NotFoundError) {
      return problemJson(404, "POST_NOT_FOUND", err.message);
    }
    return problemJson(500, "INTERNAL", "서버 내부 오류가 발생했습니다.");
  }
}
