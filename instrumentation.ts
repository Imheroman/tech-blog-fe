// Next.js 16 서버 사이드 MSW 인터셉션은 undici/캐시 레이어 이슈로 신뢰도가 낮다.
// 로컬 인증은 mock 어댑터(HTTP 미경유)로 처리하므로 여기서는 onUnhandledRequest:"bypass"로
// 매칭되지 않는 요청을 그냥 통과시킨다.
export async function register(): Promise<void> {
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_API_MOCKING === "enabled"
  ) {
    const { server } = await import("./mocks/node");
    server.listen({ onUnhandledRequest: "bypass" });
  }
}
