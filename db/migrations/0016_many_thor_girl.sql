CREATE TABLE "memory_captures" (
	"workspace_id" text NOT NULL,
	"scope_key" text NOT NULL,
	"operation_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "memory_captures_workspace_id_scope_key_operation_id_pk" PRIMARY KEY("workspace_id","scope_key","operation_id")
);
--> statement-breakpoint
CREATE TABLE "memory_records" (
	"workspace_id" text NOT NULL,
	"scope_key" text NOT NULL,
	"id" text NOT NULL,
	"revision" integer NOT NULL,
	"content" jsonb,
	"history" jsonb NOT NULL,
	"source_session_id" text,
	"last_operation_id" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "memory_records_workspace_id_scope_key_id_pk" PRIMARY KEY("workspace_id","scope_key","id"),
	CONSTRAINT "memory_records_revision_check" CHECK ("memory_records"."revision" > 0)
);
--> statement-breakpoint
ALTER TABLE "memory_captures" ADD CONSTRAINT "memory_captures_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_records" ADD CONSTRAINT "memory_records_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;