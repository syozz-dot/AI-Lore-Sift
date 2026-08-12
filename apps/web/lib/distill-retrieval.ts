export type DistillKnowledgeKind = "card" | "document";

export interface DistillKnowledgeCandidate {
  id: string;
  kind: DistillKnowledgeKind;
  title: string;
  content: string;
  sourceDocumentId: string;
}

export interface DistillRetrievedKnowledge extends DistillKnowledgeCandidate {
  reference: string;
}

interface DistillRetrievalInput {
  sourceTitle: string | null;
  paragraphs: string[];
  privateContext: string[];
  candidates: DistillKnowledgeCandidate[];
  limit?: number;
}

const COMMON_CJK_TOKENS = new Set([
  "一个",
  "一些",
  "这个",
  "这些",
  "那种",
  "可以",
  "需要",
  "应该",
  "进行",
  "通过",
  "使用",
  "用户",
  "内容",
  "信息",
  "文章",
  "问题",
  "方法",
  "相关",
  "不同",
  "提供",
  "实现",
  "支持",
  "包括",
  "以及",
  "如果",
  "没有",
  "已经",
  "当前",
  "能够",
  "其中",
]);

function tokenWeight(token: string) {
  if (/^[a-z0-9]/.test(token)) return token.length >= 4 ? 7 : 4;
  return token.length >= 3 ? 4 : 2;
}

function searchableTokens(value: string) {
  const normalized = value.normalize("NFKC").toLowerCase();
  const tokens = new Map<string, number>();
  for (const token of normalized.match(/[a-z0-9][a-z0-9.+#_-]{1,}/g) ?? []) {
    tokens.set(token, tokenWeight(token));
  }
  for (const sequence of normalized.match(/[\u3400-\u9fff]{2,}/g) ?? []) {
    for (const size of [3, 2]) {
      for (let index = 0; index <= sequence.length - size; index += 1) {
        const token = sequence.slice(index, index + size);
        if (COMMON_CJK_TOKENS.has(token)) continue;
        tokens.set(token, tokenWeight(token));
      }
    }
  }
  return tokens;
}

function scoreCandidate(
  queryTokens: Map<string, number>,
  candidate: DistillKnowledgeCandidate,
) {
  const titleTokens = searchableTokens(candidate.title);
  const contentTokens = searchableTokens(candidate.content);
  let score = 0;
  let matches = 0;
  let strongLatinMatch = false;
  for (const [token, weight] of queryTokens) {
    const inTitle = titleTokens.has(token);
    const inContent = contentTokens.has(token);
    if (!inTitle && !inContent) continue;
    matches += 1;
    score += weight * (inTitle ? 3 : 1);
    if (/^[a-z0-9]/.test(token) && token.length >= 4) strongLatinMatch = true;
  }
  return { score, matches, strongLatinMatch };
}

export function rankRelevantDistillKnowledge({
  sourceTitle,
  paragraphs,
  privateContext,
  candidates,
  limit = 5,
}: DistillRetrievalInput): DistillRetrievedKnowledge[] {
  const sourceQuery = [sourceTitle ?? "", ...paragraphs]
    .join(" ")
    .slice(0, 14_000);
  const contextQuery = privateContext.join(" ").slice(0, 3_000);
  const queryTokens = searchableTokens(`${sourceQuery} ${contextQuery}`);
  const bestByDocument = new Map<
    string,
    DistillKnowledgeCandidate & { score: number; matches: number }
  >();

  for (const candidate of candidates) {
    const scored = scoreCandidate(queryTokens, candidate);
    if (scored.score < 8 || (scored.matches < 2 && !scored.strongLatinMatch)) {
      continue;
    }
    const previous = bestByDocument.get(candidate.sourceDocumentId);
    if (!previous || scored.score > previous.score) {
      bestByDocument.set(candidate.sourceDocumentId, {
        ...candidate,
        score: scored.score,
        matches: scored.matches,
      });
    }
  }

  return [...bestByDocument.values()]
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.matches - left.matches ||
        left.title.localeCompare(right.title, "zh-CN"),
    )
    .slice(0, Math.max(0, Math.min(limit, 5)))
    .map(({ score: _score, matches: _matches, ...candidate }, index) => ({
      ...candidate,
      reference: `K${index + 1}`,
    }));
}
