import { http, HttpResponse } from "msw";

/**
 * 상위 Spring `/api/v1/*` 계약을 모사하는 MSW 핸들러.
 *
 * 응답 형태는 실제 데이터 계약(`lib/auth/port.ts`·`lib/api/*` 타입)과 일치시킨다:
 *   - 인증 엔드포인트(login/reissue/oauth)는 토큰을 반환(사용자 정보는 `/me`에서 조회).
 *   - `/me`는 `{ id, nickname, role }`.
 *   - 좋아요 상태는 `{ likeCount, isLiked }`.
 */

/** 개발용 가짜 토큰 쌍을 생성합니다. accessExp 는 epoch 초. */
function mockTokens() {
  return {
    accessToken: "mock-access-token",
    refreshToken: "mock-refresh-token",
    accessExp: Math.floor(Date.now() / 1000) + 60 * 30,
  };
}

export const handlers = [
  // 로그인 — 상위 계약: 토큰 반환(사용자 정보는 /me)
  http.post("*/api/v1/auth/login", () => {
    return HttpResponse.json(mockTokens());
  }),

  // 로그아웃
  http.post("*/api/v1/auth/logout", () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // 토큰 재발급 — 새 토큰 쌍 반환
  http.post("*/api/v1/auth/reissue", () => {
    return HttpResponse.json(mockTokens());
  }),

  // 내 정보 조회 — { id, nickname, role }
  http.get("*/api/v1/auth/me", () => {
    return HttpResponse.json({
      id: "user-1",
      nickname: "dev-user",
      role: "USER" as const,
    });
  }),

  // OAuth 콜백(코드 교환) — 상위 계약: 토큰 반환
  http.post("*/api/v1/auth/oauth/:provider/callback", () => {
    return HttpResponse.json(mockTokens());
  }),

  // 게시글 목록 조회
  http.get("*/api/v1/posts", () => {
    return HttpResponse.json({
      data: [],
      page: 0,
      size: 4,
      totalElements: 0,
      totalPages: 0,
      hasNext: false,
      sort: "publishedAt,desc",
    });
  }),

  // 게시글 좋아요 조회
  http.get("*/api/v1/posts/:slug/like", () => {
    return HttpResponse.json({
      likeCount: 0,
      isLiked: false,
    });
  }),

  // 게시글 좋아요 추가
  http.put("*/api/v1/posts/:slug/like", () => {
    return HttpResponse.json({
      likeCount: 1,
      isLiked: true,
    });
  }),

  // 게시글 좋아요 취소
  http.delete("*/api/v1/posts/:slug/like", () => {
    return HttpResponse.json({
      likeCount: 0,
      isLiked: false,
    });
  }),
];
