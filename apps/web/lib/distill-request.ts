import type { DistillPersonalizationContext } from "./distill-analysis";
import type { DistillKnowledgeCandidate } from "./distill-retrieval";
import { rankRelevantDistillKnowledge } from "./distill-retrieval";

interface LocalKnowledgeInput {
  id?: unknown;
  title?: unknown;
  content?: unknown;
  sourceDocumentId?: unknown;
}

function text(context: Record<string, unknown>, field: string, limit: number) {
  return typeof context[field] === "string"
    ? context[field].trim().slice(0, limit)
    : "";
}

export function parseDistillPersonalization(
  value: unknown,
): DistillPersonalizationContext | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const context = value as Record<string, unknown>;
  const memories = Array.isArray(context.memories)
    ? context.memories
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim().slice(0, 600))
        .filter(Boolean)
        .slice(0, 20)
    : [];
  const result = {
    purpose: text(context, "purpose", 2_000),
    directions: text(context, "directions", 2_000),
    currentContext: text(context, "currentContext", 2_000),
    preferredHelp: text(context, "preferredHelp", 2_000),
    boundaries: text(context, "boundaries", 2_000),
    memories,
    retrieveKnowledge: context.retrieveKnowledge === true,
  };
  return Object.values(result).some((item) =>
    Array.isArray(item) ? item.length : item,
  )
    ? result
    : null;
}

export function parseLocalKnowledge(
  value: unknown,
): DistillKnowledgeCandidate[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is LocalKnowledgeInput =>
      Boolean(item && typeof item === "object" && !Array.isArray(item)),
    )
    .map((item, index) => ({
      id:
        typeof item.id === "string"
          ? item.id.trim().slice(0, 128)
          : `local-${index + 1}`,
      kind: "card" as const,
      title:
        typeof item.title === "string"
          ? item.title.trim().slice(0, 180)
          : "本地知识卡片",
      content:
        typeof item.content === "string"
          ? item.content.trim().slice(0, 1_200)
          : "",
      sourceDocumentId:
        typeof item.sourceDocumentId === "string"
          ? item.sourceDocumentId.trim().slice(0, 128)
          : `local-${index + 1}`,
    }))
    .filter((item) => item.content)
    .slice(0, 30);
}

export function attachLocalKnowledge(input: {
  personalization: DistillPersonalizationContext | null;
  localKnowledge: DistillKnowledgeCandidate[];
  sourceTitle: string | null;
  paragraphs: string[];
}) {
  if (!input.personalization?.retrieveKnowledge) return input.personalization;
  return {
    ...input.personalization,
    retrievedKnowledge: rankRelevantDistillKnowledge({
      sourceTitle: input.sourceTitle,
      paragraphs: input.paragraphs,
      privateContext: [
        input.personalization.purpose,
        input.personalization.directions,
        input.personalization.currentContext,
        input.personalization.preferredHelp,
        ...input.personalization.memories,
      ],
      candidates: input.localKnowledge,
    }),
  };
}
