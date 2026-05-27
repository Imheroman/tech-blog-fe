/**
 * port.ts — 인증 포트(추상 인터페이스) + 공유 타입 정의.
 *
 * 의도적으로 `import "server-only"` 를 추가하지 않습니다.
 * Session / Role / Tokens 등 타입이 클라이언트 코드(타입 전용 import)에서도
 * 사용될 수 있도록 순수 타입/인터페이스 파일로 유지합니다.
 */

// ---------------------------------------------------------------------------
// 도메인 타입
// ---------------------------------------------------------------------------

export type Role = "USER" | "ADMIN" | "SUPER_ADMIN";

export type OAuthProvider = "google" | "kakao";

/** 세션 페이로드 — 서버 세션 스토어에 저장되는 최소 단위. */
export interface Session {
  userId: string;
  role: Role;
  nickname: string;
}

/** 토큰 쌍. accessExp 는 Unix epoch 초(seconds). */
export interface Tokens {
  accessToken: string;
  refreshToken: string;
  /** 액세스 토큰 만료 시각 (epoch 초). */
  accessExp: number;
}

/** 인증 성공 결과. */
export interface AuthResult {
  session: Session;
  tokens: Tokens;
}

// ---------------------------------------------------------------------------
// 에러
// ---------------------------------------------------------------------------

export type AuthErrorCode =
  | "AUTH_METHOD_UNSUPPORTED"
  | "INVALID_CREDENTIALS"
  | "REISSUE_FAILED"
  | "OAUTH_FAILED"
  | "UPSTREAM_ERROR"
  | "UNAUTHORIZED";

export class AuthError extends Error {
  readonly code: AuthErrorCode;

  constructor(code: AuthErrorCode, message?: string) {
    super(message ?? code);
    this.name = "AuthError";
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// OAuth 파라미터
// ---------------------------------------------------------------------------

export interface OAuthCompleteParams {
  code: string;
  redirectUri: string;
  deviceId?: string;
  state?: string;
  nonce?: string;
}

// ---------------------------------------------------------------------------
// AuthPort 인터페이스
// ---------------------------------------------------------------------------

/**
 * 인증 포트(Port) — 어댑터가 구현해야 하는 계약.
 *
 * 어댑터는 상태를 보유하지 않으며, 토큰이 필요한 메서드는 호출자로부터 직접 받습니다.
 * 세션 스토어(iron-session 등)는 이 모듈 외부에서 관리됩니다.
 */
export interface AuthPort {
  /** 이메일/비밀번호 로그인 지원 여부. */
  readonly supportsCredentials: boolean;

  /**
   * 이메일/비밀번호로 로그인.
   * 미지원 어댑터는 `AuthError("AUTH_METHOD_UNSUPPORTED")` 를 throw 합니다.
   */
  signInWithCredentials(email: string, password: string): Promise<AuthResult>;

  /**
   * OAuth 인가 URL 을 생성해 반환합니다.
   * 브라우저 리다이렉트 대상 URL 문자열을 반환합니다.
   */
  oauthAuthorizeUrl(
    provider: OAuthProvider,
    params: {
      state: string;
      redirectUri: string;
      nonce?: string;
      codeChallenge?: string;
    },
  ): Promise<string>;

  /**
   * OAuth 콜백 코드를 교환해 인증을 완료합니다.
   */
  oauthComplete(provider: OAuthProvider, params: OAuthCompleteParams): Promise<AuthResult>;

  /**
   * 리프레시 토큰으로 토큰을 재발급합니다.
   * 실패 시 `AuthError("REISSUE_FAILED")` 를 throw 합니다.
   */
  reissue(refreshToken: string): Promise<Tokens>;

  /**
   * 로그아웃. 서버 측 세션 무효화를 시도합니다(best-effort).
   */
  signOut(refreshToken?: string): Promise<void>;

  /**
   * 액세스 토큰으로 현재 사용자 세션 정보를 조회합니다.
   * 토큰이 없거나 유효하지 않으면 `AuthError("UNAUTHORIZED")` 를 throw 합니다.
   */
  getUser(accessToken: string): Promise<Session>;
}
