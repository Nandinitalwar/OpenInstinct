import { sql } from "drizzle-orm";
import {
  check,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import type { MemoryContent, MemoryHistory } from "@shared/memory/schema";
import { workspaces } from "./workspaces";

export const memoryRecords = pgTable(
  "memory_records",
  {
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    scopeKey: text("scope_key").notNull(),
    id: text("id").notNull(),
    revision: integer("revision").notNull(),
    content: jsonb("content").$type<MemoryContent>(),
    history: jsonb("history").$type<MemoryHistory>().notNull(),
    sourceSessionId: text("source_session_id"),
    lastOperationId: text("last_operation_id").notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceId, table.scopeKey, table.id] }),
    check("memory_records_revision_check", sql`${table.revision} > 0`),
  ]
);

export const memoryCaptures = pgTable(
  "memory_captures",
  {
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    scopeKey: text("scope_key").notNull(),
    operationId: text("operation_id").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.workspaceId, table.scopeKey, table.operationId],
    }),
  ]
);
