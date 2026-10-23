CREATE TABLE "custom_companies" (
	"id" text PRIMARY KEY NOT NULL,
	"profile" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_memberships" (
	"user_id" text NOT NULL,
	"company_id" text NOT NULL,
	CONSTRAINT "company_memberships_user_id_company_id_pk" PRIMARY KEY("user_id","company_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "user_source" CHECK ("users"."source" in ('dataset','custom'))
);
--> statement-breakpoint
ALTER TABLE "company_memberships" ADD CONSTRAINT "company_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "membership_company" ON "company_memberships" USING btree ("company_id");