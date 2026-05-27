import Link from "next/link";

export function BlogHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Link
          href="/"
          className="text-xl font-bold tracking-tight text-foreground"
        >
          BlackMamba
        </Link>
        <nav className="flex items-center gap-5">
          <Link
            href="/"
            className="text-base text-muted-foreground transition-colors hover:text-foreground"
          >
            Posts
          </Link>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-base text-muted-foreground transition-colors hover:text-foreground"
          >
            GitHub
          </a>
        </nav>
      </div>
    </header>
  );
}
