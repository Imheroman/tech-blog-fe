"use client";

/**
 * PostEditor — 게시글 생성/편집 폼 (Client Component).
 *
 * create 모드: POST /api/posts → 성공 시 /admin/posts 로 이동.
 * edit   모드: PATCH /api/posts/:slug → 성공 시 /admin/posts 로 이동.
 * 삭제  버튼 (edit 모드만): 2단계 확인 → DELETE /api/posts/:slug.
 */

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { categories } from "@/lib/blog-data";
import type { Post } from "@/lib/blog-data";
import type { PostStatus } from "@/lib/api/admin-posts";

// ---------------------------------------------------------------------------
// 타입
// ---------------------------------------------------------------------------

type CreateProps = { mode: "create" };
type EditProps = { mode: "edit"; initial: Post };
type PostEditorProps = CreateProps | EditProps;

interface EditorState {
  ok: boolean;
  error: string | null;
  successMessage: string | null;
}

interface FieldValues {
  title: string;
  excerpt: string;
  content: string;
  category: string;
  thumbnail: string;
  status: PostStatus;
}

const INITIAL_STATE: EditorState = {
  ok: false,
  error: null,
  successMessage: null,
};

// "All" 카테고리는 편집 대상에서 제외
const CONTENT_CATEGORIES = categories.filter((c) => c !== "All");

// ---------------------------------------------------------------------------
// 컴포넌트
// ---------------------------------------------------------------------------

export function PostEditor(props: PostEditorProps): React.ReactElement {
  const router = useRouter();
  const isEdit = props.mode === "edit";
  const initial = isEdit ? props.initial : null;

  // -------------------------------------------------------------------------
  // 폼 필드 상태
  // -------------------------------------------------------------------------

  const [title, setTitle] = useState<string>(initial?.title ?? "");
  const [excerpt, setExcerpt] = useState<string>(initial?.excerpt ?? "");
  const [content, setContent] = useState<string>(initial?.content ?? "");
  const [category, setCategory] = useState<string>(
    initial?.category ?? CONTENT_CATEGORIES[0] ?? "",
  );
  const [thumbnail, setThumbnail] = useState<string>(
    initial?.thumbnail ?? "/test-image.png",
  );
  const [status, setStatus] = useState<PostStatus>(
    initial?.status ?? "draft",
  );

  // -------------------------------------------------------------------------
  // Dirty 추적 (beforeunload 경고)
  // -------------------------------------------------------------------------

  const dirtyRef = useRef<boolean>(false);

  function markDirty(): void {
    dirtyRef.current = true;
  }

  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent): void {
      if (dirtyRef.current) {
        e.preventDefault();
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  // -------------------------------------------------------------------------
  // 삭제 확인 상태 (2단계)
  // -------------------------------------------------------------------------

  const [deleteConfirming, setDeleteConfirming] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<boolean>(false);

  // -------------------------------------------------------------------------
  // 인라인 검증 에러
  // -------------------------------------------------------------------------

  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FieldValues, string>>>({});

  function validateFields(): boolean {
    const errors: Partial<Record<keyof FieldValues, string>> = {};
    if (title.trim() === "") errors.title = "제목을 입력하세요.";
    if (excerpt.trim() === "") errors.excerpt = "요약을 입력하세요.";
    if (content.trim() === "") errors.content = "본문을 입력하세요.";
    if (category.trim() === "") errors.category = "카테고리를 선택하세요.";
    if (thumbnail.trim() === "") errors.thumbnail = "썸네일 경로를 입력하세요.";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  // -------------------------------------------------------------------------
  // useActionState 액션
  // -------------------------------------------------------------------------

  const [state, dispatch, isPending] = useActionState<EditorState, void>(
    async (_prev: EditorState): Promise<EditorState> => {
      if (!validateFields()) {
        return { ok: false, error: null, successMessage: null };
      }

      const body: FieldValues = { title, excerpt, content, category, thumbnail, status };

      let res: Response;
      try {
        if (isEdit && initial) {
          // PATCH — 변경된 필드만 보내도 되지만, 구현 단순화를 위해 전체 전송
          res = await fetch(`/api/posts/${initial.slug}`, {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
        } else {
          res = await fetch("/api/posts", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
        }
      } catch {
        return {
          ok: false,
          error: "네트워크 오류가 발생했습니다. 잠시 후 다시 시도하세요.",
          successMessage: null,
        };
      }

      if (!res.ok) {
        let detail = isEdit
          ? "게시글 수정에 실패했습니다."
          : "게시글 생성에 실패했습니다.";
        try {
          const json = (await res.json()) as Record<string, unknown>;
          if (typeof json["detail"] === "string") {
            detail = json["detail"];
          } else if (typeof json["message"] === "string") {
            detail = json["message"];
          }
        } catch {
          // 응답 파싱 실패 시 기본 메시지 사용
        }
        return { ok: false, error: detail, successMessage: null };
      }

      // 성공: dirty 해제 후 목록으로 이동
      dirtyRef.current = false;
      router.push("/admin/posts");
      router.refresh();

      return {
        ok: true,
        error: null,
        successMessage: isEdit ? "게시글이 수정되었습니다." : "게시글이 생성되었습니다.",
      };
    },
    INITIAL_STATE,
  );

  // -------------------------------------------------------------------------
  // 삭제 핸들러
  // -------------------------------------------------------------------------

  async function handleDeleteConfirm(): Promise<void> {
    if (!isEdit || !initial) return;
    setDeleteLoading(true);
    setDeleteError(null);

    let res: Response;
    try {
      res = await fetch(`/api/posts/${initial.slug}`, {
        method: "DELETE",
        credentials: "include",
      });
    } catch {
      setDeleteError("네트워크 오류가 발생했습니다. 잠시 후 다시 시도하세요.");
      setDeleteLoading(false);
      return;
    }

    if (!res.ok) {
      let detail = "게시글 삭제에 실패했습니다.";
      try {
        const json = (await res.json()) as Record<string, unknown>;
        if (typeof json["detail"] === "string") detail = json["detail"];
      } catch {
        // 응답 파싱 실패 시 기본 메시지 사용
      }
      setDeleteError(detail);
      setDeleteLoading(false);
      return;
    }

    dirtyRef.current = false;
    router.push("/admin/posts");
    router.refresh();
  }

  // -------------------------------------------------------------------------
  // 렌더
  // -------------------------------------------------------------------------

  const submitLabel = isPending
    ? isEdit
      ? "저장 중..."
      : "생성 중..."
    : isEdit
      ? "저장"
      : "게시글 생성";

  return (
    <div className="space-y-8">
      {/* Page heading */}
      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        {isEdit ? "게시글 편집" : "새 글 작성"}
      </h1>

      {/* Success status (a11y live region) */}
      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {state.successMessage ?? ""}
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          dispatch(undefined);
        }}
        noValidate
        className="space-y-6"
      >
        {/* Title */}
        <div className="space-y-2">
          <Label htmlFor="post-title">제목</Label>
          <Input
            id="post-title"
            name="title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              markDirty();
            }}
            placeholder="게시글 제목"
            disabled={isPending}
            aria-describedby={fieldErrors.title ? "error-title" : undefined}
          />
          {fieldErrors.title && (
            <p
              id="error-title"
              role="alert"
              aria-live="polite"
              className="text-sm text-destructive"
            >
              {fieldErrors.title}
            </p>
          )}
        </div>

        {/* Excerpt */}
        <div className="space-y-2">
          <Label htmlFor="post-excerpt">요약</Label>
          <Input
            id="post-excerpt"
            name="excerpt"
            value={excerpt}
            onChange={(e) => {
              setExcerpt(e.target.value);
              markDirty();
            }}
            placeholder="게시글 요약 (목록에 표시됩니다)"
            disabled={isPending}
            aria-describedby={fieldErrors.excerpt ? "error-excerpt" : undefined}
          />
          {fieldErrors.excerpt && (
            <p
              id="error-excerpt"
              role="alert"
              aria-live="polite"
              className="text-sm text-destructive"
            >
              {fieldErrors.excerpt}
            </p>
          )}
        </div>

        {/* Content */}
        <div className="space-y-2">
          <Label htmlFor="post-content">본문</Label>
          <Textarea
            id="post-content"
            name="content"
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              markDirty();
            }}
            placeholder="마크다운을 지원합니다"
            disabled={isPending}
            className="min-h-64 font-mono text-sm"
            aria-describedby={fieldErrors.content ? "error-content" : undefined}
          />
          {fieldErrors.content && (
            <p
              id="error-content"
              role="alert"
              aria-live="polite"
              className="text-sm text-destructive"
            >
              {fieldErrors.content}
            </p>
          )}
        </div>

        {/* Category */}
        <div className="space-y-2">
          <Label htmlFor="post-category">카테고리</Label>
          <Select
            value={category}
            onValueChange={(val) => {
              setCategory(val);
              markDirty();
            }}
            disabled={isPending}
          >
            <SelectTrigger id="post-category" aria-describedby={fieldErrors.category ? "error-category" : undefined}>
              <SelectValue placeholder="카테고리 선택" />
            </SelectTrigger>
            <SelectContent>
              {CONTENT_CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {fieldErrors.category && (
            <p
              id="error-category"
              role="alert"
              aria-live="polite"
              className="text-sm text-destructive"
            >
              {fieldErrors.category}
            </p>
          )}
        </div>

        {/* Thumbnail */}
        <div className="space-y-2">
          <Label htmlFor="post-thumbnail">썸네일 경로</Label>
          <Input
            id="post-thumbnail"
            name="thumbnail"
            value={thumbnail}
            onChange={(e) => {
              setThumbnail(e.target.value);
              markDirty();
            }}
            placeholder="/test-image.png"
            disabled={isPending}
            aria-describedby={fieldErrors.thumbnail ? "error-thumbnail" : undefined}
          />
          {fieldErrors.thumbnail && (
            <p
              id="error-thumbnail"
              role="alert"
              aria-live="polite"
              className="text-sm text-destructive"
            >
              {fieldErrors.thumbnail}
            </p>
          )}
        </div>

        {/* Status */}
        <div className="space-y-2">
          <Label htmlFor="post-status">공개 상태</Label>
          <Select
            value={status}
            onValueChange={(val) => {
              setStatus(val as PostStatus);
              markDirty();
            }}
            disabled={isPending}
          >
            <SelectTrigger id="post-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">임시저장 (draft)</SelectItem>
              <SelectItem value="published">발행됨 (published)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Global action error */}
        {state.error !== null && (
          <p
            role="alert"
            aria-live="polite"
            className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {state.error}
          </p>
        )}

        {/* Form actions */}
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isPending} className="min-w-24">
            {submitLabel}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => {
              router.push("/admin/posts");
            }}
          >
            취소
          </Button>
        </div>
      </form>

      {/* Delete section (edit mode only) */}
      {isEdit && (
        <div className="border-t border-border pt-8">
          <h2 className="mb-3 text-base font-semibold text-foreground">
            위험 구역
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            게시글을 삭제하면 복구할 수 없습니다.
          </p>

          {/* Delete error */}
          {deleteError !== null && (
            <p
              role="alert"
              aria-live="polite"
              className="mb-3 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {deleteError}
            </p>
          )}

          {deleteConfirming ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-destructive">
                정말로 삭제하시겠습니까?
              </span>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={deleteLoading}
                onClick={handleDeleteConfirm}
              >
                {deleteLoading ? "삭제 중..." : "삭제 확정"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={deleteLoading}
                onClick={() => {
                  setDeleteConfirming(false);
                  setDeleteError(null);
                }}
              >
                취소
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => {
                setDeleteConfirming(true);
              }}
            >
              게시글 삭제
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
