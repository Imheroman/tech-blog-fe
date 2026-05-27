import { PostEditor } from "@/components/admin/post-editor";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "새 글 작성",
};

export default function NewPostPage(): React.ReactElement {
  return <PostEditor mode="create" />;
}
