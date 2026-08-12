import {
  distillAnalyses,
  distillDocuments,
  distillMessages,
  knowledgeCards,
  knowledgeEntries,
  type NewDistillAnalysis,
  type NewDistillDocument,
} from "@ai-news-navigator/database";
import { and, asc, desc, eq, ilike, or } from "drizzle-orm";

import { getDatabaseConnection } from "./database";
import {
  normalizePrivateSearchQuery,
  privateSearchPattern,
} from "./distill-search";
import type { DistillKnowledgeCandidate } from "./distill-retrieval";

export async function createDistillDocument(input: NewDistillDocument) {
  const { db } = getDatabaseConnection();
  const [document] = await db
    .insert(distillDocuments)
    .values(input)
    .returning({ id: distillDocuments.id });
  if (!document) throw new Error("无法创建脱水任务。");
  return document.id;
}

export async function completeDistillDocument(
  documentId: string,
  analysis: NewDistillAnalysis,
) {
  const { db } = getDatabaseConnection();
  await db.transaction(async (transaction) => {
    await transaction.insert(distillAnalyses).values(analysis);
    await transaction
      .update(distillDocuments)
      .set({
        status: "ready",
        errorMessage: null,
        billableUnits: 1,
        updatedAt: new Date(),
      })
      .where(eq(distillDocuments.id, documentId));
  });
}

export async function failDistillDocument(
  documentId: string,
  errorMessage: string,
) {
  const { db } = getDatabaseConnection();
  await db
    .update(distillDocuments)
    .set({
      status: "failed",
      errorMessage: errorMessage.slice(0, 1_000),
      updatedAt: new Date(),
    })
    .where(eq(distillDocuments.id, documentId));
}

export async function listDistillDocuments(
  ownerId: string,
  limit = 18,
  query = "",
) {
  const { db } = getDatabaseConnection();
  const normalizedQuery = normalizePrivateSearchQuery(query);
  const pattern = privateSearchPattern(normalizedQuery);
  const searchCondition = normalizedQuery
    ? or(
        ilike(distillDocuments.sourceTitle, pattern!),
        ilike(distillAnalyses.title, pattern!),
        ilike(distillAnalyses.summary, pattern!),
      )
    : undefined;
  return db
    .select({
      id: distillDocuments.id,
      sourceType: distillDocuments.sourceType,
      sourceUrl: distillDocuments.sourceUrl,
      sourceTitle: distillDocuments.sourceTitle,
      status: distillDocuments.status,
      errorMessage: distillDocuments.errorMessage,
      inputCharacters: distillDocuments.inputCharacters,
      createdAt: distillDocuments.createdAt,
      title: distillAnalyses.title,
      verdict: distillAnalyses.verdict,
      summary: distillAnalyses.summary,
      savedAt: knowledgeEntries.createdAt,
    })
    .from(distillDocuments)
    .leftJoin(
      distillAnalyses,
      eq(distillAnalyses.documentId, distillDocuments.id),
    )
    .leftJoin(
      knowledgeEntries,
      and(
        eq(knowledgeEntries.documentId, distillDocuments.id),
        eq(knowledgeEntries.ownerId, ownerId),
      ),
    )
    .where(
      searchCondition
        ? and(eq(distillDocuments.ownerId, ownerId), searchCondition)
        : eq(distillDocuments.ownerId, ownerId),
    )
    .orderBy(desc(distillDocuments.createdAt))
    .limit(limit);
}

export async function listDistillMessages(ownerId: string, documentId: string) {
  const { db } = getDatabaseConnection();
  return db
    .select({
      id: distillMessages.id,
      role: distillMessages.role,
      content: distillMessages.content,
      createdAt: distillMessages.createdAt,
    })
    .from(distillMessages)
    .where(
      and(
        eq(distillMessages.ownerId, ownerId),
        eq(distillMessages.documentId, documentId),
      ),
    )
    .orderBy(asc(distillMessages.createdAt));
}

export async function createDistillMessage(input: {
  ownerId: string;
  documentId: string;
  role: "user" | "assistant";
  content: string;
}) {
  const { db } = getDatabaseConnection();
  const [message] = await db.insert(distillMessages).values(input).returning({
    id: distillMessages.id,
    role: distillMessages.role,
    content: distillMessages.content,
    createdAt: distillMessages.createdAt,
  });
  if (!message) throw new Error("无法保存本次追问。");
  return message;
}

export async function getDistillDocument(ownerId: string, id: string) {
  const { db } = getDatabaseConnection();
  const [row] = await db
    .select({
      id: distillDocuments.id,
      sourceType: distillDocuments.sourceType,
      sourceUrl: distillDocuments.sourceUrl,
      sourceTitle: distillDocuments.sourceTitle,
      sourceAuthor: distillDocuments.sourceAuthor,
      rawText: distillDocuments.rawText,
      inputCharacters: distillDocuments.inputCharacters,
      status: distillDocuments.status,
      errorMessage: distillDocuments.errorMessage,
      createdAt: distillDocuments.createdAt,
      analysis: {
        title: distillAnalyses.title,
        verdict: distillAnalyses.verdict,
        verdictReason: distillAnalyses.verdictReason,
        estimatedReadingMinutes: distillAnalyses.estimatedReadingMinutes,
        summary: distillAnalyses.summary,
        keyPoints: distillAnalyses.keyPoints,
        claims: distillAnalyses.claims,
        transferableInsights: distillAnalyses.transferableInsights,
        cautions: distillAnalyses.cautions,
        followUpQuestions: distillAnalyses.followUpQuestions,
        provider: distillAnalyses.provider,
        model: distillAnalyses.model,
        promptVersion: distillAnalyses.promptVersion,
      },
      knowledgeEntryId: knowledgeEntries.id,
    })
    .from(distillDocuments)
    .leftJoin(
      distillAnalyses,
      eq(distillAnalyses.documentId, distillDocuments.id),
    )
    .leftJoin(
      knowledgeEntries,
      and(
        eq(knowledgeEntries.documentId, distillDocuments.id),
        eq(knowledgeEntries.ownerId, ownerId),
      ),
    )
    .where(
      and(eq(distillDocuments.id, id), eq(distillDocuments.ownerId, ownerId)),
    )
    .limit(1);
  if (!row) return null;
  return {
    ...row,
    analysis: row.analysis?.title ? row.analysis : null,
  };
}

export async function saveDistillToKnowledge(ownerId: string, id: string) {
  const document = await getDistillDocument(ownerId, id);
  if (!document?.analysis || document.status !== "ready") {
    throw new Error("只有已经完成的脱水内容可以存入知识库。");
  }
  const { db } = getDatabaseConnection();
  const [entry] = await db
    .insert(knowledgeEntries)
    .values({
      ownerId,
      documentId: id,
      title: document.analysis.title,
      summary: document.analysis.summary,
      tags: [],
    })
    .onConflictDoUpdate({
      target: [knowledgeEntries.ownerId, knowledgeEntries.documentId],
      set: {
        title: document.analysis.title,
        summary: document.analysis.summary,
        updatedAt: new Date(),
      },
    })
    .returning({ id: knowledgeEntries.id });
  return entry?.id ?? null;
}

export async function removeDistillFromKnowledge(ownerId: string, id: string) {
  const { db } = getDatabaseConnection();
  await db
    .delete(knowledgeEntries)
    .where(
      and(
        eq(knowledgeEntries.ownerId, ownerId),
        eq(knowledgeEntries.documentId, id),
      ),
    );
}

function knowledgeCardTitle(content: string) {
  const firstSentence =
    content.split(/[。！？!?；;\n]/, 1)[0]?.trim() || content;
  return firstSentence.length > 42
    ? `${firstSentence.slice(0, 41)}…`
    : firstSentence;
}

export async function listSavedKnowledgeCardIndexes(
  ownerId: string,
  documentId: string,
) {
  const { db } = getDatabaseConnection();
  const rows = await db
    .select({ insightIndex: knowledgeCards.insightIndex })
    .from(knowledgeCards)
    .where(
      and(
        eq(knowledgeCards.ownerId, ownerId),
        eq(knowledgeCards.documentId, documentId),
      ),
    );
  return rows.map((row) => row.insightIndex);
}

export async function saveKnowledgeCard(
  ownerId: string,
  documentId: string,
  insightIndex: number,
) {
  const document = await getDistillDocument(ownerId, documentId);
  const insight = document?.analysis?.transferableInsights[insightIndex];
  if (!document?.analysis || document.status !== "ready" || !insight) {
    throw new Error("这条知识还不能保存。");
  }

  const { db } = getDatabaseConnection();
  const [card] = await db
    .insert(knowledgeCards)
    .values({
      ownerId,
      documentId,
      insightIndex,
      title: knowledgeCardTitle(insight),
      content: insight,
    })
    .onConflictDoUpdate({
      target: [
        knowledgeCards.ownerId,
        knowledgeCards.documentId,
        knowledgeCards.insightIndex,
      ],
      set: {
        title: knowledgeCardTitle(insight),
        content: insight,
        updatedAt: new Date(),
      },
    })
    .returning({ id: knowledgeCards.id });
  return card?.id ?? null;
}

export async function removeKnowledgeCard(
  ownerId: string,
  documentId: string,
  insightIndex: number,
) {
  const { db } = getDatabaseConnection();
  await db
    .delete(knowledgeCards)
    .where(
      and(
        eq(knowledgeCards.ownerId, ownerId),
        eq(knowledgeCards.documentId, documentId),
        eq(knowledgeCards.insightIndex, insightIndex),
      ),
    );
}

export async function deleteDistillDocument(ownerId: string, id: string) {
  const { db } = getDatabaseConnection();
  const [deleted] = await db
    .delete(distillDocuments)
    .where(
      and(eq(distillDocuments.id, id), eq(distillDocuments.ownerId, ownerId)),
    )
    .returning({ id: distillDocuments.id });
  return Boolean(deleted);
}

export async function listKnowledgeEntries(
  ownerId: string,
  limit = 40,
  query = "",
) {
  const { db } = getDatabaseConnection();
  const normalizedQuery = normalizePrivateSearchQuery(query);
  const pattern = privateSearchPattern(normalizedQuery);
  const searchCondition = normalizedQuery
    ? or(
        ilike(knowledgeEntries.title, pattern!),
        ilike(knowledgeEntries.summary, pattern!),
        ilike(distillDocuments.sourceTitle, pattern!),
      )
    : undefined;
  return db
    .select({
      id: knowledgeEntries.id,
      documentId: knowledgeEntries.documentId,
      title: knowledgeEntries.title,
      summary: knowledgeEntries.summary,
      tags: knowledgeEntries.tags,
      createdAt: knowledgeEntries.createdAt,
      sourceType: distillDocuments.sourceType,
      sourceUrl: distillDocuments.sourceUrl,
      sourceTitle: distillDocuments.sourceTitle,
    })
    .from(knowledgeEntries)
    .innerJoin(
      distillDocuments,
      eq(distillDocuments.id, knowledgeEntries.documentId),
    )
    .where(
      searchCondition
        ? and(eq(knowledgeEntries.ownerId, ownerId), searchCondition)
        : eq(knowledgeEntries.ownerId, ownerId),
    )
    .orderBy(desc(knowledgeEntries.createdAt))
    .limit(limit);
}

export async function listKnowledgeCards(
  ownerId: string,
  limit = 60,
  query = "",
) {
  const { db } = getDatabaseConnection();
  const normalizedQuery = normalizePrivateSearchQuery(query);
  const pattern = privateSearchPattern(normalizedQuery);
  const searchCondition = normalizedQuery
    ? or(
        ilike(knowledgeCards.title, pattern!),
        ilike(knowledgeCards.content, pattern!),
        ilike(distillDocuments.sourceTitle, pattern!),
        ilike(distillAnalyses.title, pattern!),
      )
    : undefined;
  return db
    .select({
      id: knowledgeCards.id,
      documentId: knowledgeCards.documentId,
      insightIndex: knowledgeCards.insightIndex,
      title: knowledgeCards.title,
      content: knowledgeCards.content,
      createdAt: knowledgeCards.createdAt,
      sourceType: distillDocuments.sourceType,
      sourceUrl: distillDocuments.sourceUrl,
      sourceTitle: distillDocuments.sourceTitle,
      documentTitle: distillAnalyses.title,
    })
    .from(knowledgeCards)
    .innerJoin(
      distillDocuments,
      eq(distillDocuments.id, knowledgeCards.documentId),
    )
    .leftJoin(
      distillAnalyses,
      eq(distillAnalyses.documentId, knowledgeCards.documentId),
    )
    .where(
      searchCondition
        ? and(eq(knowledgeCards.ownerId, ownerId), searchCondition)
        : eq(knowledgeCards.ownerId, ownerId),
    )
    .orderBy(desc(knowledgeCards.createdAt))
    .limit(limit);
}

export async function listDistillKnowledgeCandidates(
  ownerId: string,
): Promise<DistillKnowledgeCandidate[]> {
  const [cards, entries] = await Promise.all([
    listKnowledgeCards(ownerId, 120),
    listKnowledgeEntries(ownerId, 80),
  ]);
  return [
    ...cards.map((card) => ({
      id: card.id,
      kind: "card" as const,
      title: card.title,
      content: card.content,
      sourceDocumentId: card.documentId,
    })),
    ...entries.map((entry) => ({
      id: entry.id,
      kind: "document" as const,
      title: entry.title,
      content: entry.summary,
      sourceDocumentId: entry.documentId,
    })),
  ];
}
