import { ArrowRight, CheckCircle } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

import type { StoryFeedItem } from "../lib/queries";
import {
  categoryScoreLabel,
  contentTypeLabels,
  formatDateTime,
  formatScore,
  selectFeedInterpretation,
  signalLabel,
  storyStatusLabels,
} from "../lib/presentation";

export function StoryRow({
  story,
  index,
}: {
  story: StoryFeedItem;
  index: number;
}) {
  const score = story.categoryScore;
  const interpretation = selectFeedInterpretation(story);
  const displayTitle = story.translatedTitle ?? story.title;
  const typeLabel = story.contentType
    ? contentTypeLabels[story.contentType]
    : "情报";

  return (
    <article className="storyRow">
      <div className="storyIndex" aria-hidden="true">
        {String(index + 1).padStart(2, "0")}
      </div>
      <div className="storyHeadline">
        <Link className="storyTitleLink" href={`/stories/${story.slug}`}>
          <h2>
            <span className="storyTypeTag">{typeLabel}</span>
            {displayTitle}
          </h2>
        </Link>
        <div className="storySignals" aria-label="筛选线索">
          <span className="storySignalLabel">筛选线索</span>
          {story.topics.slice(0, 2).map((topic) => (
            <span key={topic}>{topic}</span>
          ))}
          {story.matchedSignals.slice(0, 2).map((signal) => (
            <span key={signal}>{signalLabel(signal)}</span>
          ))}
          <span>{story.independentSourceCount} 个独立信源</span>
        </div>
      </div>
      <div className="storyDistill">
        {interpretation ? (
          <p>{interpretation}</p>
        ) : (
          <p className="interpretationPending">尚无中文解读</p>
        )}
        {story.status === "confirmed" ? (
          <div className="storyEvidenceState">
            <CheckCircle aria-hidden="true" size={16} weight="fill" />
            <span>{storyStatusLabels[story.status]}</span>
          </div>
        ) : null}
      </div>
      <div className="storyMetaCells">
        <strong className="storySource">
          {story.sourceName ?? "未知信源"}
        </strong>
        <span aria-hidden="true">/</span>
        <time
          className="storyTime"
          dateTime={story.lastPublishedAt?.toISOString()}
        >
          {formatDateTime(story.lastPublishedAt)}
        </time>
      </div>
      <Link
        className="storyScoreLink"
        href={`/stories/${story.slug}`}
        aria-label={`阅读 ${displayTitle}，${categoryScoreLabel(story.contentType)} ${formatScore(score)}`}
      >
        <span>{formatScore(score)}</span>
        <ArrowRight aria-hidden="true" size={18} weight="regular" />
      </Link>
    </article>
  );
}
