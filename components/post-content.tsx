"use client";

interface PostContentProps {
  content: string;
}

export function PostContent({ content }: PostContentProps) {
  const html = markdownToHtml(content);

  return (
    <div
      className="prose-custom"
      // biome-ignore lint: using dangerouslySetInnerHTML for markdown rendering
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function markdownToHtml(md: string): string {
  const lines = md.split("\n");
  const result: string[] = [];
  let inCodeBlock = false;
  let codeContent: string[] = [];
  let inList = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code blocks
    if (line.startsWith("```")) {
      if (inCodeBlock) {
        result.push(
          `<pre class="overflow-x-auto rounded-lg bg-secondary p-4 text-sm leading-relaxed text-foreground"><code>${codeContent.join("\n")}</code></pre>`,
        );
        codeContent = [];
        inCodeBlock = false;
      } else {
        if (inList) {
          result.push("</ul>");
          inList = false;
        }
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeContent.push(escapeHtml(line));
      continue;
    }

    // Headings
    if (line.startsWith("## ")) {
      if (inList) {
        result.push("</ul>");
        inList = false;
      }
      result.push(
        `<h2 class="mb-4 mt-10 text-2xl font-semibold tracking-tight text-foreground">${processInline(line.slice(3))}</h2>`,
      );
      continue;
    }

    if (line.startsWith("### ")) {
      if (inList) {
        result.push("</ul>");
        inList = false;
      }
      result.push(
        `<h3 class="mb-3 mt-8 text-xl font-semibold text-foreground">${processInline(line.slice(4))}</h3>`,
      );
      continue;
    }

    // List items
    if (line.startsWith("- ")) {
      if (!inList) {
        result.push(
          '<ul class="my-4 list-disc space-y-2 pl-6 text-lg text-muted-foreground">',
        );
        inList = true;
      }
      result.push(
        `<li class="leading-relaxed">${processInline(line.slice(2))}</li>`,
      );
      continue;
    }

    if (inList && !line.startsWith("- ")) {
      result.push("</ul>");
      inList = false;
    }

    // Empty line
    if (line.trim() === "") {
      continue;
    }

    // Paragraph
    result.push(
      `<p class="mb-5 text-lg leading-relaxed text-muted-foreground">${processInline(line)}</p>`,
    );
  }

  if (inList) result.push("</ul>");

  return result.join("\n");
}

function processInline(text: string): string {
  // Inline code
  let processed = text.replace(
    /`([^`]+)`/g,
    '<code class="rounded bg-secondary px-1.5 py-0.5 text-sm text-foreground">$1</code>',
  );
  // Bold
  processed = processed.replace(
    /\*\*([^*]+)\*\*/g,
    '<strong class="font-semibold text-foreground">$1</strong>',
  );
  // Italic
  processed = processed.replace(
    /\*([^*]+)\*/g,
    '<em class="italic">$1</em>',
  );
  return processed;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
