import { sqliteTable, text, integer, blob } from "drizzle-orm/sqlite-core";

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  startedAt: integer("started_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  metadata: text("metadata"), // JSON string for arbitrary metadata
});

export const events = sqliteTable("events", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  timestamp: integer("timestamp", { mode: "timestamp" }).notNull(),
  payload: text("payload").notNull(), // JSON string payload
});

export const contextNodes = sqliteTable("context_nodes", {
  id: text("id").primaryKey(),
  filePath: text("file_path").notNull(),
  astType: text("ast_type").notNull(), // e.g., 'function', 'class'
  content: text("content").notNull(),
  dependencies: text("dependencies"), // JSON array of related file paths
});
