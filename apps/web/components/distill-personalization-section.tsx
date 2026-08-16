"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import {
  readPrivatePersonalization,
  type PrivatePersonalizedInsight,
} from "../lib/private-workspace";

function paragraphReference(numbers: number[]) {
  return [...new Set(numbers)]
    .sort((left, right) => left - right)
    .map((number) => `P${number}`)
    .join("、");
}

function basisLabel(insight: PrivatePersonalizedInsight) {
  if (insight.basis === "knowledge") return "历史知识";
  if (insight.basis === "mixed") return "画像 + 记忆 + 历史知识";
  if (insight.basis === "both") return "画像 + 确认记忆";
  if (insight.basis === "memory") return "确认记忆";
  return "私人画像";
}

export function DistillPersonalizationSection({
  documentId,
  local = false,
  initialPersonalization = null,
}: {
  documentId: string;
  local?: boolean;
  initialPersonalization?: {
    requested: boolean;
    insights: PrivatePersonalizedInsight[];
    error: string | null;
  } | null;
}) {
  const [personalization, setPersonalization] = useState<{
    requested: boolean;
    insights: PrivatePersonalizedInsight[];
    error: string | null;
  } | null>(initialPersonalization);

  useEffect(() => {
    if (initialPersonalization) return;
    const fallbackError = window.sessionStorage.getItem(
      `ann-personalization-status:${documentId}`,
    );
    readPrivatePersonalization(documentId)
      .then((value) =>
        setPersonalization(
          value.requested || !fallbackError
            ? value
            : { requested: true, insights: [], error: fallbackError },
        ),
      )
      .catch(() =>
        setPersonalization({
          requested: Boolean(fallbackError),
          insights: [],
          error: fallbackError,
        }),
      );
  }, [documentId, initialPersonalization]);

  if (!personalization?.requested) return null;

  return (
    <section className="distillResultModule distillPersonalModule">
      <header className="distillModuleHeading">
        <span>私人</span>
        <h2>与你有关</h2>
        <p>仅保存在当前浏览器，不进入服务器脱水记录</p>
      </header>
      <div className="distillModuleContent">
        {personalization.error || !personalization.insights.length ? (
          <p className="distillNoPersonalMatch">
            {personalization.error ??
              "没有找到足够具体的关联，本次不为个性化而硬凑结论。"}
          </p>
        ) : (
          <div className="distillPersonalInsights">
            {personalization.insights.map((insight, index) => (
              <article key={`${insight.title}-${index}`}>
                <div>
                  <span>{paragraphReference(insight.evidenceParagraphs)}</span>
                  <small>{basisLabel(insight)}</small>
                </div>
                <h3>{insight.title}</h3>
                <p>{insight.detail}</p>
                {insight.knowledgeReferences?.length ? (
                  <aside aria-label="引用的历史知识">
                    <strong>关联历史</strong>
                    <div>
                      {insight.knowledgeReferences.map((reference) => (
                        <Link
                          key={`${reference.kind}-${reference.id}`}
                          href={
                            local
                              ? `/distill?local=${encodeURIComponent(reference.sourceDocumentId)}`
                              : `/distill/${reference.sourceDocumentId}`
                          }
                        >
                          {reference.title}
                        </Link>
                      ))}
                    </div>
                  </aside>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
