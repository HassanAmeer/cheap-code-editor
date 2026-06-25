import { getSqliteDb } from "../db/client.js"

export async function runRevert(args: string[]): Promise<number | undefined> {
	if (args.length < 1) {
		console.error("Usage: cheap revert <session-id>")
		return 1
	}

	const sessionId = args[0]

	try {
		const sqliteDb = getSqliteDb()

		// List checkpoints for the session ordered by descending timestamp
		const query = sqliteDb.query("SELECT id, ts FROM checkpoints WHERE thread_id = $thread_id ORDER BY ts DESC")
		const checkpoints = query.all({ $thread_id: sessionId }) as { id: number; ts: number }[]

		if (checkpoints.length === 0) {
			console.log(`No history found for session ${sessionId}`)
			return 1
		}

		// Revert to the second-to-last checkpoint (undo last turn)
		if (checkpoints.length < 2) {
			console.log("Not enough history to revert.")
			return 1
		}

		const latestCheckpoint = checkpoints[0]
		const previousCheckpoint = checkpoints[1] // 0 is latest, 1 is previous

		console.log(`Reverting session ${sessionId} to previous state (Checkpoint ID: ${previousCheckpoint.id})...`)

		// Delete the latest checkpoint to "revert"
		const deleteStmt = sqliteDb.query("DELETE FROM checkpoints WHERE id = $id")
		deleteStmt.run({ $id: latestCheckpoint.id })

		console.log("Successfully reverted session memory to previous turn!")

		return 0
	} catch (error) {
		console.error("Failed to revert session:", error)
		return 1
	}
}
