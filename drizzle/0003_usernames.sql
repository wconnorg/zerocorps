ALTER TABLE "users" ADD COLUMN "username" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "previous_username" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "username_changed_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_unique" ON "users" USING btree ("username");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_username_shape" CHECK ("users"."username" IS NULL OR "users"."username" ~ '^[a-z0-9_]{3,20}$');--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_previous_username_shape" CHECK ("users"."previous_username" IS NULL OR "users"."previous_username" ~ '^[a-z0-9_]{3,20}$');--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_previous_username_dated" CHECK ("users"."previous_username" IS NULL OR "users"."username_changed_at" IS NOT NULL);