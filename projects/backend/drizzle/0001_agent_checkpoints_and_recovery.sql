CREATE TABLE "agent_model_calls" (
	"run_id" text NOT NULL,
	"call_key" text NOT NULL,
	"request_hash" text NOT NULL,
	"response" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "agent_model_calls_run_id_call_key_pk" PRIMARY KEY("run_id","call_key")
);
--> statement-breakpoint
ALTER TABLE "run_outbox" ADD COLUMN "version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "analysis_runs" ADD COLUMN "lease_token" text;--> statement-breakpoint
ALTER TABLE "analysis_runs" ADD COLUMN "attempt" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "analysis_runs" ADD COLUMN "execution_scope" text;--> statement-breakpoint
ALTER TABLE "agent_model_calls" ADD CONSTRAINT "agent_model_calls_run_id_analysis_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."analysis_runs"("id") ON DELETE cascade ON UPDATE no action;