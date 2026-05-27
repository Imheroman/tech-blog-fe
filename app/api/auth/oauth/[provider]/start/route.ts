import { NextResponse } from "next/server";
import { problemJson } from "@/lib/http/origin";
import {
  isProvider,
  getProviderConfig,
  randomToken,
  isMockMode,
  safeRelativePath,
  STATE_COOKIE,
  NONCE_COOKIE,
  DEVICE_COOKIE,
  REDIRECT_COOKIE,
} from "@/lib/auth/oauth-config";

export const runtime = "nodejs";

// 임시 상태 쿠키 수명 — 10분
const TRANSIENT_MAX_AGE = 600;
// 디바이스 ID 쿠키 수명 — 1년
const DEVICE_MAX_AGE = 60 * 60 * 24 * 365;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ provider: string }> },
): Promise<Response> {
  const { provider } = await params;

  if (!isProvider(provider)) {
    return problemJson(400, "UNSUPPORTED_PROVIDER", `지원하지 않는 OAuth 공급자입니다: ${provider}`);
  }

  const origin = new URL(req.url).origin;
  const redirectUri = `${origin}/api/auth/callback/${provider}`;
  const isSecure = process.env.NODE_ENV === "production";

  // 공통 임시 쿠키 옵션 (state, nonce, redirect)
  const transientCookieOptions = {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax" as const,
    path: "/api/auth",
    maxAge: TRANSIENT_MAX_AGE,
  };

  // 1. state 생성
  const state = randomToken();

  // 2. 로그인 후 이동할 경로를 쿼리에서 읽어 검증
  const redirectTarget = safeRelativePath(
    new URL(req.url).searchParams.get("redirect"),
  );

  // 3. 디바이스 ID — 기존 쿠키 재사용, 없으면 신규 발급
  const existingDeviceId = req.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${DEVICE_COOKIE}=`))
    ?.split("=")[1];
  const deviceId = existingDeviceId ?? randomToken();

  // ------------------------------------------------------------------
  // Mock 단축 경로 (dev/mock 모드 전용)
  // 외부 공급자 없이 자체 콜백으로 바로 리다이렉트해 플로우를 완성합니다.
  // ------------------------------------------------------------------
  if (isMockMode()) {
    const mockCallbackUrl = new URL(`${origin}/api/auth/callback/${provider}`);
    mockCallbackUrl.searchParams.set("code", "mock-auth-code");
    mockCallbackUrl.searchParams.set("state", state);

    const res = NextResponse.redirect(mockCallbackUrl, 302);

    res.cookies.set(STATE_COOKIE, state, transientCookieOptions);
    res.cookies.set(REDIRECT_COOKIE, redirectTarget, transientCookieOptions);

    // nonce는 Google 전용이지만 mock 모드에서도 Google provider면 설정
    if (provider === "google") {
      res.cookies.set(NONCE_COOKIE, randomToken(), transientCookieOptions);
    }

    if (!existingDeviceId) {
      res.cookies.set(DEVICE_COOKIE, deviceId, {
        httpOnly: true,
        secure: isSecure,
        sameSite: "lax",
        path: "/",
        maxAge: DEVICE_MAX_AGE,
      });
    }

    return res;
  }

  // ------------------------------------------------------------------
  // Real 모드
  // ------------------------------------------------------------------
  const config = getProviderConfig(provider);

  if (!config.clientId) {
    return NextResponse.redirect(new URL("/login?error=oauth_not_configured", origin), 302);
  }

  // TODO(pkce): PKCE(code_challenge/code_verifier) 미구현 — 백엔드 지원 확인 후 v2에서 추가
  const authorizeParams = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: config.scope,
    state,
  });

  // nonce는 Google 전용 (ID 토큰 재전송 공격 방어)
  let nonce: string | undefined;
  if (provider === "google") {
    nonce = randomToken();
    authorizeParams.set("nonce", nonce);
  }

  const authorizeUrl = `${config.authorizeUrl}?${authorizeParams.toString()}`;
  const res = NextResponse.redirect(authorizeUrl, 302);

  res.cookies.set(STATE_COOKIE, state, transientCookieOptions);
  res.cookies.set(REDIRECT_COOKIE, redirectTarget, transientCookieOptions);

  if (nonce !== undefined) {
    res.cookies.set(NONCE_COOKIE, nonce, transientCookieOptions);
  }

  if (!existingDeviceId) {
    res.cookies.set(DEVICE_COOKIE, deviceId, {
      httpOnly: true,
      secure: isSecure,
      sameSite: "lax",
      path: "/",
      maxAge: DEVICE_MAX_AGE,
    });
  }

  return res;
}
