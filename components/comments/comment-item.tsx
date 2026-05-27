"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ReplyForm } from "@/components/comments/reply-form";
import { formatDate } from "@/lib/blog-data";
import type { Comment } from "@/lib/api/comments";

interface CommentItemProps {
  comment: Comment;
  onReplyCreated: (rootId: string, reply: Comment) => void;
}

export function CommentItem({ comment, onReplyCreated }: CommentItemProps) {
  const [replyOpen, setReplyOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const liveRef = useRef<HTMLSpanElement>(null);

  const isTombstone = comment.isDeleted;

  // 답글 폼이 열릴 때 textarea로 focus 이동
  useEffect(() => {
    if (replyOpen && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [replyOpen]);

  function handleToggleReply() {
    setReplyOpen((prev) => !prev);
  }

  function handleReplyCreated(reply: Comment) {
    onReplyCreated(comment.id, reply);
    setReplyOpen(false);
    // aria-live 알림
    if (liveRef.current) {
      liveRef.current.textContent = "답글이 등록되었습니다.";
      setTimeout(() => {
        if (liveRef.current) liveRef.current.textContent = "";
      }, 3000);
    }
  }

  return (
    <li className="border-b border-border pb-4 last:border-b-0 last:pb-0">
      <article aria-label={isTombstone ? "삭제된 댓글" : `${comment.author.name}의 댓글`}>
        {isTombstone ? (
          <p className="py-2 text-sm text-muted-foreground italic">삭제된 댓글입니다</p>
        ) : (
          <>
            <header className="mb-1 flex items-center gap-2">
              <img
                src={comment.author.avatarUrl}
                alt=""
                aria-hidden="true"
                width={28}
                height={28}
                className="h-7 w-7 rounded-full bg-muted"
              />
              <h3 className="text-sm font-semibold text-foreground">
                {comment.author.name}
              </h3>
              <time
                dateTime={comment.createdAt}
                className="text-xs text-muted-foreground"
              >
                {formatDate(comment.createdAt)}
              </time>
              {comment.editedAt && (
                <span className="text-xs text-muted-foreground">(수정됨)</span>
              )}
            </header>
            <p className="whitespace-pre-wrap break-words text-sm text-foreground">
              {comment.content}
            </p>
          </>
        )}

        {!isTombstone && (
          <div className="mt-2 flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleToggleReply}
              aria-expanded={replyOpen}
              aria-controls={`reply-form-${comment.id}`}
            >
              {replyOpen ? "취소" : "답글"}
            </Button>
            {comment.replyCount > 0 && !replyOpen && (
              <span className="text-xs text-muted-foreground">
                답글 {comment.replyCount}개
              </span>
            )}
          </div>
        )}
      </article>

      {/* aria-live 답글 등록 알림 */}
      <span
        ref={liveRef}
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      />

      {/* 기존 replies (1-level) */}
      {comment.replies.length > 0 && (
        <ul
          className="mt-3 flex flex-col gap-3 border-l-2 border-border pl-4"
          aria-label="답글 목록"
        >
          {comment.replies.map((reply) => (
            <li key={reply.id}>
              <article
                aria-label={
                  reply.isDeleted
                    ? "삭제된 답글"
                    : `${reply.author.name}의 답글`
                }
              >
                {reply.isDeleted ? (
                  <p className="py-1 text-sm text-muted-foreground italic">
                    삭제된 댓글입니다
                  </p>
                ) : (
                  <>
                    <header className="mb-1 flex items-center gap-2">
                      <img
                        src={reply.author.avatarUrl}
                        alt=""
                        aria-hidden="true"
                        width={24}
                        height={24}
                        className="h-6 w-6 rounded-full bg-muted"
                      />
                      <h4 className="text-sm font-semibold text-foreground">
                        {reply.author.name}
                      </h4>
                      <time
                        dateTime={reply.createdAt}
                        className="text-xs text-muted-foreground"
                      >
                        {formatDate(reply.createdAt)}
                      </time>
                      {reply.editedAt && (
                        <span className="text-xs text-muted-foreground">
                          (수정됨)
                        </span>
                      )}
                    </header>
                    <p className="whitespace-pre-wrap break-words text-sm text-foreground">
                      {reply.content}
                    </p>
                  </>
                )}
              </article>
            </li>
          ))}
        </ul>
      )}

      {/* 답글 입력 폼 */}
      {replyOpen && (
        <div
          id={`reply-form-${comment.id}`}
          className="mt-3 rounded-md border border-border p-3"
        >
          <ReplyForm
            rootId={comment.id}
            onCreated={handleReplyCreated}
            textareaRef={textareaRef}
          />
        </div>
      )}
    </li>
  );
}
