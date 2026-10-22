CREATE TABLE "daily_budgets" (
	"day" text PRIMARY KEY NOT NULL,
	"reserved" numeric(12, 4) DEFAULT 0 NOT NULL,
	"spent" numeric(12, 4) DEFAULT 0 NOT NULL,
	CONSTRAINT "budget_nonnegative" CHECK ("daily_budgets"."reserved" >= 0 and "daily_budgets"."spent" >= 0)
);
--> statement-breakpoint
CREATE TABLE "run_events" (
	"run_id" text NOT NULL,
	"sequence" integer NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	CONSTRAINT "run_events_run_id_sequence_pk" PRIMARY KEY("run_id","sequence")
);
--> statement-breakpoint
CREATE TABLE "insights" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"perspective" text NOT NULL,
	"run_id" text NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversation_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"insight_id" text NOT NULL,
	"version" text NOT NULL,
	"run_id" text NOT NULL,
	"author" text NOT NULL,
	"text" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "run_outbox" (
	"run_id" text PRIMARY KEY NOT NULL,
	"published_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "analysis_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"company_id" text NOT NULL,
	"perspective" text NOT NULL,
	"input" jsonb NOT NULL,
	"status" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"fingerprint" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"result_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"error" text,
	"sequence" integer DEFAULT 0 NOT NULL,
	"data_mode" text NOT NULL,
	"budget_day" text NOT NULL,
	"reservation" numeric(10, 4) NOT NULL,
	"lease_until" timestamp with time zone,
	CONSTRAINT "run_status" CHECK ("analysis_runs"."status" in ('queued','running','cancelling','completed','partial','failed','cancelled')),
	CONSTRAINT "run_perspective" CHECK ("analysis_runs"."perspective" in ('cfo','ceo')),
	CONSTRAINT "run_reservation" CHECK ("analysis_runs"."reservation" >= 0)
);
--> statement-breakpoint
CREATE TABLE "feed_snapshots" (
	"company_id" text NOT NULL,
	"perspective" text NOT NULL,
	"run_id" text NOT NULL,
	CONSTRAINT "feed_snapshots_company_id_perspective_pk" PRIMARY KEY("company_id","perspective")
);
--> statement-breakpoint
CREATE TABLE "insight_user_states" (
	"user_id" text NOT NULL,
	"insight_id" text NOT NULL,
	"version" text NOT NULL,
	"saved_at" timestamp with time zone,
	"feedback" jsonb DEFAULT '{"rating":null,"comment":""}'::jsonb NOT NULL,
	CONSTRAINT "insight_user_states_user_id_insight_id_version_pk" PRIMARY KEY("user_id","insight_id","version")
);
--> statement-breakpoint
ALTER TABLE "run_events" ADD CONSTRAINT "run_events_run_id_analysis_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."analysis_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insights" ADD CONSTRAINT "insights_run_id_analysis_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."analysis_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_insight_id_insights_id_fk" FOREIGN KEY ("insight_id") REFERENCES "public"."insights"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_run_id_analysis_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."analysis_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_outbox" ADD CONSTRAINT "run_outbox_run_id_analysis_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."analysis_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_snapshots" ADD CONSTRAINT "feed_snapshots_run_id_analysis_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."analysis_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insight_user_states" ADD CONSTRAINT "insight_user_states_insight_id_insights_id_fk" FOREIGN KEY ("insight_id") REFERENCES "public"."insights"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "insight_scope" ON "insights" USING btree ("company_id","perspective");--> statement-breakpoint
CREATE UNIQUE INDEX "message_run_author" ON "conversation_messages" USING btree ("run_id","author");--> statement-breakpoint
CREATE UNIQUE INDEX "run_user_key" ON "analysis_runs" USING btree ("user_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "run_scope_history" ON "analysis_runs" USING btree ("user_id","company_id","perspective","created_at");