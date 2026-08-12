"use client";

import { useEffect, useState } from "react";

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

export function DistillPersonalizationSection({
  documentId,
}: {
  documentId: string;
}) {
  const [personalization, setPersonalization] = useState<{
    requested: boolean;
    insights: PrivatePersonalizedInsight[];
    error: string | null;
  } | null>(null);

  useEffect(() => {
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
  }, [documentId]);

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
                  <small>
                    {insight.basis === "both"
                      ? "画像 + 确认记忆"
                      : insight.basis === "memory"
                        ? "确认记忆"
                        : "私人画像"}
                  </small>
                </div>
                <h3>{insight.title}</h3>
                <p>{insight.detail}</p>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
