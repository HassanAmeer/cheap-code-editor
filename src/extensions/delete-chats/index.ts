import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent"
import * as fs from "node:fs/promises"
import * as path from "node:path"

async function runDeleteChats(args: string, ctx: ExtensionCommandContext): Promise<void> {
	const agentDir = process.env.CHEAP_CODING_AGENT_DIR
	if (!agentDir) {
		ctx.ui.notify("Cannot determine the coding agent directory.", "error")
		return
	}

	const sessionsDir = path.join(agentDir, "sessions")

	// Check if directory exists
	try {
		await fs.access(sessionsDir)
	} catch {
		ctx.ui.notify("No saved chats found.", "info")
		return
	}

	const choice = await ctx.ui.select(
		"⚠️ Are you sure you want to delete all saved chats? This cannot be undone.",
		["❌ Cancel", "✅ Delete All"]
	)

	if (choice !== "✅ Delete All") {
		ctx.ui.notify("Cancelled", "info")
		return
	}

	try {
		// Delete the sessions directory and its contents
		await fs.rm(sessionsDir, { recursive: true, force: true })
		ctx.ui.notify("All saved chats have been deleted.", "info")
		
		// Start a new session to ensure the current session state doesn't crash 
		// and it recreates a fresh session environment.
		await ctx.newSession()
	} catch (e: any) {
		ctx.ui.notify(`Failed to delete chats: ${e.message}`, "error")
	}
}

export default function deleteChatsExtension(pi: ExtensionAPI): void {
	pi.registerCommand("delete_chats", {
		description: "Delete all saved chats",
		handler: runDeleteChats,
	})
}
