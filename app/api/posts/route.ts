/**
 * route.ts — 게시글 컬렉션 관리자 API Route Handler.
 *
 * POST /api/posts — 게시글 생성 (ADMIN 이상 필요)
 */
export const runtime = "nodejs";

import { type NextRequest } from "next/server";
import { requireRole, AuthzError } from "@/lib/dal";
import { assertSameOrigin, problemJson, OriginError } from "@/lib/http/origin";
import {
  createPost,
  ConflictError,
  NotFoundError,
  type PostInput,
  type PostStatus,
} from "@/lib/api/admin-posts";

// ---------------------------------------------------------------------------
// 내부 유틸 — PostInput 런타임 검증
// ---------------------------------------------------------------------------

interface ValidationResult {
  ok: true;
  input: PostInput;
}

interface ValidationError {
  ok: false;
  field: string;
  message: string;
}

/**
 * unknown 바디에서 PostInput 을 검증합니다.
 * 누락·잘못된 타입·빈 문자열 모두 에러로 처리합니다.
 */
function validatePostInput(
  body: unknown,
): ValidationResult | ValidationError {
  if (typeof body !== "object" || body === null) {
    return { ok: false, field: "body", message: "요청 바디가 객체여야 합니다." };
  }

  const b = body as Record<string, unknown>;

  const stringFields = [
    "title",
    "excerpt",
    "content",
    "category",
    "thumbnail",
  ] as const;

  for (const field of stringFields) {
    const value = b[field];
    if (typeof value !== "string" || value.trim().length === 0) {
      return {
        ok: false,
        field,
        message: `${field} 는 비어 있지 않은 문자열이어야 합니다.`,
      };
    }
  }

  const status = b["status"];
  if (status !== "draft" && status !== "published") {
    return {
      ok: false,
      field: "status",
      message: "status 는 draft 또는 published 이어야 합니다.",
    };
  }

  return {
    ok: true,
    input: {
      title: (b["title"] as string).trim(),
      excerpt: (b["excerpt"] as string).trim(),
      content: (b["content"] as string).trim(),
      category: (b["category"] as string).trim(),
      thumbnail: (b["thumbnail"] as string).trim(),
      status: status as PostStatus,
    },
  };
}

// ---------------------------------------------------------------------------
// POST — 게시글 생성
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<Response> {
  // 1. CSRF Origin 검사
  try {
    assertSameOrigin(req);
  } catch (err) {
    if (err instanceof OriginError) {
      return problemJson(403, "FORBIDDEN_ORIGIN", err.message);
    }
    throw err;
  }

  // 2. 인가 검사 — ADMIN 이상 필요
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

  // 3. 요청 바디 파싱
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return problemJson(400, "VALIDATION_FAILED", "요청 바디가 유효한 JSON 이 아닙니다.");
  }

  // 4. 입력 검증
  const validation = validatePostInput(body);
  if (!validation.ok) {
    return problemJson(
      400,
      "VALIDATION_FAILED",
      `${validation.field}: ${validation.message}`,
    );
  }

  // 5. 비즈니스 로직
  try {
    const post = await createPost(validation.input);
    return Response.json(post, {
      status: 201,
      headers: { Location: `/posts/${post.slug}` },
    });
  } catch (err) {
    if (err instanceof ConflictError) {
      return problemJson(409, "SLUG_CONFLICT", err.message);
    }
    if (err instanceof NotFoundError) {
      return problemJson(404, "POST_NOT_FOUND", err.message);
    }
    return problemJson(500, "INTERNAL", "서버 내부 오류가 발생했습니다.");
  }
}
