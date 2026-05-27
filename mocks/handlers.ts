import { http, HttpResponse } from "msw";

interface LoginRequestBody {
  email: string;
  password: string;
}

type OAuthCallbackParams = {
  provider: string;
};

export const handlers = [
  // 로그인
  http.post("*/api/v1/auth/login", async ({ request }) => {
    const body = (await request.json()) as LoginRequestBody;
    return HttpResponse.json({
      user: {
        id: 1,
        name: body.email?.split("@")[0] ?? "dev-user",
        role: "USER" as const,
      },
    });
  }),

  // 로그아웃
  http.post("*/api/v1/auth/logout", () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // 토큰 재발급
  http.post("*/api/v1/auth/reissue", () => {
    return HttpResponse.json({
      accessExp: Date.now() + 1000 * 60 * 30,
    });
  }),

  // 내 정보 조회
  http.get("*/api/v1/auth/me", () => {
    return HttpResponse.json({
      id: 1,
      name: "dev-user",
      role: "USER" as const,
    });
  }),

  // OAuth 콜백
  http.post<OAuthCallbackParams>("*/api/v1/auth/oauth/:provider/callback", ({ params }) => {
    const { provider } = params;
    return HttpResponse.json({
      user: {
        id: 1,
        name: `${provider}-user`,
        role: "USER" as const,
      },
      isNewUser: false,
    });
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
      isLikedByMe: false,
    });
  }),

  // 게시글 좋아요 추가
  http.put("*/api/v1/posts/:slug/like", () => {
    return HttpResponse.json({
      likeCount: 1,
      isLikedByMe: true,
    });
  }),

  // 게시글 좋아요 취소
  http.delete("*/api/v1/posts/:slug/like", () => {
    return HttpResponse.json({
      likeCount: 0,
      isLikedByMe: false,
    });
  }),
];
