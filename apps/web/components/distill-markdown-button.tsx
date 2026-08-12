"use client";

import { Check, FileMd } from "@phosphor-icons/react";
import { useState } from "react";

import {
  buildDistillMarkdown,
  type DistillMarkdownInput,
} from "../lib/distill-markdown";
import { readPrivatePersonalization } from "../lib/private-workspace";

export function DistillMarkdownButton({
  document,
}: {
  document: DistillMarkdownInput;
}) {
  const [exported, setExported] = useState(false);

  async function download() {
    const personalization = await readPrivatePersonalization(document.id).catch(
      () => null,
    );
    const content = buildDistillMarkdown(
      {
        ...document,
        personalizedInsights: personalization?.insights ?? [],
      },
      window.location.href,
    );
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement("a");
    link.href = url;
    link.download = `distill-${document.id}.md`;
    window.document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setExported(true);
    window.setTimeout(() => setExported(false), 1_800);
  }

  return (
    <button className="distillUtilityButton" type="button" onClick={download}>
      {exported ? (
        <Check aria-hidden="true" size={17} weight="bold" />
      ) : (
        <FileMd aria-hidden="true" size={17} />
      )}
      {exported ? "已导出" : "导出 Markdown"}
    </button>
  );
}
