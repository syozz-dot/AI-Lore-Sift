import {
  ChatCircleText,
  CheckCircle,
  MagnifyingGlass,
  Plus,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

interface DistillTask {
  id: string;
  status: string;
  title: string | null;
  sourceTitle: string | null;
  createdAt: Date;
}

function formatTaskDate(value: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

export function DistillTaskList({
  documents,
  currentId,
  searchQuery = "",
}: {
  documents: DistillTask[];
  currentId?: string;
  searchQuery?: string;
}) {
  return (
    <aside className="distillTaskRail" aria-label="脱水任务">
      <div className="distillTaskRailHeader">
        <div>
          <p>任务记录</p>
          <strong>{documents.length} 篇</strong>
        </div>
        <Link href="/distill" prefetch={true} aria-label="新建脱水任务">
          <Plus aria-hidden="true" size={17} />
        </Link>
      </div>
      <form className="distillTaskSearch" action="/distill" method="get">
        <MagnifyingGlass aria-hidden="true" size={14} />
        <input
          name="q"
          type="search"
          maxLength={120}
          defaultValue={searchQuery}
          placeholder="搜索历史任务"
          aria-label="搜索历史任务"
        />
      </form>
      <nav>
        {documents.map((document) => {
          const active = document.id === currentId;
          return (
            <Link
              key={document.id}
              href={`/distill/${document.id}`}
              prefetch={true}
              className={active ? "isActive" : undefined}
              aria-current={active ? "page" : undefined}
            >
              {document.status === "ready" ? (
                <CheckCircle aria-hidden="true" size={16} weight="fill" />
              ) : (
                <ChatCircleText aria-hidden="true" size={16} />
              )}
              <span>
                <strong>
                  {document.title || document.sourceTitle || "未命名任务"}
                </strong>
                <small>{formatTaskDate(document.createdAt)}</small>
              </span>
            </Link>
          );
        })}
      </nav>
      {!documents.length ? (
        <div className="distillTaskRailEmpty">
          <ChatCircleText aria-hidden="true" size={20} />
          <span>{searchQuery ? "没有匹配的历史任务" : "还没有历史任务"}</span>
        </div>
      ) : null}
    </aside>
  );
}
