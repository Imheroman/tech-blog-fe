import Link from "next/link";
import { PenLine, PlusCircle } from "lucide-react";
import { listAllPostsForAdmin } from "@/lib/api/admin-posts";
import { formatDate } from "@/lib/blog-data";
import { Button } from "@/components/ui/button";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "게시글 관리",
};

export default async function AdminPostsPage(): Promise<React.ReactElement> {
  const posts = await listAllPostsForAdmin();

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          게시글 관리
        </h1>
        <Button asChild size="sm">
          <Link href="/admin/posts/new">
            <PlusCircle className="h-4 w-4" />
            새 글 작성
          </Link>
        </Button>
      </div>

      {/* Posts table */}
      {posts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center text-muted-foreground">
          아직 작성된 게시글이 없습니다.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  제목
                </th>
                <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground md:table-cell">
                  카테고리
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  상태
                </th>
                <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground sm:table-cell">
                  발행일
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  편집
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {posts.map((post) => (
                <tr
                  key={post.slug}
                  className="bg-background transition-colors hover:bg-muted/30"
                >
                  <td className="max-w-xs px-4 py-3">
                    <span className="line-clamp-1 font-medium text-foreground">
                      {post.title}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                    {post.category}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={post.status} />
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                    <time dateTime={post.publishedAt}>
                      {formatDate(post.publishedAt)}
                    </time>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/admin/posts/${post.slug}/edit`}>
                        <PenLine className="h-4 w-4" />
                        <span className="sr-only">편집: {post.title}</span>
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// StatusBadge — inline server component (no interactivity needed)
// ---------------------------------------------------------------------------

function StatusBadge({
  status,
}: {
  status: "draft" | "published";
}): React.ReactElement {
  if (status === "published") {
    return (
      <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
        발행됨
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
      임시저장
    </span>
  );
}
