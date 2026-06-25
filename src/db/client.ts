import { Database } from "bun:sqlite"
import { homedir } from "node:os"
import { join } from "node:path"
import { drizzle } from "drizzle-orm/bun-sqlite"
import * as schema from "./schema.js"

// The path where cheap.db will be stored.
// Ideally, this should come from a config, but for now we put it in the user's home directory under .cheap
const DB_PATH = join(homedir(), ".cheap", "cheap.db")

let sqliteDb: Database

try {
	// Initialize the native Bun SQLite database
	sqliteDb = new Database(DB_PATH, { create: true })

	// Enable WAL mode for better concurrency and performance
	sqliteDb.exec("PRAGMA journal_mode = WAL;")
	// Synchronous mode normal is fast and safe with WAL
	sqliteDb.exec("PRAGMA synchronous = NORMAL;")
} catch (error) {
	console.error(`Failed to connect to SQLite at ${DB_PATH}:`, error)
	throw error
}

// Export the Drizzle client
export const db = drizzle(sqliteDb, { schema })

// Helper to initialize/migrate the database tables dynamically without a separate step
export function initDb() {
	sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      started_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      metadata TEXT
    );

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      type TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      payload TEXT NOT NULL,
      FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS context_nodes (
      id TEXT PRIMARY KEY,
      file_path TEXT NOT NULL,
      ast_type TEXT NOT NULL,
      content TEXT NOT NULL,
      dependencies TEXT
    );

    CREATE TABLE IF NOT EXISTS checkpoints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      thread_id TEXT NOT NULL,
      ts INTEGER NOT NULL,
      entries TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS events_session_id_idx ON events(session_id);
    CREATE INDEX IF NOT EXISTS events_timestamp_idx ON events(timestamp);
    CREATE INDEX IF NOT EXISTS checkpoints_thread_id_idx ON checkpoints(thread_id);
  `)
}

// Access to underlying bun:sqlite instance for direct queries
export const getSqliteDb = () => sqliteDb

// Initialize on load
initDb()
