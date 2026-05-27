import type { Comment } from "@/lib/api/comments";
import { formatDate } from "@/lib/blog-data";

interface CommentListProps {
  comments: Comment[];
  /** true이면 replies는 렌더링하지 않음 (1-level 보장) */
  isReplyLevel?: boolean;
  /** 답글 toggle 버튼 render slot — client 전용이므로 prop으로 주입 */
  renderActions?: (comment: Comment) => React.ReactNode;
}

function CommentRow({
  comment,
  isReplyLevel = false,
  renderActions,
}: {
  comment: Comment;
  isReplyLevel?: boolean;
  renderActions?: (comment: Comment) => React.ReactNode;
}) {
  const isTombstone = comment.isDeleted;

  return (
    <li
      className={
        isReplyLevel
          ? "border-l-2 border-border pl-4"
          : "border-b border-border pb-4 last:border-b-0 last:pb-0"
      }
    >
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

        {renderActions && !isReplyLevel && (
          <div className="mt-2">{renderActions(comment)}</div>
        )}
      </article>

      {!isReplyLevel && comment.replies.length > 0 && (
        <ul className="mt-3 flex flex-col gap-3" aria-label="답글 목록">
          {comment.replies.map((reply) => (
            <CommentRow
              key={reply.id}
              comment={reply}
              isReplyLevel
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function CommentList({
  comments,
  isReplyLevel = false,
  renderActions,
}: CommentListProps) {
  if (comments.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        첫 댓글을 남겨보세요
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-4" aria-label="댓글 목록">
      {comments.map((comment) => (
        <CommentRow
          key={comment.id}
          comment={comment}
          isReplyLevel={isReplyLevel}
          renderActions={renderActions}
        />
      ))}
    </ul>
  );
}
