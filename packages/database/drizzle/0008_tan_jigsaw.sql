CREATE TYPE "public"."content_format" AS ENUM('text', 'html');--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "content_format" "content_format" DEFAULT 'text' NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "media_assets" jsonb DEFAULT '[]'::jsonb NOT NULL;