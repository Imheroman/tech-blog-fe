"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PostSummary } from "@/lib/api/public-fetch";

interface HeroCarouselProps {
  posts: PostSummary[];
}

export function HeroCarousel({ posts }: HeroCarouselProps) {
  const [index, setIndex] = useState(0);

  if (posts.length === 0) return null;

  const post = posts[index];
  const hasMultiple = posts.length > 1;

  const goPrev = () => setIndex((i) => (i - 1 + posts.length) % posts.length);
  const goNext = () => setIndex((i) => (i + 1) % posts.length);

  // Auto-advance every 5s. The timer re-arms whenever `index` changes, so a
  // manual prev/next/dot interaction also resets the countdown.
  useEffect(() => {
    if (!hasMultiple) return;
    const timer = setTimeout(() => {
      setIndex((i) => (i + 1) % posts.length);
    }, 5000);
    return () => clearTimeout(timer);
  }, [index, hasMultiple, posts.length]);

  return (
    // Contained banner: shares the body's max-width/padding. A fixed 16:9
    // aspect ratio keeps the proportions identical across monitor sizes.
    <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl">
      <Link href={`/posts/${post.slug}`} className="group block h-full w-full">
        <Image
          src={post.thumbnail || "/placeholder.svg"}
          alt=""
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="(max-width: 1152px) 100vw, 1152px"
          priority
        />
        {/* Gradient for text legibility over any image */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />

        {/* Overlaid text */}
        <div className="absolute inset-x-0 bottom-0 p-6 md:p-10">
          <h2 className="text-balance text-2xl font-bold leading-tight tracking-tight text-white md:text-4xl">
            {post.title}
          </h2>
          <p className="mt-3 line-clamp-2 max-w-2xl leading-relaxed text-white/80 md:text-lg">
            {post.excerpt}
          </p>
        </div>
      </Link>

      {hasMultiple && (
        <>
          <button
            type="button"
            onClick={goPrev}
            aria-label="이전 인기 글"
            className="absolute left-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm transition hover:bg-white/40"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={goNext}
            aria-label="다음 인기 글"
            className="absolute right-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm transition hover:bg-white/40"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          {/* Dots */}
          <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 gap-2">
            {posts.map((p, i) => (
              <button
                key={p.slug}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`${i + 1}번째 인기 글로 이동`}
                className={`h-2 rounded-full transition-all ${
                  i === index
                    ? "w-6 bg-white"
                    : "w-2 bg-white/50 hover:bg-white/80"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
