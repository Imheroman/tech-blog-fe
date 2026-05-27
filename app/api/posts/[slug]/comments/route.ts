/**
 * route.ts — 게시글 댓글 API Route Handler.
 *
 * GET  /api/posts/:slug/comments  — 루트 댓글 목록 (공개, 페이지네이션)
 * POST /api/posts/:slug/comments  — 댓글 생성 (USER 이상 필요)
 */
export const runtime = "nodejs";

import { type NextRequest } from "next/server";
import { requireRole, getUser, AuthzError } from "@/lib/dal";
import { assertSameOrigin, problemJson, OriginError } from "@/lib/http/origin";
import {
  listComments,
  createComment,
  ValidationError,
} from "@/lib/api/comments";

// ---------------------------------------------------------------------------
// 타입
// ---------------------------------------------------------------------------

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// ---------------------------------------------------------------------------
// GET — 공개 (인증 불필요)
// ---------------------------------------------------------------------------

export async function GET(
  req: NextRequest,
  { params }: RouteContext,
): Promise<Response> {
  try {
    const { slug } = await params;
    const url = new URL(req.url);

    const pageRaw = url.searchParams.get("page") ?? "0";
    const sizeRaw = url.searchParams.get("size") ?? "10";
    const sort = url.searchParams.get("sort") ?? "createdAt,desc";

    const page = Math.max(0, parseInt(pageRaw, 10) || 0);
    const size = parseInt(sizeRaw, 10) || 10;

    // size 범위 검증: 1–50
    if (size < 1 || size > 50) {
      return problemJson(
        400,
        "VALIDATION_FAILED",
        "size 는 1 이상 50 이하여야 합니다.",
      );
    }

    const envelope = await listComments(slug, { page, size, sort });
    return Response.json(envelope);
  } catch {
    return problemJson(500, "INTERNAL", "서버 내부 오류가 발생했습니다.");
  }
}

// ---------------------------------------------------------------------------
// POST — 댓글 생성 (USER 이상)
// ---------------------------------------------------------------------------

export async function POST(
  req: NextRequest,
  { params }: RouteContext,
): Promise<Response> {
  try {
    // 1. CSRF Origin 검사
    assertSameOrigin(req);

    // 2. 인증·인가 검사
    const { userId, role: _role } = await requireRole("USER");

    // 3. slug 파싱
    const { slug } = await params;

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

    // 5. author.name 처리:
    //    getUser()는 userId/role 만 반환합니다.
    //    Mock 모드에서는 `사용자-${userId.slice(0,6)}` 형태로 표시 이름을 생성하고,
    //    Real 모드에서는 백엔드가 세션에서 author 를 채우므로 name 전달값이 무시됩니다.
    const user = await getUser();
    const displayName = user
      ? `사용자-${user.userId.slice(0, 6)}`
      : `사용자-${userId.slice(0, 6)}`;

    const comment = await createComment(slug, { userId, name: displayName }, content);
    return Response.json(comment, { status: 201 });
  } catch (err) {
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
    return problemJson(500, "INTERNAL", "서버 내부 오류가 발생했습니다.");
  }
}
