import {
  CheckCircle,
  FileMagnifyingGlass,
  ListMagnifyingGlass,
  Sparkle,
} from "@phosphor-icons/react/dist/ssr";

export function DistillProcessPanel({
  sourceType,
  paragraphCount,
  compact = false,
}: {
  sourceType: string;
  paragraphCount: number;
  compact?: boolean;
}) {
  const steps = [
    {
      icon: FileMagnifyingGlass,
      title: sourceType === "url" ? "已读取网页正文" : "已读取粘贴正文",
      detail: `正文已清洗并拆分为 ${paragraphCount} 个可引用段落。`,
    },
    {
      icon: ListMagnifyingGlass,
      title: "已完成内容判断",
      detail: "区分事实、作者观点与谨慎推断，并给出阅读建议。",
    },
    {
      icon: Sparkle,
      title: "已生成知识提炼",
      detail: "导读、作者观点和可保存的知识卡片已整理完成，可继续追问。",
    },
  ];

  return (
    <details
      className={`distillProcessPanel${compact ? " distillProcessPanelCompact" : ""}`}
    >
      <summary>
        <span>
          <CheckCircle aria-hidden="true" size={18} weight="fill" />
          处理过程
        </span>
        <small>{steps.length} 步已完成</small>
      </summary>
      <div>
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <article key={step.title}>
              <Icon aria-hidden="true" size={18} />
              <span>
                <strong>{step.title}</strong>
                <small>{step.detail}</small>
              </span>
              <CheckCircle aria-hidden="true" size={17} weight="fill" />
            </article>
          );
        })}
      </div>
    </details>
  );
}
