import type {
  DistillClaim,
  DistillKeyPoint,
} from "@ai-news-navigator/database";

import type { DistillPersonalizedInsight } from "./distill-analysis";

export interface DistillMarkdownInput {
  id: string;
  title: string;
  sourceTitle: string | null;
  sourceUrl: string | null;
  sourceAuthor: string | null;
  verdict: string;
  verdictReason: string;
  estimatedReadingMinutes: number;
  summary: string;
  keyPoints: DistillKeyPoint[];
  claims: DistillClaim[];
  transferableInsights: string[];
  cautions: string[];
  followUpQuestions: string[];
  personalizedInsights?: DistillPersonalizedInsight[];
  createdAt: string;
}

const verdictLabels: Record<string, string> = {
  skip: "可以跳过",
  skim: "读脱水版即可",
  read: "建议阅读原文",
};

function list(items: string[]) {
  return items.length ? items.map((item) => `- ${item}`).join("\n") : "- 无";
}

function paragraphRefs(numbers: number[]) {
  return numbers.length
    ? numbers.map((number) => `P${number}`).join("、")
    : "未标注";
}

export function buildDistillMarkdown(
  input: DistillMarkdownInput,
  pageUrl: string,
) {
  const lines = [
    `# ${input.title}`,
    "",
    `> 阅读建议：${verdictLabels[input.verdict] ?? input.verdict}`,
    `> ${input.verdictReason}`,
    "",
    "## 来源",
    "",
    `- 原标题：${input.sourceTitle ?? "用户粘贴正文"}`,
    `- 作者：${input.sourceAuthor ?? "未提供"}`,
    `- 原文：${input.sourceUrl ?? "无外部链接"}`,
    `- 原文预计阅读：${input.estimatedReadingMinutes} 分钟`,
    `- 脱水页面：${pageUrl}`,
    `- 生成时间：${input.createdAt}`,
    "",
    "## 三分钟脱水",
    "",
    input.summary,
    "",
    "## 核心要点",
    "",
    ...input.keyPoints.flatMap((point) => [
      `### ${point.title}`,
      "",
      point.detail,
      "",
      `证据段落：${paragraphRefs(point.evidenceParagraphs)}`,
      "",
    ]),
    "## 主张与证据",
    "",
    ...input.claims.flatMap((claim) => [
      `- ${claim.claim}`,
      `  - 类型：${claim.type}`,
      `  - 置信度：${claim.confidence}`,
      `  - 证据段落：${paragraphRefs(claim.evidenceParagraphs)}`,
    ]),
    "",
    "## 可迁移启示",
    "",
    list(input.transferableInsights),
    "",
    ...(input.personalizedInsights?.length
      ? [
          "## 与我的目标有关",
          "",
          ...input.personalizedInsights.flatMap((insight) => [
            `### ${insight.title}`,
            "",
            insight.detail,
            "",
            `依据：${insight.basis}；原文段落：${paragraphRefs(insight.evidenceParagraphs)}`,
            "",
          ]),
        ]
      : []),
    "## 阅读边界",
    "",
    list(input.cautions),
    "",
    "## 继续追问",
    "",
    list(input.followUpQuestions),
    "",
  ];
  return lines.join("\n");
}
