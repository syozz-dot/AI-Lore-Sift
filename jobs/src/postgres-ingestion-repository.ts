import {
  items,
  sourceRuns,
  sources,
  type Database,
} from "@ai-news-navigator/database";
import type {
  IngestionRepository,
  NormalizedItem,
  SourceRunResult,
} from "@ai-news-navigator/pipeline";
import type { SourceDefinition } from "@ai-news-navigator/sources";
import { and, eq, or, sql } from "drizzle-orm";

export interface SyncedSource {
  id: string;
  lastSuccessAt: Date | null;
}

export async function syncSourceDefinition(
  db: Database,
  definition: SourceDefinition,
): Promise<SyncedSource> {
  const now = new Date();
  const [source] = await db
    .insert(sources)
    .values({
      slug: definition.key,
      name: definition.name,
      type: definition.type,
      reliability: definition.reliability,
      language: definition.language ?? null,
      homepageUrl: definition.homepageUrl,
      feedUrl: definition.feedUrl ?? null,
      connectorKey: definition.connectorKey,
      fetchIntervalMinutes: definition.fetchIntervalMinutes,
      isFirstParty: definition.isFirstParty,
      allowFullText: definition.allowFullText,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: sources.slug,
      set: {
        name: definition.name,
        type: definition.type,
        reliability: definition.reliability,
        language: definition.language ?? null,
        homepageUrl: definition.homepageUrl,
        feedUrl: definition.feedUrl ?? null,
        connectorKey: definition.connectorKey,
        fetchIntervalMinutes: definition.fetchIntervalMinutes,
        isFirstParty: definition.isFirstParty,
        allowFullText: definition.allowFullText,
        updatedAt: now,
      },
    })
    .returning({ id: sources.id, lastSuccessAt: sources.lastSuccessAt });

  if (!source) {
    throw new Error(`Could not synchronize source ${definition.key}`);
  }
  return source;
}

export class PostgresIngestionRepository implements IngestionRepository {
  constructor(private readonly db: Database) {}

  async startSourceRun(input: {
    sourceId: string;
    startedAt: Date;
  }): Promise<string> {
    const [run] = await this.db
      .insert(sourceRuns)
      .values({
        sourceId: input.sourceId,
        startedAt: input.startedAt,
        status: "running",
      })
      .returning({ id: sourceRuns.id });

    if (!run) {
      throw new Error(`Could not start source run for ${input.sourceId}`);
    }
    return run.id;
  }

  async upsertItem(
    item: NormalizedItem,
  ): Promise<{ id: string; created: boolean }> {
    const [inserted] = await this.db
      .insert(items)
      .values(item)
      .onConflictDoNothing()
      .returning({ id: items.id });

    if (inserted) {
      return { id: inserted.id, created: true };
    }

    const externalIdMatch = item.externalId
      ? and(
          eq(items.sourceId, item.sourceId),
          eq(items.externalId, item.externalId),
        )
      : undefined;
    const [existing] = await this.db
      .select({ id: items.id })
      .from(items)
      .where(
        externalIdMatch
          ? or(
              eq(items.canonicalUrlHash, item.canonicalUrlHash),
              externalIdMatch,
            )
          : eq(items.canonicalUrlHash, item.canonicalUrlHash),
      )
      .limit(1);

    if (!existing) {
      throw new Error(
        "Item conflicted but the existing row could not be found",
      );
    }

    await this.db
      .update(items)
      .set({
        title: item.title,
        originalTitle: item.originalTitle,
        excerpt: item.excerpt,
        content: item.content,
        contentFormat: item.contentFormat,
        mediaAssets: item.mediaAssets,
        contentHash: item.contentHash,
        author: item.author,
        language: item.language,
        sourcePublishedAt: item.sourcePublishedAt,
        publicationTimeConfidence: item.publicationTimeConfidence,
        fetchedAt: item.fetchedAt,
        rawMetadata: item.rawMetadata,
        updatedAt: item.fetchedAt,
      })
      .where(eq(items.id, existing.id));

    return { id: existing.id, created: false };
  }

  async finishSourceRun(
    runId: string,
    result: SourceRunResult & { finishedAt: Date },
  ): Promise<void> {
    await this.db.transaction(async (transaction) => {
      const [run] = await transaction
        .select({ sourceId: sourceRuns.sourceId })
        .from(sourceRuns)
        .where(eq(sourceRuns.id, runId))
        .limit(1);

      if (!run) {
        throw new Error(`Unknown source run: ${runId}`);
      }

      await transaction
        .update(sourceRuns)
        .set({
          status: result.status,
          finishedAt: result.finishedAt,
          fetchedCount: result.fetchedCount,
          storedCount: result.storedCount,
          duplicateCount: result.duplicateCount,
          failedCount: result.failedCount,
          errorMessage: result.errorMessage,
        })
        .where(eq(sourceRuns.id, runId));

      if (result.status === "failed") {
        await transaction
          .update(sources)
          .set({
            status: "degraded",
            lastFailureAt: result.finishedAt,
            consecutiveFailures: sql`${sources.consecutiveFailures} + 1`,
            updatedAt: result.finishedAt,
          })
          .where(eq(sources.id, run.sourceId));
        return;
      }

      await transaction
        .update(sources)
        .set({
          status: result.status === "partial" ? "degraded" : "active",
          lastSuccessAt: result.finishedAt,
          consecutiveFailures: 0,
          updatedAt: result.finishedAt,
        })
        .where(eq(sources.id, run.sourceId));
    });
  }
}
