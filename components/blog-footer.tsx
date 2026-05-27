export function BlogFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-8">
        <p className="text-base text-muted-foreground">
          &copy; {new Date().getFullYear()} Blog. All rights reserved.
        </p>
        <div className="flex items-center gap-4">
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-base text-muted-foreground transition-colors hover:text-foreground"
          >
            GitHub
          </a>
          <a
            href="mailto:hello@example.com"
            className="text-base text-muted-foreground transition-colors hover:text-foreground"
          >
            Contact
          </a>
        </div>
      </div>
    </footer>
  );
}
