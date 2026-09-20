CREATE TABLE "abuse_counters" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"window_started_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "abuse_counters" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "auth_events" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"user_id" uuid,
	"identifier_hash" text,
	"ip_hash" text,
	"ip_prefix" text,
	"user_agent" text,
	"detail" text,
	"app_env" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "known_devices" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"device_hash" text NOT NULL,
	"user_agent" text,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "known_devices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "pending_signups" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"code_hash" text NOT NULL,
	"reference" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"send_count" integer DEFAULT 1 NOT NULL,
	"last_sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"terms_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pending_signups" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "auth_events" ADD CONSTRAINT "auth_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "known_devices" ADD CONSTRAINT "known_devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "abuse_counters_expires_at_idx" ON "abuse_counters" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "auth_events_created_at_idx" ON "auth_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "auth_events_type_created_at_idx" ON "auth_events" USING btree ("type","created_at");--> statement-breakpoint
CREATE INDEX "auth_events_user_id_idx" ON "auth_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "auth_events_identifier_hash_idx" ON "auth_events" USING btree ("identifier_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "known_devices_user_device_unique" ON "known_devices" USING btree ("user_id","device_hash");--> statement-breakpoint
CREATE INDEX "pending_signups_email_idx" ON "pending_signups" USING btree ("email");--> statement-breakpoint
CREATE INDEX "pending_signups_expires_at_idx" ON "pending_signups" USING btree ("expires_at");--> statement-breakpoint
CREATE POLICY "zerocorps_app_all" ON "abuse_counters" AS PERMISSIVE FOR ALL TO "zerocorps_app" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "zerocorps_app_all" ON "auth_events" AS PERMISSIVE FOR ALL TO "zerocorps_app" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "zerocorps_app_all" ON "known_devices" AS PERMISSIVE FOR ALL TO "zerocorps_app" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "zerocorps_app_all" ON "pending_signups" AS PERMISSIVE FOR ALL TO "zerocorps_app" USING (true) WITH CHECK (true);