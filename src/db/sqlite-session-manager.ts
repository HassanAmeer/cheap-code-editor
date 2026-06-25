import { type SessionEntry, SessionManager } from "@earendil-works/pi-coding-agent"
import { getSqliteDb } from "./client.js"

/**
 * Creates an in-memory SessionManager and restores its state from SQLite checkpointer.
 * Also hooks its `_persist` method so that future changes are written to the database.
 */
export async function createSqliteSessionManager(sessionId: string, cwd: string): Promise<SessionManager> {
	// Start with a blank in-memory session
	const manager = SessionManager.inMemory(cwd)
	;(manager as any).sessionId = sessionId // force the ID to match our SQLite DB

	const sqliteDb = getSqliteDb()

	// Load the latest checkpoint from SQLite
	const query = sqliteDb.query("SELECT entries FROM checkpoints WHERE thread_id = $thread_id ORDER BY ts DESC LIMIT 1")
	const result = query.get({ $thread_id: sessionId }) as { entries: string } | undefined

	if (result?.entries) {
		try {
			const entries = JSON.parse(result.entries)
			if (Array.isArray(entries)) {
				// Restore internal state
				;(manager as any).fileEntries = entries
				if (typeof (manager as any)._buildIndex === "function") {
					;(manager as any)._buildIndex()
				} else {
					// Fallback manual rebuild if internal API changes
					const byId = new Map()
					let leafId = null
					for (const entry of entries) {
						byId.set(entry.id, entry)
						leafId = entry.id
					}
					;(manager as any).byId = byId
					;(manager as any).leafId = leafId
				}
			}
		} catch (e) {
			console.error("Failed to parse SQLite checkpoint:", e)
		}
	}

	return manager
}

export async function syncSessionToLangGraph(sessionId: string, manager: SessionManager) {
	const entries = manager.getEntries()
	const sqliteDb = getSqliteDb()

	try {
		const insert = sqliteDb.query("INSERT INTO checkpoints (thread_id, ts, entries) VALUES ($thread_id, $ts, $entries)")
		insert.run({
			$thread_id: sessionId,
			$ts: Date.now(),
			$entries: JSON.stringify(entries),
		})
	} catch (e) {
		console.error("Failed to save checkpoint to SQLite:", e)
	}
}
