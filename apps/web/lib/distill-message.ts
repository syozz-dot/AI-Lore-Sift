export interface DistillMessageBlock {
  kind: "paragraph" | "list";
  content: string | string[];
}

function cleanInlineMarkdown(value: string) {
  return value
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .trim();
}

function chunkParagraph(value: string, maxLength = 220) {
  if (value.length <= maxLength) return [value];
  const sentences = value
    .match(/[^。！？!?；;]+[。！？!?；;]?/g)
    ?.map((item) => item.trim()) ?? [value];
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if (current && current.length + sentence.length > maxLength) {
      chunks.push(current);
      current = sentence;
    } else {
      current += sentence;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function appendListItem(blocks: DistillMessageBlock[], value: string) {
  const item = cleanInlineMarkdown(value);
  if (!item) return;
  const last = blocks.at(-1);
  if (last?.kind === "list" && Array.isArray(last.content)) {
    last.content.push(item);
  } else {
    blocks.push({ kind: "list", content: [item] });
  }
}

function appendParagraphs(blocks: DistillMessageBlock[], value: string) {
  for (const paragraph of chunkParagraph(cleanInlineMarkdown(value))) {
    if (paragraph) blocks.push({ kind: "paragraph", content: paragraph });
  }
}

export function distillMessageBlocks(content: string): DistillMessageBlock[] {
  const prepared = content
    .replace(/\r\n?/g, "\n")
    .replace(/\s*\*\*([^*\n]+)\*\*\s*([：:])/g, "\n\n$1$2")
    .replace(/([。！？!?：:；;])\s+(?=(?:[-•]|\d+[.、])\s+\S)/g, "$1\n")
    .trim();
  const lines = prepared.split(/\n+/).map(cleanInlineMarkdown).filter(Boolean);
  const blocks: DistillMessageBlock[] = [];
  let pendingListItem = false;

  for (const line of lines) {
    if (/^(?:[-•]|\d+[.、])$/.test(line)) {
      pendingListItem = true;
      continue;
    }

    const trailingMarker = line.match(/^(.*\S)\s+(?:[-•])$/);
    if (trailingMarker?.[1]) {
      appendParagraphs(blocks, trailingMarker[1]);
      pendingListItem = true;
      continue;
    }

    const listItem = line.match(/^(?:[-•]|\d+[.、])\s*(.+)$/);
    if (listItem?.[1]) {
      appendListItem(blocks, listItem[1]);
      pendingListItem = false;
      continue;
    }

    if (pendingListItem) {
      appendListItem(blocks, line);
      pendingListItem = false;
      continue;
    }

    appendParagraphs(blocks, line);
  }

  return blocks;
}
