import { getAuthPort } from "@/lib/auth";
import { getSession, destroySession } from "@/lib/auth/session";
import { assertSameOrigin, problemJson, OriginError } from "@/lib/http/origin";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  // CSRF 출처 검사
  try {
    assertSameOrigin(req);
  } catch (err) {
    if (err instanceof OriginError) {
      return problemJson(403, "FORBIDDEN_ORIGIN", err.message);
    }
    throw err;
  }

  // 세션 읽기 후 best-effort 서버 측 로그아웃
  const session = await getSession();

  if (session.refreshToken) {
    try {
      await getAuthPort().signOut(session.refreshToken);
    } catch {
      // best-effort: 업스트림 실패를 무시하고 로컬 세션은 파기합니다
    }
  }

  await destroySession();

  return new Response(null, { status: 204 });
}
