CREATE TYPE "public"."distill_source_type" AS ENUM('url', 'text', 'file', 'youtube', 'douyin', 'wechat_channels', 'other');--> statement-breakpoint
CREATE TYPE "public"."distill_status" AS ENUM('processing', 'ready', 'failed');--> statement-breakpoint
CREATE TABLE "distill_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"title" text NOT NULL,
	"verdict" varchar(16) NOT NULL,
	"verdict_reason" text NOT NULL,
	"estimated_reading_minutes" integer DEFAULT 1 NOT NULL,
	"summary" text NOT NULL,
	"key_points" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"claims" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"transferable_insights" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"cautions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"follow_up_questions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"provider" varchar(64) NOT NULL,
	"model" varchar(128) NOT NULL,
	"prompt_version" varchar(64) NOT NULL,
	"output_tokens" integer,
	"cost_micros" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "distill_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" varchar(128) NOT NULL,
	"source_type" "distill_source_type" NOT NULL,
	"source_url" text,
	"source_title" text,
	"source_author" varchar(256),
	"raw_text" text NOT NULL,
	"input_characters" integer NOT NULL,
	"status" "distill_status" DEFAULT 'processing' NOT NULL,
	"error_message" text,
	"access_mode" varchar(32) DEFAULT 'private' NOT NULL,
	"billable_units" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" varchar(128) NOT NULL,
	"document_id" uuid NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "distill_analyses" ADD CONSTRAINT "distill_analyses_document_id_distill_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."distill_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_entries" ADD CONSTRAINT "knowledge_entries_document_id_distill_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."distill_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "distill_analyses_document_unique" ON "distill_analyses" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "distill_analyses_created_idx" ON "distill_analyses" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "distill_documents_owner_created_idx" ON "distill_documents" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE INDEX "distill_documents_owner_status_idx" ON "distill_documents" USING btree ("owner_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_entries_owner_document_unique" ON "knowledge_entries" USING btree ("owner_id","document_id");--> statement-breakpoint
CREATE INDEX "knowledge_entries_owner_created_idx" ON "knowledge_entries" USING btree ("owner_id","created_at");