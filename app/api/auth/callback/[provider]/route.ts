import { NextResponse } from "next/server";
import { getAuthPort, AuthError } from "@/lib/auth";
import { saveSession } from "@/lib/auth/session";
import { problemJson } from "@/lib/http/origin";
import {
  isProvider,
  safeRelativePath,
  STATE_COOKIE,
  NONCE_COOKIE,
  DEVICE_COOKIE,
  REDIRECT_COOKIE,
} from "@/lib/auth/oauth-config";

export const runtime = "nodejs";

/** 임시 OAuth 쿠키를 응답에서 삭제합니다 (일회성 소비). */
function clearTransientCookies(res: NextResponse): void {
  const expiredOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/api/auth",
    maxAge: 0,
  };
  res.cookies.set(STATE_COOKIE, "", expiredOptions);
  res.cookies.set(NONCE_COOKIE, "", expiredOptions);
  res.cookies.set(REDIRECT_COOKIE, "", expiredOptions);
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ provider: string }> },
): Promise<Response> {
  const { provider } = await params;

  if (!isProvider(provider)) {
    return problemJson(400, "UNSUPPORTED_PROVIDER", `지원하지 않는 OAuth 공급자입니다: ${provider}`);
  }

  const origin = new URL(req.url).origin;
  const { searchParams } = new URL(req.url);

  // 1. code + state 파라미터 확인
  const code = searchParams.get("code");
  const stateParam = searchParams.get("state");

  if (!code) {
    return problemJson(400, "MISSING_CODE", "OAuth 인가 코드가 없습니다.");
  }

  // 2. state 쿠키 검증 (CSRF 방어)
  const cookieHeader = req.headers.get("cookie") ?? "";
  const parsedCookies = Object.fromEntries(
    cookieHeader
      .split(";")
      .map((c) => c.trim())
      .filter(Boolean)
      .map((c) => {
        const idx = c.indexOf("=");
        return idx === -1
          ? [c, ""]
          : [c.slice(0, idx), decodeURIComponent(c.slice(idx + 1))];
      }),
  );

  const stateCookie = parsedCookies[STATE_COOKIE];

  if (!stateCookie || stateCookie !== stateParam) {
    return problemJson(403, "INVALID_STATE", "state 값이 일치하지 않습니다. 요청을 다시 시도해 주세요.");
  }

  // 3. 나머지 쿠키 읽기
  const nonce = parsedCookies[NONCE_COOKIE] || undefined;
  const deviceId = parsedCookies[DEVICE_COOKIE] || undefined;
  const redirectCookie = parsedCookies[REDIRECT_COOKIE] || null;

  const redirectUri = `${origin}/api/auth/callback/${provider}`;

  // 4. 백엔드 코드 교환
  try {
    const result = await getAuthPort().oauthComplete(provider, {
      code,
      redirectUri,
      deviceId,
      state: stateParam,
      nonce,
    });

    await saveSession({ tokens: result.tokens, session: result.session });

    // 5. 임시 쿠키 소비 후 목적지로 리다이렉트
    const destination = new URL(safeRelativePath(redirectCookie), origin);
    const res = NextResponse.redirect(destination, 302);
    clearTransientCookies(res);
    return res;
  } catch (err) {
    const destination = new URL("/login?error=oauth", origin);
    const res = NextResponse.redirect(destination, 302);
    clearTransientCookies(res);

    if (err instanceof AuthError) {
      // AuthError 세부 내용은 클라이언트에 노출하지 않습니다.
      // 로그는 서버 측에서만 기록합니다.
      switch (err.code) {
        case "OAUTH_FAILED":
        case "UPSTREAM_ERROR":
        case "UNAUTHORIZED":
        case "REISSUE_FAILED":
        case "INVALID_CREDENTIALS":
        case "AUTH_METHOD_UNSUPPORTED":
          return res;
        default: {
          // 타입 좁히기 완전성(exhaustiveness) 보장
          const _exhaustive: never = err.code;
          void _exhaustive;
          return res;
        }
      }
    }

    return res;
  }
}
