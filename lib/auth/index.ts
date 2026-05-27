import "server-only";

import type { AuthPort } from "./port";
import { mockAuthAdapter } from "./adapters/mock";
import { monolithicAuthAdapter } from "./adapters/monolithic";

/**
 * 환경 변수 `AUTH_MODE` 에 따라 적절한 AuthPort 어댑터를 반환합니다.
 *
 * - `"mock"` (기본값): 개발/테스트용 인메모리 어댑터.
 * - `"real"`: 실제 Spring Boot 백엔드 어댑터.
 *
 * 사용 예:
 *   const auth = getAuthPort();
 *   const result = await auth.signInWithCredentials(email, password);
 */
export function getAuthPort(): AuthPort {
  const mode = process.env.AUTH_MODE ?? "mock";
  switch (mode) {
    case "mock":
      return mockAuthAdapter;
    case "real":
      return monolithicAuthAdapter;
    default:
      throw new Error(`Unsupported AUTH_MODE: ${mode}`);
  }
}

// ---------------------------------------------------------------------------
// 공개 타입 재수출 (port.ts 에 `import "server-only"` 가 없으므로 안전합니다)
// ---------------------------------------------------------------------------
export type { AuthPort, AuthResult, AuthErrorCode, OAuthCompleteParams, OAuthProvider, Role, Session, Tokens } from "./port";
export { AuthError } from "./port";
