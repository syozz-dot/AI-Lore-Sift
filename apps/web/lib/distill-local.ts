import type {
  DistillClaim,
  DistillKeyPoint,
} from "@ai-news-navigator/database";

import type { PrivateDistillRecord } from "./private-workspace";

export interface LocalDistillAnalysis {
  title: string;
  verdict: "skip" | "skim" | "read";
  verdictReason: string;
  estimatedReadingMinutes: number;
  summary: string;
  keyPoints: DistillKeyPoint[];
  claims: DistillClaim[];
  transferableInsights: string[];
  cautions: string[];
  followUpQuestions: string[];
  provider?: string;
  model?: string;
  promptVersion?: string;
  outputTokens?: number | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function localDistillAnalysis(
  record: PrivateDistillRecord,
): LocalDistillAnalysis | null {
  const analysis = record.analysis;
  if (
    !isRecord(analysis) ||
    typeof analysis.title !== "string" ||
    typeof analysis.verdictReason !== "string" ||
    typeof analysis.summary !== "string" ||
    !Array.isArray(analysis.keyPoints) ||
    !Array.isArray(analysis.claims) ||
    !Array.isArray(analysis.transferableInsights) ||
    !Array.isArray(analysis.cautions) ||
    !Array.isArray(analysis.followUpQuestions)
  ) {
    return null;
  }
  const verdict =
    analysis.verdict === "skip" ||
    analysis.verdict === "skim" ||
    analysis.verdict === "read"
      ? analysis.verdict
      : "skim";
  return {
    ...(analysis as unknown as LocalDistillAnalysis),
    verdict,
    estimatedReadingMinutes:
      typeof analysis.estimatedReadingMinutes === "number"
        ? analysis.estimatedReadingMinutes
        : 1,
  };
}

export function localDistillParagraphs(text: string | null) {
  const normalized = (text ?? "")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  let paragraphs = normalized
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\n+/g, " ").trim())
    .filter((paragraph) => paragraph.length >= 8);
  if (paragraphs.length < 3 && normalized.length > 360) {
    const sentences = normalized.match(/[^。！？.!?]+[。！？.!?]?/g) ?? [
      normalized,
    ];
    paragraphs = sentences
      .reduce<string[]>((chunks, sentence) => {
        const current = chunks.at(-1);
        if (current && current.length < 420) {
          chunks[chunks.length - 1] = `${current} ${sentence}`.trim();
        } else {
          chunks.push(sentence.trim());
        }
        return chunks;
      }, [])
      .filter((paragraph) => paragraph.length >= 8);
  }
  return paragraphs.slice(0, 180);
}

export function paragraphReference(numbers: number[]) {
  const sorted = [...new Set(numbers)].sort((left, right) => left - right);
  if (!sorted.length) return "原文证据";
  const groups: Array<[number, number]> = [];
  for (const number of sorted) {
    const current = groups.at(-1);
    if (current && number === current[1] + 1) current[1] = number;
    else groups.push([number, number]);
  }
  return groups
    .map(([start, end]) => (start === end ? `P${start}` : `P${start}–P${end}`))
    .join("、");
}
