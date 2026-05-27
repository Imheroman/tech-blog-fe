/**
 * route.ts — 게시글 좋아요 API Route Handler.
 *
 * GET  /api/posts/:slug/like  — 공개 (비인증 시 isLiked: false)
 * PUT  /api/posts/:slug/like  — 좋아요 설정 (USER 이상 필요)
 * DELETE /api/posts/:slug/like — 좋아요 해제 (USER 이상 필요)
 *
 * 멱등성: PUT/DELETE 를 반복해도 같은 상태를 반환합니다.
 */
export const runtime = "nodejs";

import { type NextRequest } from "next/server";
import { getUser, requireRole, AuthzError } from "@/lib/dal";
import { assertSameOrigin, problemJson, OriginError } from "@/lib/http/origin";
import { getLikeState, setLike, unsetLike, type LikeState } from "@/lib/api/likes";

// ---------------------------------------------------------------------------
// 타입
// ---------------------------------------------------------------------------

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// ---------------------------------------------------------------------------
// 가드 헬퍼 — 뮤테이션 메서드(PUT·DELETE) 공통 사전 검사
// ---------------------------------------------------------------------------

type GuardResult =
  | { ok: true; userId: string; slug: string }
  | { ok: false; response: Response };

async function withMutationGuards(
  req: NextRequest,
  params: Promise<{ slug: string }>,
): Promise<GuardResult> {
  // 1. CSRF Origin 검사
  try {
    assertSameOrigin(req);
  } catch (err) {
    if (err instanceof OriginError) {
      return { ok: false, response: problemJson(403, "FORBIDDEN_ORIGIN", err.message) };
    }
    throw err;
  }

  // 2. 인증·인가 검사
  let userId: string;
  try {
    const user = await requireRole("USER");
    userId = user.userId;
  } catch (err) {
    if (err instanceof AuthzError) {
      const code = err.reason === "UNAUTHENTICATED" ? "UNAUTHENTICATED" : "FORBIDDEN";
      return { ok: false, response: problemJson(err.status, code, err.message) };
    }
    throw err;
  }

  const { slug } = await params;
  return { ok: true, userId, slug };
}

// ---------------------------------------------------------------------------
// GET — 공개 (비인증 허용)
// ---------------------------------------------------------------------------

export async function GET(
  _req: NextRequest,
  { params }: RouteContext,
): Promise<Response> {
  try {
    const { slug } = await params;
    const user = await getUser();
    const state: LikeState = await getLikeState(slug, user?.userId ?? null);
    return Response.json(state);
  } catch {
    return problemJson(500, "INTERNAL", "서버 내부 오류가 발생했습니다.");
  }
}

// ---------------------------------------------------------------------------
// PUT — 좋아요 설정 (idempotent)
// ---------------------------------------------------------------------------

export async function PUT(
  req: NextRequest,
  { params }: RouteContext,
): Promise<Response> {
  try {
    const guard = await withMutationGuards(req, params);
    if (!guard.ok) return guard.response;

    const state: LikeState = await setLike(guard.slug, guard.userId);
    return Response.json(state);
  } catch {
    return problemJson(500, "INTERNAL", "서버 내부 오류가 발생했습니다.");
  }
}

// ---------------------------------------------------------------------------
// DELETE — 좋아요 해제 (idempotent)
// ---------------------------------------------------------------------------

export async function DELETE(
  req: NextRequest,
  { params }: RouteContext,
): Promise<Response> {
  try {
    const guard = await withMutationGuards(req, params);
    if (!guard.ok) return guard.response;

    const state: LikeState = await unsetLike(guard.slug, guard.userId);
    return Response.json(state);
  } catch {
    return problemJson(500, "INTERNAL", "서버 내부 오류가 발생했습니다.");
  }
}
