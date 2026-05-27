"use client";

import { useSearchParams } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// 인라인 SVG 브랜드 글리프
// ---------------------------------------------------------------------------

function GoogleIcon(): React.ReactElement {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="currentColor"
        opacity=".54"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="currentColor"
        opacity=".54"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="currentColor"
        opacity=".54"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="currentColor"
        opacity=".54"
      />
    </svg>
  );
}

function KakaoIcon(): React.ReactElement {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M12 3C6.477 3 2 6.477 2 10.8c0 2.717 1.67 5.1 4.2 6.54l-1.07 3.98a.3.3 0 0 0 .46.32l4.63-3.06A11.6 11.6 0 0 0 12 18.6c5.523 0 10-3.477 10-7.8C22 6.477 17.523 3 12 3z"
        fill="currentColor"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// 타입
// ---------------------------------------------------------------------------

type Provider = "google" | "kakao";

interface ProviderConfig {
  id: Provider;
  label: string;
  Icon: () => React.ReactElement;
}

const PROVIDERS: ProviderConfig[] = [
  { id: "google", label: "Google로 계속하기", Icon: GoogleIcon },
  { id: "kakao", label: "Kakao로 계속하기", Icon: KakaoIcon },
];

// ---------------------------------------------------------------------------
// 컴포넌트
// ---------------------------------------------------------------------------

export function OAuthButtons(): React.ReactElement {
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect");

  return (
    <div className="flex flex-col gap-3">
      {PROVIDERS.map(({ id, label, Icon }) => {
        const href =
          `/api/auth/oauth/${id}/start` +
          (redirect ? `?redirect=${encodeURIComponent(redirect)}` : "");

        return (
          <a
            key={id}
            href={href}
            aria-label={label}
            className={cn(
              buttonVariants({ variant: "outline", size: "default" }),
              "w-full gap-2",
            )}
          >
            <Icon />
            {label}
          </a>
        );
      })}
    </div>
  );
}
