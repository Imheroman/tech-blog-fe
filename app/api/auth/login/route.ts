import { getAuthPort, AuthError } from "@/lib/auth";
import { saveSession } from "@/lib/auth/session";
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

  // 요청 본문 파싱
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return problemJson(400, "VALIDATION_FAILED", "요청 본문이 유효한 JSON 이 아닙니다.");
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("email" in body) ||
    !("password" in body)
  ) {
    return problemJson(400, "VALIDATION_FAILED", "email 과 password 필드가 필요합니다.");
  }

  const { email, password } = body as Record<string, unknown>;

  if (typeof email !== "string" || email.trim() === "") {
    return problemJson(400, "VALIDATION_FAILED", "email 은 비어 있을 수 없습니다.");
  }
  if (typeof password !== "string" || password.trim() === "") {
    return problemJson(400, "VALIDATION_FAILED", "password 는 비어 있을 수 없습니다.");
  }

  // 인증 시도
  try {
    const port = getAuthPort();
    const result = await port.signInWithCredentials(email, password);
    await saveSession({ tokens: result.tokens, session: result.session });
    return Response.json({ user: result.session }, { status: 200 });
  } catch (err) {
    if (err instanceof AuthError) {
      switch (err.code) {
        case "INVALID_CREDENTIALS":
          return problemJson(401, "INVALID_CREDENTIALS", "이메일 또는 비밀번호가 올바르지 않습니다.");
        case "AUTH_METHOD_UNSUPPORTED":
          return problemJson(422, "AUTH_METHOD_UNSUPPORTED", "이 인증 방식은 지원되지 않습니다.");
        default:
          return problemJson(502, "UPSTREAM_ERROR", "업스트림 인증 서버 오류가 발생했습니다.");
      }
    }
    throw err;
  }
}
