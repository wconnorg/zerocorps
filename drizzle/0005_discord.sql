CREATE TABLE "discord_links" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"discord_id" text NOT NULL,
	"discord_username" text NOT NULL,
	"linked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "discord_links_discord_id_shape" CHECK ("discord_links"."discord_id" ~ '^[0-9]{17,20}$'),
	CONSTRAINT "discord_links_username_length" CHECK (length("discord_links"."discord_username") BETWEEN 1 AND 64)
);
--> statement-breakpoint
ALTER TABLE "discord_links" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "discord_links" ADD CONSTRAINT "discord_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "discord_links_discord_id_unique" ON "discord_links" USING btree ("discord_id");--> statement-breakpoint
CREATE POLICY "zerocorps_app_all" ON "discord_links" AS PERMISSIVE FOR ALL TO "zerocorps_app" USING (true) WITH CHECK (true);