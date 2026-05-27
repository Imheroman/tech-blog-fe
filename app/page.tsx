import { BlogHeader } from "@/components/blog-header";
import { BlogFooter } from "@/components/blog-footer";
import { PostList } from "@/components/post-list";
import { HeroCarousel } from "@/components/hero-carousel";
import { posts, getPopularPosts } from "@/lib/blog-data";

export default function Page() {
  // Hero carousel cycles through the most popular posts (by views).
  const heroPosts = getPopularPosts(5);

  // The list shows all posts (newest first) with pagination.
  const listPosts = [...posts].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  return (
    <div className="flex min-h-screen flex-col">
      <BlogHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-6">
          {/* Intro */}
          <section className="pb-6 pt-8 md:pb-8 md:pt-10">
            <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground md:text-5xl">
              BlackMamba
            </h1>
            <p className="mt-3 max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl">
              학습한 지식을 공유하는 공간입니다.
            </p>
          </section>

          {/* Featured popular posts carousel */}
          <section className="pb-10 md:pb-12">
            <HeroCarousel posts={heroPosts} />
          </section>

          {/* Post list with search, category tabs and pagination */}
          <section className="pb-16">
            <PostList initialPosts={listPosts} />
          </section>
        </div>
      </main>
      <BlogFooter />
    </div>
  );
}
