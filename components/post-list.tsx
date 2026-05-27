"use client";

import { useState, useMemo, useEffect } from "react";
import type { PostSummary } from "@/lib/api/public-fetch";
import { PostCard } from "@/components/post-card";
import { CategoryTabs } from "@/components/category-tabs";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";

interface PostListProps {
  initialPosts: PostSummary[];
}

const PAGE_SIZE = 4;

export function PostList({ initialPosts }: PostListProps) {
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    let result = initialPosts;

    if (category !== "All") {
      result = result.filter((p) => p.category === category);
    }

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.excerpt.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q),
      );
    }

    return result;
  }, [initialPosts, category, query]);

  // Reset to the first page whenever the filters change.
  useEffect(() => {
    setPage(1);
  }, [category, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Category tabs (horizontally scrollable) + search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 sm:flex-1">
          <CategoryTabs selected={category} onSelect={setCategory} />
        </div>

        <div className="relative w-full sm:w-80 sm:flex-shrink-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search posts..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-11 w-full rounded-lg border border-border bg-secondary/50 pl-10 pr-4 text-base text-foreground placeholder:text-muted-foreground focus:border-muted-foreground focus:outline-none"
          />
        </div>
      </div>

      {/* Post list */}
      <div className="divide-y divide-border">
        {paged.map((post) => (
          <PostCard key={post.slug} post={post} />
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="py-16 text-center text-muted-foreground">
          검색 결과가 없습니다.
        </p>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <nav
          aria-label="페이지네이션"
          className="flex items-center justify-center gap-1 pt-2"
        >
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            aria-label="이전 페이지"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setPage(n)}
              aria-current={n === currentPage ? "page" : undefined}
              className={`flex h-9 w-9 items-center justify-center rounded-lg text-base font-medium tabular-nums transition-colors ${
                n === currentPage
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              {n}
            </button>
          ))}

          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            aria-label="다음 페이지"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </nav>
      )}
    </div>
  );
}
