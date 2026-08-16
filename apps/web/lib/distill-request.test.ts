import { describe, expect, it } from "vitest";

import {
  attachLocalKnowledge,
  parseDistillPersonalization,
  parseLocalKnowledge,
} from "./distill-request";

describe("public distill request normalization", () => {
  it("bounds explicit private context and ignores malformed knowledge", () => {
    const personalization = parseDistillPersonalization({
      purpose: "研究 Agent 工作流",
      memories: ["只保留用户确认的信息", 42, ""],
      retrieveKnowledge: true,
    });
    const knowledge = parseLocalKnowledge([
      {
        id: "card-1",
        title: "Agent 安全约束",
        content: "高风险动作需要 Host 层权限校验与人工确认。",
        sourceDocumentId: "doc-1",
      },
      { title: "空内容" },
      "not-an-object",
    ]);

    expect(personalization?.memories).toEqual(["只保留用户确认的信息"]);
    expect(knowledge).toHaveLength(1);
    expect(knowledge[0]?.id).toBe("card-1");
  });

  it("retrieves only relevant browser-local knowledge", () => {
    const personalization = parseDistillPersonalization({
      directions: "Agent 安全",
      retrieveKnowledge: true,
    });
    const result = attachLocalKnowledge({
      personalization,
      localKnowledge: [
        {
          id: "card-1",
          kind: "card",
          title: "Agent 安全约束",
          content: "Agent 高风险动作必须经过 Host 权限校验。",
          sourceDocumentId: "doc-1",
        },
        {
          id: "card-2",
          kind: "card",
          title: "前端排版",
          content: "正文行高应保持稳定。",
          sourceDocumentId: "doc-2",
        },
      ],
      sourceTitle: "Agent 权限与安全设计",
      paragraphs: ["文章讨论 Agent 执行高风险动作时的权限校验。"],
    });

    expect(result?.retrievedKnowledge).toHaveLength(1);
    expect(result?.retrievedKnowledge?.[0]).toMatchObject({
      reference: "K1",
      id: "card-1",
    });
  });
});
