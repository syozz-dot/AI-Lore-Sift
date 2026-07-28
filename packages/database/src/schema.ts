import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const sourceTypeEnum = pgEnum("source_type", [
  "official_blog",
  "rss",
  "arxiv",
  "github",
  "product_hunt",
  "hacker_news",
  "media",
  "social",
  "other",
]);

export const sourceReliabilityEnum = pgEnum("source_reliability", [
  "primary",
  "high",
  "medium",
  "low",
]);

export const sourceStatusEnum = pgEnum("source_status", [
  "active",
  "degraded",
  "disabled",
]);

export const sourceRunStatusEnum = pgEnum("source_run_status", [
  "running",
  "succeeded",
  "partial",
  "failed",
]);

export const contentTypeEnum = pgEnum("content_type", [
  "news",
  "paper",
  "product",
  "model",
  "release",
  "post",
  "other",
]);

export const publicationTimeConfidenceEnum = pgEnum(
  "publication_time_confidence",
  ["exact", "inferred", "unknown"],
);

export const contentFormatEnum = pgEnum("content_format", ["text", "html"]);

export const itemStatusEnum = pgEnum("item_status", [
  "normalized",
  "processed",
  "failed",
  "ignored",
]);

export const storyStatusEnum = pgEnum("story_status", [
  "emerging",
  "confirmed",
  "cooling",
  "corrected",
  "archived",
]);

export const storyItemRoleEnum = pgEnum("story_item_role", [
  "primary",
  "supporting",
  "duplicate",
  "context",
]);

export const topicTypeEnum = pgEnum("topic_type", [
  "company",
  "model",
  "technology",
  "content_type",
  "person",
  "other",
]);

export const reportTypeEnum = pgEnum("report_type", [
  "daily",
  "weekly",
  "monthly",
]);

export const distillSourceTypeEnum = pgEnum("distill_source_type", [
  "url",
  "text",
  "file",
  "youtube",
  "douyin",
  "wechat_channels",
  "other",
]);

export const distillStatusEnum = pgEnum("distill_status", [
  "processing",
  "ready",
  "failed",
]);

export interface DistillKeyPoint {
  title: string;
  detail: string;
  evidenceParagraphs: number[];
}

export interface DistillClaim {
  claim: string;
  type: "fact" | "author_view" | "inference";
  evidenceParagraphs: number[];
  confidence: "high" | "medium" | "low";
}

export interface ReportSnapshotStory {
  id: string;
  slug: string;
  title: string;
  summary: string;
  whyItMatters: string | null;
  sourceName: string;
  contentType: "news" | "paper" | "product" | "model";
  score: number;
  publishedAt: string | null;
}

export interface ReportSnapshotSection {
  type: ReportSnapshotStory["contentType"];
  label: string;
  editorialSummary: string | null;
  stories: ReportSnapshotStory[];
}

export interface ReportSnapshotContent {
  introduction: string | null;
  highlights: string[];
  sections: ReportSnapshotSection[];
}

export const sources = pgTable(
  "sources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: varchar("slug", { length: 128 }).notNull(),
    name: varchar("name", { length: 256 }).notNull(),
    type: sourceTypeEnum("type").notNull(),
    reliability: sourceReliabilityEnum("reliability")
      .default("medium")
      .notNull(),
    status: sourceStatusEnum("status").default("active").notNull(),
    language: varchar("language", { length: 16 }),
    homepageUrl: text("homepage_url"),
    feedUrl: text("feed_url"),
    connectorKey: varchar("connector_key", { length: 128 }).notNull(),
    fetchIntervalMinutes: integer("fetch_interval_minutes")
      .default(60)
      .notNull(),
    isFirstParty: boolean("is_first_party").default(false).notNull(),
    allowFullText: boolean("allow_full_text").default(false).notNull(),
    lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
    lastFailureAt: timestamp("last_failure_at", { withTimezone: true }),
    consecutiveFailures: integer("consecutive_failures").default(0).notNull(),
    leaseOwner: varchar("lease_owner", { length: 128 }),
    leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("sources_slug_unique").on(table.slug),
    index("sources_status_idx").on(table.status),
    index("sources_status_lease_idx").on(table.status, table.leaseExpiresAt),
    index("sources_connector_key_idx").on(table.connectorKey),
  ],
);

export const sourceRuns = pgTable(
  "source_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    status: sourceRunStatusEnum("status").default("running").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    fetchedCount: integer("fetched_count").default(0).notNull(),
    storedCount: integer("stored_count").default(0).notNull(),
    duplicateCount: integer("duplicate_count").default(0).notNull(),
    failedCount: integer("failed_count").default(0).notNull(),
    errorMessage: text("error_message"),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
  },
  (table) => [
    index("source_runs_source_started_idx").on(table.sourceId, table.startedAt),
    index("source_runs_status_idx").on(table.status),
  ],
);

export const jobLeases = pgTable("job_leases", {
  key: varchar("key", { length: 128 }).primaryKey(),
  owner: varchar("owner", { length: 128 }).notNull(),
  leaseExpiresAt: timestamp("lease_expires_at", {
    withTimezone: true,
  }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const analysisRuns = pgTable(
  "analysis_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    status: varchar("status", { length: 32 }).default("running").notNull(),
    configured: boolean("configured").default(false).notNull(),
    acquired: boolean("acquired").default(false).notNull(),
    provider: varchar("provider", { length: 64 }),
    model: varchar("model", { length: 128 }),
    attemptedCount: integer("attempted_count").default(0).notNull(),
    generatedCount: integer("generated_count").default(0).notNull(),
    skippedCount: integer("skipped_count").default(0).notNull(),
    failedCount: integer("failed_count").default(0).notNull(),
    errorMessages: text("error_messages").array().default([]).notNull(),
    startedAt: timestamp("started_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (table) => [
    index("analysis_runs_started_idx").on(table.startedAt),
    index("analysis_runs_status_idx").on(table.status),
  ],
);

export const items = pgTable(
  "items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "restrict" }),
    externalId: varchar("external_id", { length: 512 }),
    contentType: contentTypeEnum("content_type").notNull(),
    status: itemStatusEnum("status").default("normalized").notNull(),
    title: text("title").notNull(),
    originalTitle: text("original_title"),
    excerpt: text("excerpt"),
    content: text("content"),
    contentFormat: contentFormatEnum("content_format")
      .default("text")
      .notNull(),
    mediaAssets: jsonb("media_assets")
      .$type<
        Array<{
          type: "image" | "video" | "audio";
          url: string;
          previewUrl?: string;
          alt?: string;
          width?: number;
          height?: number;
        }>
      >()
      .default([])
      .notNull(),
    author: varchar("author", { length: 256 }),
    language: varchar("language", { length: 16 }),
    originalUrl: text("original_url").notNull(),
    canonicalUrl: text("canonical_url").notNull(),
    canonicalUrlHash: varchar("canonical_url_hash", { length: 64 }).notNull(),
    contentHash: varchar("content_hash", { length: 64 }).notNull(),
    sourcePublishedAt: timestamp("source_published_at", { withTimezone: true }),
    publicationTimeConfidence: publicationTimeConfidenceEnum(
      "publication_time_confidence",
    )
      .default("unknown")
      .notNull(),
    discoveredAt: timestamp("discovered_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    rawMetadata: jsonb("raw_metadata")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("items_canonical_url_hash_unique").on(table.canonicalUrlHash),
    uniqueIndex("items_source_external_id_unique").on(
      table.sourceId,
      table.externalId,
    ),
    index("items_source_published_idx").on(
      table.sourceId,
      table.sourcePublishedAt,
    ),
    index("items_content_type_published_idx").on(
      table.contentType,
      table.sourcePublishedAt,
    ),
    index("items_content_hash_idx").on(table.contentHash),
  ],
);

export const itemAssessments = pgTable(
  "item_assessments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    scorerVersion: varchar("scorer_version", { length: 64 }).notNull(),
    relevanceScore: real("relevance_score").notNull(),
    aiCentralityScore: real("ai_centrality_score").notNull(),
    productImpactScore: real("product_impact_score").notNull(),
    isRelevant: boolean("is_relevant").notNull(),
    matchedSignals: text("matched_signals").array().default([]).notNull(),
    reasons: text("reasons").array().default([]).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("item_assessments_item_scorer_unique").on(
      table.itemId,
      table.scorerVersion,
    ),
    index("item_assessments_scorer_relevant_idx").on(
      table.scorerVersion,
      table.isRelevant,
      table.relevanceScore,
    ),
  ],
);

export const stories = pgTable(
  "stories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: varchar("slug", { length: 256 }).notNull(),
    status: storyStatusEnum("status").default("emerging").notNull(),
    title: text("title").notNull(),
    factualSummary: text("factual_summary"),
    primaryItemId: uuid("primary_item_id").references(() => items.id, {
      onDelete: "set null",
    }),
    firstPublishedAt: timestamp("first_published_at", { withTimezone: true }),
    lastPublishedAt: timestamp("last_published_at", { withTimezone: true }),
    independentSourceCount: integer("independent_source_count")
      .default(1)
      .notNull(),
    freshnessScore: real("freshness_score"),
    evidenceScore: real("evidence_score"),
    relevanceScore: real("relevance_score"),
    overallScore: real("overall_score"),
    confidence: real("confidence"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("stories_slug_unique").on(table.slug),
    index("stories_status_score_idx").on(table.status, table.overallScore),
    index("stories_first_published_idx").on(table.firstPublishedAt),
  ],
);

export const storyItems = pgTable(
  "story_items",
  {
    storyId: uuid("story_id")
      .notNull()
      .references(() => stories.id, { onDelete: "cascade" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    role: storyItemRoleEnum("role").default("supporting").notNull(),
    similarity: real("similarity"),
    clusterVersion: varchar("cluster_version", { length: 64 }),
    matchReasons: text("match_reasons").array().default([]).notNull(),
    addedAt: timestamp("added_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("story_items_story_item_unique").on(
      table.storyId,
      table.itemId,
    ),
    index("story_items_item_idx").on(table.itemId),
  ],
);

export const topics = pgTable(
  "topics",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: varchar("slug", { length: 128 }).notNull(),
    name: varchar("name", { length: 256 }).notNull(),
    type: topicTypeEnum("type").notNull(),
    description: text("description"),
    aliases: text("aliases").array().default([]).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("topics_slug_unique").on(table.slug),
    index("topics_type_active_idx").on(table.type, table.isActive),
  ],
);

export const storyTopics = pgTable(
  "story_topics",
  {
    storyId: uuid("story_id")
      .notNull()
      .references(() => stories.id, { onDelete: "cascade" }),
    topicId: uuid("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    confidence: real("confidence"),
    assignedBy: varchar("assigned_by", { length: 64 })
      .default("system")
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("story_topics_story_topic_unique").on(
      table.storyId,
      table.topicId,
    ),
    index("story_topics_topic_idx").on(table.topicId),
  ],
);

export const storyAnalyses = pgTable(
  "story_analyses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storyId: uuid("story_id")
      .notNull()
      .references(() => stories.id, { onDelete: "cascade" }),
    translatedTitle: text("translated_title"),
    factualSummary: text("factual_summary").notNull(),
    whyItMatters: text("why_it_matters"),
    underlyingLogic: text("underlying_logic"),
    productImpact: text("product_impact"),
    productOpportunities: jsonb("product_opportunities")
      .$type<string[]>()
      .default([])
      .notNull(),
    openQuestions: jsonb("open_questions")
      .$type<string[]>()
      .default([])
      .notNull(),
    evidenceItemIds: uuid("evidence_item_ids").array().default([]).notNull(),
    confidence: real("confidence").notNull(),
    provider: varchar("provider", { length: 64 }).notNull(),
    model: varchar("model", { length: 128 }).notNull(),
    promptVersion: varchar("prompt_version", { length: 64 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("story_analyses_story_created_idx").on(
      table.storyId,
      table.createdAt,
    ),
  ],
);

export const reports = pgTable(
  "reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    type: reportTypeEnum("type").notNull(),
    periodKey: varchar("period_key", { length: 32 }).notNull(),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    title: text("title").notNull(),
    content: jsonb("content").$type<ReportSnapshotContent>().notNull(),
    storyCount: integer("story_count").default(0).notNull(),
    readingMinutes: integer("reading_minutes").default(1).notNull(),
    provider: varchar("provider", { length: 64 }),
    model: varchar("model", { length: 128 }),
    promptVersion: varchar("prompt_version", { length: 64 }),
    generatedAt: timestamp("generated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("reports_type_period_unique").on(table.type, table.periodKey),
    index("reports_type_period_start_idx").on(table.type, table.periodStart),
  ],
);

export const distillDocuments = pgTable(
  "distill_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: varchar("owner_id", { length: 128 }).notNull(),
    sourceType: distillSourceTypeEnum("source_type").notNull(),
    sourceUrl: text("source_url"),
    sourceTitle: text("source_title"),
    sourceAuthor: varchar("source_author", { length: 256 }),
    rawText: text("raw_text").notNull(),
    inputCharacters: integer("input_characters").notNull(),
    status: distillStatusEnum("status").default("processing").notNull(),
    errorMessage: text("error_message"),
    accessMode: varchar("access_mode", { length: 32 })
      .default("private")
      .notNull(),
    billableUnits: integer("billable_units").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("distill_documents_owner_created_idx").on(
      table.ownerId,
      table.createdAt,
    ),
    index("distill_documents_owner_status_idx").on(table.ownerId, table.status),
  ],
);

export const distillAnalyses = pgTable(
  "distill_analyses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => distillDocuments.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    verdict: varchar("verdict", { length: 16 }).notNull(),
    verdictReason: text("verdict_reason").notNull(),
    estimatedReadingMinutes: integer("estimated_reading_minutes")
      .default(1)
      .notNull(),
    summary: text("summary").notNull(),
    keyPoints: jsonb("key_points")
      .$type<DistillKeyPoint[]>()
      .default([])
      .notNull(),
    claims: jsonb("claims").$type<DistillClaim[]>().default([]).notNull(),
    transferableInsights: jsonb("transferable_insights")
      .$type<string[]>()
      .default([])
      .notNull(),
    cautions: jsonb("cautions").$type<string[]>().default([]).notNull(),
    followUpQuestions: jsonb("follow_up_questions")
      .$type<string[]>()
      .default([])
      .notNull(),
    provider: varchar("provider", { length: 64 }).notNull(),
    model: varchar("model", { length: 128 }).notNull(),
    promptVersion: varchar("prompt_version", { length: 64 }).notNull(),
    outputTokens: integer("output_tokens"),
    costMicros: integer("cost_micros"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("distill_analyses_document_unique").on(table.documentId),
    index("distill_analyses_created_idx").on(table.createdAt),
  ],
);

export const knowledgeEntries = pgTable(
  "knowledge_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: varchar("owner_id", { length: 128 }).notNull(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => distillDocuments.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    tags: text("tags").array().default([]).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("knowledge_entries_owner_document_unique").on(
      table.ownerId,
      table.documentId,
    ),
    index("knowledge_entries_owner_created_idx").on(
      table.ownerId,
      table.createdAt,
    ),
  ],
);

export const distillMessages = pgTable(
  "distill_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: varchar("owner_id", { length: 128 }).notNull(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => distillDocuments.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 16 }).notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("distill_messages_document_created_idx").on(
      table.documentId,
      table.createdAt,
    ),
    index("distill_messages_owner_created_idx").on(
      table.ownerId,
      table.createdAt,
    ),
  ],
);

export const knowledgeCards = pgTable(
  "knowledge_cards",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: varchar("owner_id", { length: 128 }).notNull(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => distillDocuments.id, { onDelete: "cascade" }),
    insightIndex: integer("insight_index").notNull(),
    title: text("title").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("knowledge_cards_owner_document_insight_unique").on(
      table.ownerId,
      table.documentId,
      table.insightIndex,
    ),
    index("knowledge_cards_owner_created_idx").on(
      table.ownerId,
      table.createdAt,
    ),
  ],
);

export type Source = typeof sources.$inferSelect;
export type NewSource = typeof sources.$inferInsert;
export type SourceRun = typeof sourceRuns.$inferSelect;
export type NewSourceRun = typeof sourceRuns.$inferInsert;
export type JobLease = typeof jobLeases.$inferSelect;
export type AnalysisRun = typeof analysisRuns.$inferSelect;
export type Item = typeof items.$inferSelect;
export type NewItem = typeof items.$inferInsert;
export type ItemAssessment = typeof itemAssessments.$inferSelect;
export type NewItemAssessment = typeof itemAssessments.$inferInsert;
export type Story = typeof stories.$inferSelect;
export type NewStory = typeof stories.$inferInsert;
export type Topic = typeof topics.$inferSelect;
export type NewTopic = typeof topics.$inferInsert;
export type Report = typeof reports.$inferSelect;
export type NewReport = typeof reports.$inferInsert;
export type DistillDocument = typeof distillDocuments.$inferSelect;
export type NewDistillDocument = typeof distillDocuments.$inferInsert;
export type DistillAnalysis = typeof distillAnalyses.$inferSelect;
export type NewDistillAnalysis = typeof distillAnalyses.$inferInsert;
export type KnowledgeEntry = typeof knowledgeEntries.$inferSelect;
export type DistillMessage = typeof distillMessages.$inferSelect;
export type NewDistillMessage = typeof distillMessages.$inferInsert;
export type KnowledgeCard = typeof knowledgeCards.$inferSelect;
export type NewKnowledgeCard = typeof knowledgeCards.$inferInsert;
export type NewKnowledgeEntry = typeof knowledgeEntries.$inferInsert;
