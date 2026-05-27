import { redirect } from "next/navigation";
import { requireRole, AuthzError } from "@/lib/dal";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.ReactElement> {
  try {
    await requireRole("ADMIN");
  } catch (e) {
    if (e instanceof AuthzError && e.reason === "UNAUTHENTICATED") {
      redirect("/login?redirect=/admin/posts");
    }
    redirect("/");
  }

  return (
    <section className="mx-auto min-h-screen max-w-5xl px-6 py-10">
      {children}
    </section>
  );
}
