/**
 * route.ts — 댓글 답글 API Route Handler.
 *
 * GET  /api/comments/:id/replies  — 답글 목록 (공개, 페이지네이션)
 * POST /api/comments/:id/replies  — 답글 생성 (USER 이상 필요)
 *
 * 1-level 보장: id 가 이미 답글이면 createReply 내부에서 부모로 플래튼합니다.
 */
export const runtime = "nodejs";

import { type NextRequest } from "next/server";
import { requireRole, getUser, AuthzError } from "@/lib/dal";
import { assertSameOrigin, problemJson, OriginError } from "@/lib/http/origin";
import {
  listReplies,
  createReply,
  ValidationError,
  NotFoundError,
} from "@/lib/api/comments";

// ---------------------------------------------------------------------------
// 타입
// ---------------------------------------------------------------------------

interface RouteContext {
  params: Promise<{ id: string }>;
}

// ---------------------------------------------------------------------------
// GET — 공개 (인증 불필요)
// ---------------------------------------------------------------------------

export async function GET(
  req: NextRequest,
  { params }: RouteContext,
): Promise<Response> {
  try {
    const { id } = await params;
    const url = new URL(req.url);

    const pageRaw = url.searchParams.get("page") ?? "0";
    const sizeRaw = url.searchParams.get("size") ?? "10";

    const page = Math.max(0, parseInt(pageRaw, 10) || 0);
    const size = parseInt(sizeRaw, 10) || 10;

    if (size < 1 || size > 50) {
      return problemJson(
        400,
        "VALIDATION_FAILED",
        "size 는 1 이상 50 이하여야 합니다.",
      );
    }

    const envelope = await listReplies(id, { page, size });
    return Response.json(envelope);
  } catch {
    return problemJson(500, "INTERNAL", "서버 내부 오류가 발생했습니다.");
  }
}

// ---------------------------------------------------------------------------
// POST — 답글 생성 (USER 이상)
// ---------------------------------------------------------------------------

export async function POST(
  req: NextRequest,
  { params }: RouteContext,
): Promise<Response> {
  try {
    // 1. CSRF Origin 검사
    assertSameOrigin(req);

    // 2. 인증·인가 검사
    const { userId } = await requireRole("USER");

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

    // 5. author.name: getUser() 는 userId/role 만 반환 → 표시 이름 파생
    const user = await getUser();
    const displayName = user
      ? `사용자-${user.userId.slice(0, 6)}`
      : `사용자-${userId.slice(0, 6)}`;

    const reply = await createReply(id, { userId, name: displayName }, content);
    return Response.json(reply, { status: 201 });
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
    if (err instanceof NotFoundError) {
      return problemJson(404, err.code, err.message);
    }
    return problemJson(500, "INTERNAL", "서버 내부 오류가 발생했습니다.");
  }
}
