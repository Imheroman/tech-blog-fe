import "server-only";

// ---------------------------------------------------------------------------
// 단일 비행(Single-Flight) 토큰 재발급
// ---------------------------------------------------------------------------
//
// 주의: 이 맵은 단일 Node.js 프로세스 메모리에 저장됩니다.
// 멀티 인스턴스(수평 확장) 배포 환경에서는 인스턴스 간 중복 재발급을 막을 수 없으므로
// Redis 분산 락(예: Redlock)으로 교체해야 합니다.

import { getAuthPort } from "./index";
import type { Tokens } from "./port";

const inflight = new Map<string, Promise<Tokens>>();

/**
 * 동일한 `key`(예: userId)에 대한 동시 재발급 요청을 하나의 업스트림 호출로 합산합니다.
 *
 * - 진행 중인 요청이 있으면 동일한 Promise 를 반환합니다(업스트림 1회 호출).
 * - 성공/실패 모두 정산 후 맵에서 항목을 제거합니다.
 *   → 실패한 요청은 각 대기자에게 동일한 오류를 전달하고,
 *     항목이 제거되므로 이후 재시도는 새 업스트림 호출로 실행됩니다.
 */
export function reissueSingleFlight(key: string, refreshToken: string): Promise<Tokens> {
  const existing = inflight.get(key);
  if (existing) return existing;

  const p = getAuthPort()
    .reissue(refreshToken)
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, p);
  return p;
}

/**
 * 인플라이트 맵을 초기화합니다.
 * 테스트 또는 유지보수 목적으로만 사용하세요.
 */
export function _clearInflight(): void {
  inflight.clear();
}
