import { CURRENT_SESSION_VERSION, type SessionHeader } from "@earendil-works/pi-coding-agent"
import { v7 as uuidv7 } from "uuid"
import { db } from "../../../db/client.js"
import { sessions as sessionsTable } from "../../../db/schema.js"

export interface AgentSessionFile {
	sessionId: string
	sessionFile: string
}

export function prepareAgentSessionFile(
	parentSessionDir: string,
	parentSessionFile: string | undefined,
	cwd: string,
	generateId: () => string = uuidv7,
	now: () => Date = () => new Date(),
): AgentSessionFile | undefined {
	if (parentSessionFile === undefined || parentSessionDir.length === 0) return undefined

	const sessionId = generateId()
	const timestamp = now().toISOString()
	
	try {
		db.insert(sessionsTable).values({
			id: sessionId,
			startedAt: now(),
			updatedAt: now(),
			metadata: JSON.stringify({
				type: "session",
				version: CURRENT_SESSION_VERSION,
				cwd,
				parentSession: parentSessionFile
			})
		}).run()
	} catch (error) {
		console.error("Failed to write session to SQLite", error)
	}

	const sessionFile = "sqlite://" + sessionId
	return { sessionId, sessionFile }
}
