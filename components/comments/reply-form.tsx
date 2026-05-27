"use client";

import { useActionState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Comment } from "@/lib/api/comments";

interface ReplyFormState {
  error: string | null;
  success: boolean;
}

interface ReplyFormProps {
  /** 답글 대상 루트 댓글 id */
  rootId: string;
  onCreated: (comment: Comment) => void;
  /** textarea에 외부에서 focus를 이동시키기 위한 ref */
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
}

const INITIAL_STATE: ReplyFormState = { error: null, success: false };

export function ReplyForm({ rootId, onCreated, textareaRef }: ReplyFormProps) {
  const internalRef = useRef<HTMLTextAreaElement>(null);
  const activeRef = textareaRef ?? internalRef;
  const onCreatedRef = useRef(onCreated);
  onCreatedRef.current = onCreated;

  const fieldId = `reply-content-${rootId}`;
  const errorId = `reply-error-${rootId}`;

  async function action(
    _prev: ReplyFormState,
    formData: FormData,
  ): Promise<ReplyFormState> {
    const content = formData.get("content");
    if (typeof content !== "string" || content.trim().length === 0) {
      return { error: "답글 내용을 입력해 주세요.", success: false };
    }

    let res: Response;
    try {
      res = await fetch(`/api/comments/${rootId}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content: content.trim() }),
      });
    } catch {
      return { error: "네트워크 오류가 발생했습니다.", success: false };
    }

    if (!res.ok) {
      let detail = "답글 작성에 실패했습니다.";
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
      return { error: "답글 응답을 처리할 수 없습니다.", success: false };
    }

    onCreatedRef.current(comment);
    return { error: null, success: true };
  }

  const [state, dispatch, isPending] = useActionState(action, INITIAL_STATE);

  // 성공 시 textarea 초기화
  useEffect(() => {
    if (state.success && activeRef.current) {
      activeRef.current.value = "";
    }
  }, [state.success, activeRef]);

  return (
    <form action={dispatch} noValidate>
      <div className="flex flex-col gap-2">
        <label htmlFor={fieldId} className="text-sm font-medium text-foreground">
          답글 작성
        </label>
        <Textarea
          ref={activeRef}
          id={fieldId}
          name="content"
          placeholder="답글을 입력하세요..."
          rows={2}
          disabled={isPending}
          aria-describedby={state.error ? errorId : undefined}
        />
        {state.error && (
          <p
            id={errorId}
            role="alert"
            aria-live="polite"
            className="text-sm text-destructive"
          >
            {state.error}
          </p>
        )}
        {state.success && (
          <p aria-live="polite" className="text-sm text-muted-foreground">
            답글이 등록되었습니다.
          </p>
        )}
        <Button
          type="submit"
          size="sm"
          disabled={isPending}
          aria-disabled={isPending}
          className="self-end"
        >
          {isPending ? "등록 중…" : "답글 등록"}
        </Button>
      </div>
    </form>
  );
}
