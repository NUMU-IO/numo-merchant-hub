/**
 * Markdown — the small subset the agent actually replies in.
 *
 * The model answers in Markdown, so a plain `whitespace-pre-wrap` bubble was
 * showing merchants `*   **test** (SKU: …)` verbatim. This renders the parts
 * it really uses — bullets, numbered lists, bold, italic, inline code and
 * headings — and leaves everything else as text.
 *
 * Deliberately not react-markdown: that is a parser plus a sanitizer for six
 * constructs. Output here is React elements built from matched substrings —
 * no `dangerouslySetInnerHTML` anywhere, so model output can never become
 * markup, which is the property that actually matters for text arriving from
 * an LLM that just read tenant data.
 *
 * ponytail: subset renderer. If the agent starts emitting tables or links,
 * swap in react-markdown + rehype-sanitize rather than growing this.
 */
import type { ReactNode } from "react";

const INLINE = /(\*\*[^*\n]+\*\*|__[^_\n]+__|`[^`\n]+`|\*[^*\n]+\*)/g;
const BULLET = /^(\s*)[*\-•]\s+(.*)$/;
const ORDERED = /^(\s*)(\d+)[.)]\s+(.*)$/;
const HEADING = /^(#{1,6})\s+(.*)$/;

/** Bold / italic / code inside one line. */
function inline(text: string): ReactNode[] {
  return text
    .split(INLINE)
    .filter((part) => part !== "" && part !== undefined)
    .map((part, i) => {
      if (
        (part.startsWith("**") && part.endsWith("**") && part.length > 4) ||
        (part.startsWith("__") && part.endsWith("__") && part.length > 4)
      ) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
        return (
          <code
            key={i}
            className="rounded bg-black/[0.06] px-1 py-0.5 font-mono text-[0.85em] dark:bg-white/10"
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
        return <em key={i}>{part.slice(1, -1)}</em>;
      }
      return part;
    });
}

type Item = { depth: number; text: string; marker?: string };
type Block =
  | { kind: "list"; ordered: boolean; items: Item[] }
  | { kind: "para"; lines: string[] }
  | { kind: "heading"; text: string };

/** Group lines into paragraphs, lists and headings. */
function parse(src: string): Block[] {
  const blocks: Block[] = [];
  let list: Extract<Block, { kind: "list" }> | null = null;
  let para: string[] | null = null;

  const closeList = () => {
    if (list) blocks.push(list);
    list = null;
  };
  const closePara = () => {
    if (para?.length) blocks.push({ kind: "para", lines: para });
    para = null;
  };

  for (const raw of src.split("\n")) {
    const line = raw.replace(/\s+$/, "");

    if (!line.trim()) {
      closeList();
      closePara();
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      closeList();
      closePara();
      blocks.push({ kind: "heading", text: heading[2] });
      continue;
    }

    const bullet = BULLET.exec(line);
    const ordered = bullet ? null : ORDERED.exec(line);
    if (bullet || ordered) {
      closePara();
      const indent = (bullet ? bullet[1] : ordered![1]).replace(/\t/g, "  ").length;
      const item: Item = {
        // One level of nesting is all the agent produces; deeper indents
        // collapse onto it rather than building a tree nobody will see.
        depth: Math.min(1, Math.floor(indent / 2)),
        text: bullet ? bullet[2] : ordered![3],
        marker: ordered ? `${ordered[2]}.` : undefined,
      };
      if (!list || list.ordered !== Boolean(ordered)) {
        closeList();
        list = { kind: "list", ordered: Boolean(ordered), items: [] };
      }
      list.items.push(item);
      continue;
    }

    closeList();
    (para ??= []).push(line);
  }
  closeList();
  closePara();
  return blocks;
}

export function Markdown({ text }: { text: string }) {
  const blocks = parse(text);
  return (
    <div className="space-y-2">
      {blocks.map((block, i) => {
        if (block.kind === "heading") {
          return (
            <p key={i} className="font-semibold">
              {inline(block.text)}
            </p>
          );
        }
        if (block.kind === "para") {
          return (
            <p key={i} className="whitespace-pre-wrap">
              {block.lines.map((line, j) => (
                <span key={j}>
                  {j > 0 && <br />}
                  {inline(line)}
                </span>
              ))}
            </p>
          );
        }
        return (
          <ul key={i} className="space-y-1">
            {block.items.map((item, j) => (
              <li
                key={j}
                className={`flex gap-2 ${item.depth ? "ms-4" : ""}`}
              >
                <span className="select-none text-muted-foreground">
                  {item.marker ?? (item.depth ? "◦" : "•")}
                </span>
                <span className="min-w-0">{inline(item.text)}</span>
              </li>
            ))}
          </ul>
        );
      })}
    </div>
  );
}

export default Markdown;
