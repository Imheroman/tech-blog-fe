"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LikeState } from "@/lib/api/likes";

interface LikeButtonProps {
  slug: string;
  initial: LikeState;
  isAuthenticated: boolean;
}

export function LikeButton({ slug, initial, isAuthenticated }: LikeButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [optimistic, addOptimistic] = useOptimistic(
    initial,
    (state: LikeState, next: boolean): LikeState => ({
      isLiked: next,
      likeCount: state.likeCount + (next ? 1 : -1),
    }),
  );

  function handleClick() {
    if (!isAuthenticated) {
      router.push(`/login?redirect=/posts/${slug}`);
      return;
    }

    startTransition(async () => {
      const nextLiked = !optimistic.isLiked;
      addOptimistic(nextLiked);

      const res = await fetch(`/api/posts/${slug}/like`, {
        method: nextLiked ? "PUT" : "DELETE",
        credentials: "include",
      });

      if (!res.ok) {
        // 낙관적 업데이트는 transition이 settle되면 자동으로 되돌아감
        return;
      }

      router.refresh();
    });
  }

  return (
    <Button
      variant="ghost"
      size="default"
      aria-pressed={optimistic.isLiked}
      aria-label={optimistic.isLiked ? "좋아요 취소" : "좋아요"}
      disabled={isPending}
      onClick={handleClick}
      className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
    >
      <Heart
        className={
          optimistic.isLiked
            ? "fill-current text-destructive"
            : "text-muted-foreground"
        }
      />
      <span className="text-sm font-medium">{optimistic.likeCount}</span>
    </Button>
  );
}
