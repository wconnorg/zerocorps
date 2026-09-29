CREATE TABLE "checkpoint_passes" (
	"user_id" uuid NOT NULL,
	"chapter_id" text NOT NULL,
	"score" integer NOT NULL,
	"out_of" integer NOT NULL,
	"passed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "checkpoint_passes_pkey" PRIMARY KEY("user_id","chapter_id"),
	CONSTRAINT "checkpoint_passes_chapter_id_shape" CHECK ("checkpoint_passes"."chapter_id" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length("checkpoint_passes"."chapter_id") <= 80),
	CONSTRAINT "checkpoint_passes_score_range" CHECK ("checkpoint_passes"."out_of" BETWEEN 1 AND 50 AND "checkpoint_passes"."score" BETWEEN 0 AND "checkpoint_passes"."out_of")
);
--> statement-breakpoint
ALTER TABLE "checkpoint_passes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lesson_progress" (
	"user_id" uuid NOT NULL,
	"lesson_id" text NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lesson_progress_pkey" PRIMARY KEY("user_id","lesson_id"),
	CONSTRAINT "lesson_progress_lesson_id_shape" CHECK ("lesson_progress"."lesson_id" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length("lesson_progress"."lesson_id") <= 80)
);
--> statement-breakpoint
ALTER TABLE "lesson_progress" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "rank_history" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"rank" text NOT NULL,
	"achieved_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rank_history_rank_shape" CHECK ("rank_history"."rank" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length("rank_history"."rank") <= 80)
);
--> statement-breakpoint
ALTER TABLE "rank_history" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "checkpoint_passes" ADD CONSTRAINT "checkpoint_passes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rank_history" ADD CONSTRAINT "rank_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "rank_history_user_rank_unique" ON "rank_history" USING btree ("user_id","rank");--> statement-breakpoint
CREATE POLICY "zerocorps_app_all" ON "checkpoint_passes" AS PERMISSIVE FOR ALL TO "zerocorps_app" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "zerocorps_app_all" ON "lesson_progress" AS PERMISSIVE FOR ALL TO "zerocorps_app" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "zerocorps_app_all" ON "rank_history" AS PERMISSIVE FOR ALL TO "zerocorps_app" USING (true) WITH CHECK (true);