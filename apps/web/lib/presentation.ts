import type { ContentType, StoryStatus } from "./queries";

export const contentTypeLabels = {
  news: "新闻",
  paper: "论文",
  product: "产品",
  model: "模型",
  release: "版本更新",
  post: "文章",
  other: "其他",
} as const;

export const storyStatusLabels: Record<StoryStatus, string> = {
  emerging: "单一信源",
  confirmed: "多源确认",
  cooling: "热度回落",
  corrected: "信息修正",
  archived: "已归档",
};

const signalLabels: Record<string, string> = {
  "ai:ai-term": "AI 主题",
  "ai:ai-company": "AI 公司",
  "ai:model-family": "模型家族",
  "ai:model-radar": "模型雷达",
  "ai:artificial-intelligence": "人工智能",
  "ai:generative-ai": "生成式 AI",
  "ai:large-language-model": "大语言模型",
  "ai:foundation-model": "基础模型",
  "ai:reasoning": "推理能力",
  "ai:agents": "智能体",
  "ai:multimodal": "多模态",
  "ai:inference": "模型推理",
  "ai:rag": "检索增强",
  "ai:embeddings": "向量检索",
  "ai:model-training": "模型训练",
  "ai:transformers": "Transformer",
  "ai:machine-learning": "机器学习",
  "ai:tool-use": "工具调用",
  "product:launch": "发布动态",
  "product:developer-platform": "开发者平台",
  "product:pricing": "价格变化",
  "product:open-source": "开源",
  "product:enterprise": "企业应用",
  "product:benchmark": "评测基准",
  "product:safety-policy": "安全与治理",
  "product:performance": "性能改进",
  "product:integration": "产品集成",
  "product:business-event": "商业事件",
  "product:product-workflow": "工作流",
  ai_core_term: "AI 核心主题",
  foundation_model: "基础模型",
  model_release: "模型发布",
  developer_tool: "开发工具",
  product_launch: "产品发布",
  product_impact: "产品影响",
  research_signal: "研究进展",
  benchmark_signal: "评测进展",
  infrastructure_signal: "基础设施",
};

export function signalLabel(signal: string) {
  return signalLabels[signal] ?? signal.replaceAll("_", " ");
}

export function categoryScoreLabel(contentType: ContentType | null) {
  return contentType ? `${contentTypeLabels[contentType]}评分` : "类别评分";
}

export function selectFeedInterpretation(input: {
  contentType: ContentType | null;
  excerpt: string | null;
  factualSummary: string | null;
  whyItMatters: string | null;
}) {
  if (input.contentType === "product") {
    return input.factualSummary ?? input.excerpt;
  }
  return input.whyItMatters;
}

export function formatScore(score: number | null) {
  if (score === null) return "--";
  return Math.round(score * 100).toString();
}

export function formatDateTime(value: Date | null) {
  if (!value) return "时间未知";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(value);
}

export function formatFullDateTime(value: Date | null) {
  if (!value) return "发布时间未知";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(value);
}

export function formatCalendarDate(value: Date | string = new Date()) {
  const date =
    typeof value === "string" ? new Date(`${value}T00:00:00+08:00`) : value;
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(date);
}
