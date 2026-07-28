export interface MarkdownEvidence {
  sourceName: string;
  title: string;
  url: string;
  publishedAt: string | null;
  contentType: string;
  relevanceScore: string;
  excerpt: string | null;
}

export interface StoryMarkdownInput {
  slug: string;
  title: string;
  originalTitle: string | null;
  contentType: string;
  sourceName: string;
  publishedAt: string;
  relevanceScore: string;
  sourceCount: number;
  status: string;
  factualSummary: string | null;
  whyItMatters: string | null;
  underlyingLogic: string | null;
  productImpact: string | null;
  productOpportunities: string[];
  openQuestions: string[];
  matchedSignals: string[];
  analysisProvider: string | null;
  analysisModel: string | null;
  evidence: MarkdownEvidence[];
}

function yamlString(value: string): string {
  return JSON.stringify(value);
}

function clean(value: string): string {
  return value.replace(/\r\n/g, "\n").trim();
}

function section(title: string, content: string | null): string[] {
  if (!content?.trim()) return [];
  return [`## ${title}`, "", clean(content), ""];
}

function listSection(title: string, items: string[]): string[] {
  const normalized = items.map(clean).filter(Boolean);
  if (normalized.length === 0) return [];
  return [`## ${title}`, "", ...normalized.map((item) => `- ${item}`), ""];
}

export function buildStoryMarkdown(
  story: StoryMarkdownInput,
  pageUrl?: string,
): string {
  const isProduct = story.contentType === "产品";
  const lines = [
    "---",
    `title: ${yamlString(story.title)}`,
    ...(story.originalTitle
      ? [`original_title: ${yamlString(story.originalTitle)}`]
      : []),
    `type: ${yamlString(story.contentType)}`,
    `primary_source: ${yamlString(story.sourceName)}`,
    `published_at: ${yamlString(story.publishedAt)}`,
    `relevance_score: ${yamlString(story.relevanceScore)}`,
    `source_count: ${story.sourceCount}`,
    `status: ${yamlString(story.status)}`,
    ...(pageUrl ? [`navigator_url: ${yamlString(pageUrl)}`] : []),
    "sources:",
    ...story.evidence.flatMap((item) => [
      `  - name: ${yamlString(item.sourceName)}`,
      `    title: ${yamlString(item.title)}`,
      `    url: ${yamlString(item.url)}`,
    ]),
    "---",
    "",
    `# ${clean(story.title)}`,
    "",
    ...(story.originalTitle
      ? [`> 原文标题：${clean(story.originalTitle)}`, ""]
      : []),
    ...section(isProduct ? "产品速览" : "发生了什么", story.factualSummary),
    ...section(isProduct ? "为什么值得试" : "为什么重要", story.whyItMatters),
    ...section(isProduct ? "核心能力" : "底层逻辑", story.underlyingLogic),
    ...section(
      isProduct ? "适合谁与使用场景" : "产品与商业影响",
      story.productImpact,
    ),
    ...listSection(
      isProduct ? "建议尝试的用法" : "产品与商业机会",
      story.productOpportunities,
    ),
    ...listSection(
      isProduct ? "上手前待确认" : "仍待确认",
      story.openQuestions,
    ),
    ...listSection("规则信号", story.matchedSignals),
    "## 来源证据",
    "",
  ];

  if (story.evidence.length === 0) {
    lines.push("暂无来源证据。", "");
  } else {
    story.evidence.forEach((item, index) => {
      lines.push(
        `### ${index + 1}. [${clean(item.title)}](${item.url})`,
        "",
        `- Source：${clean(item.sourceName)}`,
        `- 类型：${clean(item.contentType)}`,
        `- 时间：${clean(item.publishedAt ?? "未知")}`,
        `- 相关度：${clean(item.relevanceScore)}`,
      );
      if (item.excerpt?.trim()) lines.push(`- 摘要：${clean(item.excerpt)}`);
      lines.push("");
    });
  }

  if (story.analysisProvider || story.analysisModel) {
    lines.push(
      "## 分析信息",
      "",
      `- Provider：${story.analysisProvider ?? "未知"}`,
      `- Model：${story.analysisModel ?? "未知"}`,
      "",
    );
  }

  return `${lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()}\n`;
}
