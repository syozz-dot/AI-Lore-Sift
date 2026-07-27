import {
  distillAnalyses,
  distillDocuments,
  knowledgeEntries,
  type NewDistillAnalysis,
  type NewDistillDocument,
} from "@ai-news-navigator/database";
import { and, desc, eq } from "drizzle-orm";

import { getDatabaseConnection } from "./database";

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

export async function listDistillDocuments(ownerId: string, limit = 18) {
  const { db } = getDatabaseConnection();
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
    .where(eq(distillDocuments.ownerId, ownerId))
    .orderBy(desc(distillDocuments.createdAt))
    .limit(limit);
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

export async function listKnowledgeEntries(ownerId: string, limit = 40) {
  const { db } = getDatabaseConnection();
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
    .where(eq(knowledgeEntries.ownerId, ownerId))
    .orderBy(desc(knowledgeEntries.createdAt))
    .limit(limit);
}
