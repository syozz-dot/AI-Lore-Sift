export type DistillMaterialKind =
  | "product_release"
  | "technical_report"
  | "engineering_practice"
  | "industry_analysis"
  | "opinion"
  | "low_information_promotion";

export interface DistillEvaluationCase {
  id: string;
  kind: DistillMaterialKind;
  material: {
    title: string;
    paragraphs: string[];
  };
  expectation: {
    acceptableVerdicts: Array<"skip" | "skim" | "read">;
    mustCover: string[];
    mustAvoid: string[];
    transferableInsightRange: [number, number];
    requiresEvidenceReferences: boolean;
  };
}

export const DISTILL_V2_EVALUATION_CASES: DistillEvaluationCase[] = [
  {
    id: "product-release-thin",
    kind: "product_release",
    material: {
      title: "桌面应用新增导入能力",
      paragraphs: [
        "某 AI 桌面应用宣布支持导入项目、聊天、技能与插件数据。",
        "公告只列出了上线平台和可用地区，没有技术实现、迁移限制、兼容范围或性能数据。",
      ],
    },
    expectation: {
      acceptableVerdicts: ["skip", "skim"],
      mustCover: ["功能已上线", "缺少技术与限制信息"],
      mustAvoid: ["显著提升效率", "行业范式变化", "完整迁移方案"],
      transferableInsightRange: [0, 1],
      requiresEvidenceReferences: true,
    },
  },
  {
    id: "technical-report-benchmark",
    kind: "technical_report",
    material: {
      title: "模型推理效率技术报告",
      paragraphs: [
        "报告描述了模型结构、训练设置和评测数据集。",
        "实验给出基线、消融结果以及不同硬件下的吞吐量，但没有披露完整训练数据。",
        "作者据此认为新方法在指定任务和硬件条件下优于基线。",
      ],
    },
    expectation: {
      acceptableVerdicts: ["read"],
      mustCover: ["实验条件", "基线与消融", "训练数据缺口"],
      mustAvoid: ["全面领先", "适用于所有场景"],
      transferableInsightRange: [1, 4],
      requiresEvidenceReferences: true,
    },
  },
  {
    id: "engineering-practice-playbook",
    kind: "engineering_practice",
    material: {
      title: "Agent 规则文件实操指南",
      paragraphs: [
        "团队把全局、项目和模块规则分层，避免一个规则文件承载全部上下文。",
        "高风险动作由宿主权限校验和确认门控制，而不是只在 Prompt 中写禁止。",
        "每条规则采用触发条件与动作格式，并用失败样例做回归测试。",
      ],
    },
    expectation: {
      acceptableVerdicts: ["read"],
      mustCover: ["规则分层", "宿主约束", "可验证完成标准"],
      mustAvoid: ["只靠 Prompt 保证安全", "万能最佳实践"],
      transferableInsightRange: [2, 5],
      requiresEvidenceReferences: true,
    },
  },
  {
    id: "industry-analysis-mixed-evidence",
    kind: "industry_analysis",
    material: {
      title: "企业 AI Agent 市场观察",
      paragraphs: [
        "文章引用三家公司的公开收入与客户案例，讨论企业 Agent 的采购变化。",
        "作者把少量头部案例外推到整个市场，但没有给出样本选择方法。",
        "文章判断未来一年预算会继续增长，这是作者预测而非已发生事实。",
      ],
    },
    expectation: {
      acceptableVerdicts: ["skim", "read"],
      mustCover: ["公开案例", "样本偏差", "预测属于作者判断"],
      mustAvoid: ["市场已经验证", "预算必然增长"],
      transferableInsightRange: [0, 3],
      requiresEvidenceReferences: true,
    },
  },
  {
    id: "opinion-without-data",
    kind: "opinion",
    material: {
      title: "所有软件都会被 Agent 取代",
      paragraphs: [
        "作者认为传统软件界面最终都会消失，用户只需要向 Agent 表达目标。",
        "文章列举个人体验和几个产品演示，没有提供采用率、成本或失败案例。",
      ],
    },
    expectation: {
      acceptableVerdicts: ["skip", "skim"],
      mustCover: ["作者观点", "证据主要是个案"],
      mustAvoid: ["软件界面将消失", "趋势已经确定"],
      transferableInsightRange: [0, 1],
      requiresEvidenceReferences: true,
    },
  },
  {
    id: "promotional-copy",
    kind: "low_information_promotion",
    material: {
      title: "重新定义未来生产力",
      paragraphs: [
        "我们发布了划时代的智能平台，将全面重塑每个人的工作方式。",
        "产品现在开放申请，更多能力敬请期待。",
      ],
    },
    expectation: {
      acceptableVerdicts: ["skip"],
      mustCover: ["缺少可核对能力与证据"],
      mustAvoid: ["划时代", "全面重塑", "值得持续关注"],
      transferableInsightRange: [0, 0],
      requiresEvidenceReferences: true,
    },
  },
];

export interface DistillEvaluationOutput {
  verdict: "skip" | "skim" | "read";
  text: string;
  transferableInsights: string[];
  evidenceReferences: number[][];
}

export function evaluateDistillOutput(
  testCase: DistillEvaluationCase,
  output: DistillEvaluationOutput,
) {
  const normalized = output.text.toLowerCase();
  const [minimumInsights, maximumInsights] =
    testCase.expectation.transferableInsightRange;
  return {
    verdict: testCase.expectation.acceptableVerdicts.includes(output.verdict),
    covered: testCase.expectation.mustCover.filter((phrase) =>
      normalized.includes(phrase.toLowerCase()),
    ),
    forbidden: testCase.expectation.mustAvoid.filter((phrase) =>
      normalized.includes(phrase.toLowerCase()),
    ),
    insightCount:
      output.transferableInsights.length >= minimumInsights &&
      output.transferableInsights.length <= maximumInsights,
    evidence:
      !testCase.expectation.requiresEvidenceReferences ||
      (output.evidenceReferences.length > 0 &&
        output.evidenceReferences.every((references) => references.length > 0)),
  };
}
