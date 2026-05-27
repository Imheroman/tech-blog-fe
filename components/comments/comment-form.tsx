"use client";

import { useActionState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Comment } from "@/lib/api/comments";

interface CommentFormState {
  error: string | null;
  success: boolean;
}

interface CommentFormProps {
  slug: string;
  onCreated: (comment: Comment) => void;
}

const INITIAL_STATE: CommentFormState = { error: null, success: false };

export function CommentForm({ slug, onCreated }: CommentFormProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const onCreatedRef = useRef(onCreated);
  onCreatedRef.current = onCreated;

  async function action(
    _prev: CommentFormState,
    formData: FormData,
  ): Promise<CommentFormState> {
    const content = formData.get("content");
    if (typeof content !== "string" || content.trim().length === 0) {
      return { error: "댓글 내용을 입력해 주세요.", success: false };
    }

    let res: Response;
    try {
      res = await fetch(`/api/posts/${slug}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content: content.trim() }),
      });
    } catch {
      return { error: "네트워크 오류가 발생했습니다.", success: false };
    }

    if (!res.ok) {
      let detail = "댓글 작성에 실패했습니다.";
      try {
        const body = (await res.json()) as Record<string, unknown>;
        if (typeof body["detail"] === "string") detail = body["detail"];
      } catch {
        // 파싱 실패는 무시
      }
      return { error: detail, success: false };
    }

    let comment: Comment;
    try {
      comment = (await res.json()) as Comment;
    } catch {
      return { error: "댓글 응답을 처리할 수 없습니다.", success: false };
    }

    onCreatedRef.current(comment);
    return { error: null, success: true };
  }

  const [state, dispatch, isPending] = useActionState(action, INITIAL_STATE);

  // 성공 시 textarea 초기화
  useEffect(() => {
    if (state.success && textareaRef.current) {
      textareaRef.current.value = "";
    }
  }, [state.success]);

  return (
    <form action={dispatch} noValidate>
      <div className="flex flex-col gap-2">
        <label htmlFor="comment-content" className="text-sm font-medium text-foreground">
          댓글 작성
        </label>
        <Textarea
          ref={textareaRef}
          id="comment-content"
          name="content"
          placeholder="댓글을 입력하세요..."
          rows={3}
          disabled={isPending}
          aria-describedby={state.error ? "comment-error" : undefined}
        />
        {state.error && (
          <p
            id="comment-error"
            role="alert"
            aria-live="polite"
            className="text-sm text-destructive"
          >
            {state.error}
          </p>
        )}
        {state.success && (
          <p aria-live="polite" className="text-sm text-muted-foreground">
            댓글이 등록되었습니다.
          </p>
        )}
        <Button
          type="submit"
          size="sm"
          disabled={isPending}
          aria-disabled={isPending}
          className="self-end"
        >
          {isPending ? "등록 중…" : "댓글 등록"}
        </Button>
      </div>
    </form>
  );
}
