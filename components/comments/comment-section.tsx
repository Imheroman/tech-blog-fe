"use client";

import { useState, useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CommentForm } from "@/components/comments/comment-form";
import { CommentItem } from "@/components/comments/comment-item";
import type { Comment, Envelope } from "@/lib/api/comments";

interface CommentSectionProps {
  slug: string;
  initial: Envelope<Comment>;
  isAuthenticated: boolean;
}

function isEnvelope(value: unknown): value is Envelope<Comment> {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return Array.isArray(v["data"]) && typeof v["hasNext"] === "boolean";
}

export function CommentSection({
  slug,
  initial,
  isAuthenticated,
}: CommentSectionProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // 확정된 서버 댓글 목록 (페이지 누적)
  const [committed, setCommitted] = useState<Comment[]>(initial.data);
  const [currentPage, setCurrentPage] = useState(initial.page);
  const [hasNext, setHasNext] = useState(initial.hasNext);

  // 낙관적 insert — transition 안에서만 유효, 완료 후 committed로 대체
  const [optimisticList, addOptimistic] = useOptimistic(
    committed,
    (cur: Comment[], added: Comment): Comment[] => [added, ...cur],
  );

  /**
   * 루트 댓글 생성 성공 콜백.
   * CommentForm이 서버 응답을 전달하면, 낙관적 임시 항목을 실제 댓글로 교체한다.
   */
  function handleCommentCreated(serverComment: Comment) {
    startTransition(() => {
      // addOptimistic은 아직 transition이 진행 중인 경우에만 의미 있지만,
      // 여기서는 실제 항목을 committed에 즉시 반영하여 임시 항목을 자연스럽게 교체한다.
      addOptimistic(serverComment);
    });
    setCommitted((prev) => {
      const deduped = prev.filter((c) => c.id !== serverComment.id);
      return [serverComment, ...deduped];
    });
    router.refresh();
  }

  /**
   * 답글 생성 성공 콜백 — 해당 루트 댓글의 replies를 즉시 반영한다.
   */
  function handleReplyCreated(rootId: string, reply: Comment) {
    setCommitted((prev) =>
      prev.map((c) => {
        if (c.id !== rootId) return c;
        const existingIdx = c.replies.findIndex((r) => r.id === reply.id);
        const nextReplies =
          existingIdx >= 0
            ? c.replies.map((r, i) => (i === existingIdx ? reply : r))
            : [...c.replies, reply];
        return {
          ...c,
          replies: nextReplies,
          replyCount: c.replyCount + (existingIdx >= 0 ? 0 : 1),
        };
      }),
    );
    router.refresh();
  }

  /**
   * CommentForm의 onCreated 전달용 핸들러.
   * 폼이 서버 응답을 받기 직전 낙관적 임시 항목을 transition 안에서 prepend한다.
   * 서버 응답 후 handleCommentCreated가 임시 항목을 실제 항목으로 교체한다.
   */
  function handleFormCreated(serverComment: Comment) {
    // 낙관적 prepend: 임시 id로 즉시 목록 상단에 표시
    const tempId = `temp-${crypto.randomUUID()}`;
    const tempComment: Comment = { ...serverComment, id: tempId };
    startTransition(() => {
      addOptimistic(tempComment);
    });
    // 실제 댓글 반영 (임시 항목은 transition 완료와 함께 사라지고 committed가 재렌더됨)
    handleCommentCreated(serverComment);
  }

  /** 더 보기 */
  function loadMore() {
    const nextPage = currentPage + 1;
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/posts/${slug}/comments?page=${nextPage}&size=10`,
          { credentials: "include" },
        );
        if (!res.ok) return;
        const envelope: unknown = await res.json();
        if (!isEnvelope(envelope)) return;
        setCommitted((prev) => {
          const existingIds = new Set(prev.map((c) => c.id));
          const fresh = envelope.data.filter((c) => !existingIds.has(c.id));
          return [...prev, ...fresh];
        });
        setCurrentPage(envelope.page);
        setHasNext(envelope.hasNext);
      } catch {
        // 네트워크 오류 — 조용히 실패
      }
    });
  }

  return (
    <section aria-labelledby="comments-heading" className="mt-12">
      <h2
        id="comments-heading"
        className="mb-6 text-xl font-bold text-foreground"
      >
        댓글 {optimisticList.length}
      </h2>

      {/* 댓글 입력 영역 */}
      <div className="mb-8">
        {isAuthenticated ? (
          <CommentForm slug={slug} onCreated={handleFormCreated} />
        ) : (
          <p className="text-sm text-muted-foreground">
            <Link
              href={`/login?redirect=/posts/${slug}`}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              로그인
            </Link>
            하고 댓글을 달아보세요.
          </p>
        )}
      </div>

      {/* 댓글 목록 */}
      {optimisticList.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          첫 댓글을 남겨보세요
        </p>
      ) : (
        <ul className="flex flex-col gap-4" aria-label="댓글 목록">
          {optimisticList.map((comment) => {
            // 낙관적 임시 항목 — transition 중에만 표시되는 프리뷰
            if (comment.id.startsWith("temp-")) {
              return (
                <li
                  key={comment.id}
                  className="border-b border-border pb-4 opacity-60 last:border-b-0 last:pb-0"
                  aria-hidden="true"
                >
                  <p className="text-sm text-muted-foreground">{comment.content}</p>
                </li>
              );
            }
            return (
              <CommentItem
                key={comment.id}
                comment={comment}
                onReplyCreated={handleReplyCreated}
              />
            );
          })}
        </ul>
      )}

      {/* 더 보기 */}
      {hasNext && (
        <div className="mt-6 flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={loadMore}
            disabled={isPending}
            aria-disabled={isPending}
          >
            {isPending ? "불러오는 중…" : "댓글 더 보기"}
          </Button>
        </div>
      )}
    </section>
  );
}
