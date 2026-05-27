import Link from "next/link";
import Image from "next/image";
import type { Post } from "@/lib/blog-data";
import { formatDate } from "@/lib/blog-data";

interface PostCardProps {
  post: Post;
}

export function PostCard({ post }: PostCardProps) {
  return (
    <Link href={`/posts/${post.slug}`} className="group block">
      <article className="flex gap-6 py-7">
        {/* Text content */}
        <div className="flex flex-1 flex-col gap-2">
          <h2 className="text-pretty text-xl font-semibold leading-snug tracking-tight text-foreground transition-colors group-hover:text-muted-foreground md:text-2xl">
            {post.title}
          </h2>
          <p className="line-clamp-2 text-base leading-relaxed text-muted-foreground md:text-lg">
            {post.excerpt}
          </p>
          <div className="mt-auto flex items-center gap-1.5 pt-3 text-sm text-muted-foreground">
            <span className="font-medium text-foreground/70">
              {post.category}
            </span>
            <span>{"|"}</span>
            <time dateTime={post.date}>{formatDate(post.date)}</time>
            <span>{"|"}</span>
            <span>{post.readTime}</span>
          </div>
        </div>

        {/* Thumbnail */}
        <div className="relative hidden aspect-[4/3] w-52 flex-shrink-0 overflow-hidden rounded-lg sm:block md:w-64">
          <Image
            src={post.thumbnail || "/placeholder.svg"}
            alt=""
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 768px) 208px, 256px"
          />
        </div>
      </article>
    </Link>
  );
}
