import { describe, expect, it } from "vitest";

import { rankRelevantDistillKnowledge } from "./distill-retrieval";

describe("distill knowledge retrieval", () => {
  const candidates = [
    {
      id: "card-agent",
      kind: "card" as const,
      title: "Agent 工具反馈需要携带可纠正信息",
      content: "工具错误应返回完整 stderr、搜索提示和权限申请路径。",
      sourceDocumentId: "doc-agent",
    },
    {
      id: "entry-agent",
      kind: "document" as const,
      title: "Harness 编程实操指南",
      content: "Agent 工具调用与反馈层设计。",
      sourceDocumentId: "doc-agent",
    },
    {
      id: "entry-model",
      kind: "document" as const,
      title: "多模态模型发布",
      content: "图像生成模型新增了编辑能力。",
      sourceDocumentId: "doc-model",
    },
  ];

  it("ranks relevant saved knowledge and deduplicates a source document", () => {
    const result = rankRelevantDistillKnowledge({
      sourceTitle: "如何让 Agent 根据工具错误自我修正",
      paragraphs: ["工具反馈不应只返回成功或失败，还要给出 stderr。"],
      privateContext: ["正在设计 Agent 工作流"],
      candidates,
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "card-agent",
      sourceDocumentId: "doc-agent",
      reference: "K1",
    });
  });

  it("does not manufacture a match from generic wording", () => {
    const result = rankRelevantDistillKnowledge({
      sourceTitle: "一份产品更新",
      paragraphs: ["这篇文章提供了一些相关信息。"],
      privateContext: [],
      candidates,
    });

    expect(result).toEqual([]);
  });
});
