import "server-only";

import { getIronSession, sealData, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import type { Role, Session, Tokens } from "./port";

// ---------------------------------------------------------------------------
// 세션 데이터 타입
// ---------------------------------------------------------------------------

export interface SessionData {
  accessToken?: string;
  refreshToken?: string;
  /** 액세스 토큰 만료 시각 (epoch 초). */
  accessExp?: number;
  userId?: string;
  role?: Role;
}

// ---------------------------------------------------------------------------
// 쿠키 최대 수명
// ---------------------------------------------------------------------------

/**
 * 세션 쿠키 유효 기간(초) — 7일.
 * TODO: upstream 리프레시 토큰 Max-Age 이하로 맞춰야 함. 백엔드 확인 후 정렬 필요.
 */
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

// ---------------------------------------------------------------------------
// 환경 변수 검증
// ---------------------------------------------------------------------------

const DEV_FALLBACK_PASSWORD = "dev-only-fallback-password-min32ch!!";

let _warnedOnce = false;

function getSessionPassword(): string {
  const raw = process.env.SESSION_PASSWORD;

  if (!raw || raw.length < 32) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "SESSION_PASSWORD 환경 변수가 설정되지 않았거나 32자 미만입니다. " +
          "프로덕션 배포 전 반드시 32자 이상의 임의 문자열로 설정하세요.",
      );
    }

    if (!_warnedOnce) {
      console.warn(
        "[auth/session] SESSION_PASSWORD 가 설정되지 않았습니다. " +
          "개발 전용 폴백 비밀번호를 사용합니다. 프로덕션에서는 반드시 환경 변수를 설정하세요.",
      );
      _warnedOnce = true;
    }

    return DEV_FALLBACK_PASSWORD;
  }

  return raw;
}

// ---------------------------------------------------------------------------
// iron-session 옵션
// ---------------------------------------------------------------------------

/**
 * 세션 옵션을 지연 생성합니다.
 * 비밀번호 검증(getSessionPassword)을 모듈 로드 시점이 아니라 **요청 시점**에 수행해야
 * `next build`(NODE_ENV=production) 중 SESSION_PASSWORD 미설정으로 빌드가 깨지지 않습니다.
 */
function getSessionOptions(): SessionOptions {
  return {
    password: getSessionPassword(),
    cookieName: "blog_session",
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    },
  };
}

// ---------------------------------------------------------------------------
// 쿠키 크기 예산
// ---------------------------------------------------------------------------

const SESSION_COOKIE_SIZE_LIMIT = 3584; // 3.5 KB

/**
 * iron-session 이 봉인(seal)한 뒤의 쿠키 값 바이트 수를 반환합니다.
 * 3.5 KB를 초과하면 서버 사이드 세션 스토어로 이전을 검토해야 합니다.
 */
export async function sealedSizeBytes(data: SessionData): Promise<number> {
  const sealed = await sealData(data, { password: getSessionPassword() });
  return Buffer.byteLength(sealed, "utf8");
}

// ---------------------------------------------------------------------------
// 세션 헬퍼
// ---------------------------------------------------------------------------

/**
 * iron-session 객체를 반환합니다.
 *
 * 읽기는 어디서나 가능하지만 `.save()` / `.destroy()` 는
 * Route Handler 또는 Server Action 에서만 호출하세요.
 */
export async function getSession(): Promise<ReturnType<typeof getIronSession<SessionData>>> {
  return getIronSession<SessionData>(await cookies(), getSessionOptions());
}

/**
 * 도메인 Tokens + Session 으로 iron-session 을 저장합니다.
 * Route Handler / Server Action 전용.
 */
export async function saveSession(data: { tokens: Tokens; session: Session }): Promise<void> {
  const { tokens, session } = data;

  const payload: SessionData = {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    accessExp: tokens.accessExp,
    userId: session.userId,
    role: session.role,
  };

  const size = await sealedSizeBytes(payload);
  if (size > SESSION_COOKIE_SIZE_LIMIT) {
    // TODO(redis): payload exceeds cookie budget → move to server-side session store (session id in cookie)
    console.warn(
      `[auth/session] 봉인된 세션 크기(${size} bytes)가 쿠키 예산(${SESSION_COOKIE_SIZE_LIMIT} bytes)을 초과했습니다.`,
    );
  }

  const ironSession = await getSession();
  ironSession.accessToken = payload.accessToken;
  ironSession.refreshToken = payload.refreshToken;
  ironSession.accessExp = payload.accessExp;
  ironSession.userId = payload.userId;
  ironSession.role = payload.role;
  await ironSession.save();
}

/**
 * 현재 세션을 파기합니다.
 * Route Handler / Server Action 전용.
 */
export async function destroySession(): Promise<void> {
  const ironSession = await getSession();
  ironSession.destroy();
}

/**
 * RSC 전용 읽기 전용 헬퍼.
 * 세션에 userId 가 있으면 `{ userId, role }` 을 반환하고, 없으면 null 을 반환합니다.
 * 이 함수는 세션을 쓰거나 저장하지 않습니다.
 */
export async function getCurrentUser(): Promise<{ userId: string; role: Role } | null> {
  const ironSession = await getSession();
  if (!ironSession.userId) {
    return null;
  }
  return {
    userId: ironSession.userId,
    role: ironSession.role ?? "USER",
  };
}
