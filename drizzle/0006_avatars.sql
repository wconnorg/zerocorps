CREATE TABLE "avatars" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"image" "bytea" NOT NULL,
	"content_type" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "avatars_content_type" CHECK ("avatars"."content_type" = 'image/webp'),
	CONSTRAINT "avatars_size" CHECK (octet_length("avatars"."image") BETWEEN 1 AND 131072)
);
--> statement-breakpoint
ALTER TABLE "avatars" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "avatars" ADD CONSTRAINT "avatars_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "zerocorps_app_all" ON "avatars" AS PERMISSIVE FOR ALL TO "zerocorps_app" USING (true) WITH CHECK (true);