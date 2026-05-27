"use client";

/**
 * LoginForm — 이메일/비밀번호 로그인 폼.
 */

import { useActionState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { OAuthButtons } from "@/components/auth/oauth-buttons";

// ---------------------------------------------------------------------------
// 액션 상태 타입
// ---------------------------------------------------------------------------

interface LoginState {
  ok: boolean;
  error: string | null;
}

const INITIAL_STATE: LoginState = { ok: false, error: null };

// ---------------------------------------------------------------------------
// 컴포넌트
// ---------------------------------------------------------------------------

export function LoginForm(): React.ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [state, dispatch, isPending] = useActionState(
    async (_prev: LoginState, formData: FormData): Promise<LoginState> => {
      const email = formData.get("email");
      const password = formData.get("password");

      if (typeof email !== "string" || typeof password !== "string") {
        return { ok: false, error: "입력값이 올바르지 않습니다." };
      }

      let res: Response;
      try {
        res = await fetch("/api/auth/login", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
      } catch {
        return { ok: false, error: "네트워크 오류가 발생했습니다. 잠시 후 다시 시도하세요." };
      }

      if (!res.ok) {
        let detail = "로그인에 실패했습니다.";
        try {
          const json = (await res.json()) as Record<string, unknown>;
          if (typeof json["detail"] === "string") {
            detail = json["detail"];
          }
        } catch {
          // 응답 파싱 실패 시 기본 메시지 사용
        }
        return { ok: false, error: detail };
      }

      // 로그인 성공: redirect 쿼리 파라미터가 있으면 해당 경로로, 없으면 홈으로 이동
      const redirectTo = searchParams.get("redirect") ?? "/";
      router.push(redirectTo);
      router.refresh();

      return { ok: true, error: null };
    },
    INITIAL_STATE,
  );

  return (
    <form action={dispatch} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="email">이메일</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          disabled={isPending}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">비밀번호</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="비밀번호"
          disabled={isPending}
          required
        />
      </div>

      {state.error !== null && (
        <p role="alert" aria-live="polite" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "로그인 중..." : "로그인"}
      </Button>

      <div className="relative my-2 flex items-center">
        <div className="flex-1 border-t border-border" />
        <span className="mx-3 text-xs text-muted-foreground">또는</span>
        <div className="flex-1 border-t border-border" />
      </div>

      <OAuthButtons />
    </form>
  );
}
