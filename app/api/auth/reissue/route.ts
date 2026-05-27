import { reissueSingleFlight } from "@/lib/auth/single-flight";
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

  const session = await getSession();

  if (!session.refreshToken) {
    return problemJson(401, "UNAUTHORIZED", "유효한 세션이 없습니다.");
  }

  try {
    const key = session.userId ?? "anon";
    const tokens = await reissueSingleFlight(key, session.refreshToken);

    // 세션에 새 토큰 필드를 덮어쓰고 저장합니다
    session.accessToken = tokens.accessToken;
    session.refreshToken = tokens.refreshToken;
    session.accessExp = tokens.accessExp;
    await session.save();

    return Response.json({ accessExp: tokens.accessExp });
  } catch {
    await destroySession();
    return problemJson(401, "REISSUE_FAILED", "토큰 재발급에 실패했습니다. 다시 로그인하세요.");
  }
}
