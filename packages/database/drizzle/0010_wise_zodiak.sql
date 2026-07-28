CREATE TABLE "distill_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" varchar(128) NOT NULL,
	"document_id" uuid NOT NULL,
	"role" varchar(16) NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" varchar(128) NOT NULL,
	"document_id" uuid NOT NULL,
	"insight_index" integer NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "distill_messages" ADD CONSTRAINT "distill_messages_document_id_distill_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."distill_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_cards" ADD CONSTRAINT "knowledge_cards_document_id_distill_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."distill_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "distill_messages_document_created_idx" ON "distill_messages" USING btree ("document_id","created_at");--> statement-breakpoint
CREATE INDEX "distill_messages_owner_created_idx" ON "distill_messages" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_cards_owner_document_insight_unique" ON "knowledge_cards" USING btree ("owner_id","document_id","insight_index");--> statement-breakpoint
CREATE INDEX "knowledge_cards_owner_created_idx" ON "knowledge_cards" USING btree ("owner_id","created_at");