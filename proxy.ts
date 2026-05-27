/**
 * proxy.ts — Next.js 16 미들웨어 대체 (Node 런타임).
 *
 * ⚠️ 보안 경계가 아닙니다 ⚠️
 * 이 파일은 세션 쿠키의 **존재 여부만** 확인합니다(유효성 검증 없음).
 * 실제 인가(authz)는 백엔드 API 서버와 `lib/dal.ts` 에서 수행합니다.
 * 쿠키가 있어도 서버 측에서 유효하지 않은 세션일 수 있습니다.
 * 이 로직은 UX 목적의 낙관적 리다이렉트에만 사용하세요.
 */

import { NextResponse, type NextRequest } from "next/server";

export function proxy(req: NextRequest): NextResponse {
  const hasSession = req.cookies.has("blog_session");

  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = { matcher: ["/admin/:path*"] };
