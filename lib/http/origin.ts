/**
 * origin.ts — CSRF Origin 검사 헬퍼.
 *
 * 상태를 변경하는 Route Handler 에서 호출하세요.
 * 동일 출처 요청만 허용하고, 출처가 다르면 OriginError 를 throw 합니다.
 */

// ---------------------------------------------------------------------------
// 에러 타입
// ---------------------------------------------------------------------------

export class OriginError extends Error {
  readonly code = "FORBIDDEN_ORIGIN" as const;

  constructor(message?: string) {
    super(message ?? "Origin mismatch: cross-origin request rejected");
    this.name = "OriginError";
  }
}

// ---------------------------------------------------------------------------
// Origin 검사
// ---------------------------------------------------------------------------

/**
 * 요청이 동일 출처에서 왔는지 확인합니다.
 *
 * 허용 조건(둘 중 하나면 통과):
 * 1. `Origin` 헤더가 요청 URL 의 origin 과 일치.
 * 2. `Origin` 헤더가 없고 `Sec-Fetch-Site` 가 `"same-origin"` 또는 `"none"`.
 *
 * @throws OriginError — 출처가 다르거나 검증에 실패한 경우
 */
export function assertSameOrigin(req: Request): void {
  const originHeader = req.headers.get("Origin");
  const secFetchSite = req.headers.get("Sec-Fetch-Site");

  if (originHeader === null) {
    // Origin 헤더가 없을 때: Sec-Fetch-Site 로 보조 검사
    if (secFetchSite === "same-origin" || secFetchSite === "none") {
      return;
    }
    // Sec-Fetch-Site 도 없거나 다른 값이면 거부
    throw new OriginError(
      `Origin header absent and Sec-Fetch-Site is "${secFetchSite ?? "absent"}"`,
    );
  }

  // Origin 헤더가 있으면 요청 URL 의 origin 과 비교
  let requestOrigin: string;
  try {
    requestOrigin = new URL(req.url).origin;
  } catch {
    throw new OriginError(`Could not parse request URL: ${req.url}`);
  }

  if (originHeader !== requestOrigin) {
    throw new OriginError(
      `Origin "${originHeader}" does not match request origin "${requestOrigin}"`,
    );
  }
}

// ---------------------------------------------------------------------------
// Problem JSON 응답 헬퍼
// ---------------------------------------------------------------------------

/**
 * RFC 7807 Problem JSON 형식의 응답을 생성합니다.
 *
 * @param status  HTTP 상태 코드
 * @param code    애플리케이션 에러 코드 (예: "VALIDATION_FAILED")
 * @param detail  사람이 읽기 위한 에러 설명
 */
export function problemJson(
  status: number,
  code: string,
  detail: string,
): Response {
  const title = codeToTitle(code);
  const body = JSON.stringify({
    type: "about:blank",
    title,
    status,
    detail,
    code,
  });
  return new Response(body, {
    status,
    headers: { "Content-Type": "application/problem+json" },
  });
}

// ---------------------------------------------------------------------------
// 내부 유틸
// ---------------------------------------------------------------------------

/** 에러 코드를 사람이 읽을 수 있는 타이틀로 변환합니다. */
function codeToTitle(code: string): string {
  return code
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}
