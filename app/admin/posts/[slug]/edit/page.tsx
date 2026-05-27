import { notFound } from "next/navigation";
import { getPostForAdmin } from "@/lib/api/admin-posts";
import { PostEditor } from "@/components/admin/post-editor";
import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostForAdmin(slug);
  return {
    title: post ? `편집: ${post.title}` : "게시글 없음",
  };
}

export default async function EditPostPage({
  params,
}: PageProps): Promise<React.ReactElement> {
  const { slug } = await params;
  const post = await getPostForAdmin(slug);

  if (!post) {
    notFound();
  }

  return <PostEditor mode="edit" initial={post} />;
}
