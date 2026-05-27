import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { BlogHeader } from "@/components/blog-header";
import { BlogFooter } from "@/components/blog-footer";
import { getPostBySlug, posts, formatDate } from "@/lib/blog-data";
import { PostContent } from "@/components/post-content";
import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return { title: "Post Not Found" };
  return {
    title: `${post.title} | Blog`,
    description: post.excerpt,
  };
}

export default async function PostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  return (
    <div className="flex min-h-screen flex-col">
      <BlogHeader />
      <main className="flex-1">
        <article className="mx-auto max-w-3xl px-6 pb-16 pt-10 md:pt-14">
          {/* Back link */}
          <Link
            href="/"
            className="mb-8 inline-flex items-center gap-1.5 text-base text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            All Posts
          </Link>

          {/* Post header */}
          <header className="mb-8">
            <span className="mb-3 inline-block rounded-full bg-secondary px-3 py-1 text-sm font-medium text-muted-foreground">
              {post.category}
            </span>
            <h1 className="text-balance text-3xl font-bold tracking-tight text-foreground md:text-4xl lg:text-5xl">
              {post.title}
            </h1>
            <div className="mt-4 flex items-center gap-2 text-base text-muted-foreground">
              <span className="font-medium text-foreground/70">
                {post.category}
              </span>
              <span>{"|"}</span>
              <time dateTime={post.date}>{formatDate(post.date)}</time>
              <span>{"|"}</span>
              <span>{post.readTime}</span>
            </div>
          </header>

          {/* Thumbnail */}
          <div className="relative mb-10 aspect-[2/1] w-full overflow-hidden rounded-xl">
            <Image
              src={post.thumbnail || "/placeholder.svg"}
              alt=""
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 768px"
              priority
            />
          </div>

          {/* Divider */}
          <div className="border-t border-border" />

          {/* Post content */}
          <div className="pt-8">
            <PostContent content={post.content} />
          </div>
        </article>
      </main>
      <BlogFooter />
    </div>
  );
}
