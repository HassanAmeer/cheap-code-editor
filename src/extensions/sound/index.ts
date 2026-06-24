import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import * as os from "node:os"

const envPath = path.join(os.homedir(), ".local", "share", "cheap", ".env")

async function readSoundState(): Promise<boolean> {
	try {
		const content = await fs.readFile(envPath, "utf-8")
		return content.includes("CHEAP_SOUND=true")
	} catch {
		return false
	}
}

async function writeSoundState(enabled: boolean): Promise<void> {
	let content = ""
	try {
		content = await fs.readFile(envPath, "utf-8")
	} catch {
		// file might not exist
	}
	
	const lines = content.split("\n")
	const newLines = []
	let found = false
	for (const line of lines) {
		if (line.trim().startsWith("CHEAP_SOUND=")) {
			newLines.push(`CHEAP_SOUND=${enabled}`)
			found = true
		} else {
			newLines.push(line)
		}
	}
	if (!found) {
		newLines.push(`CHEAP_SOUND=${enabled}`)
	}
	
	await fs.writeFile(envPath, newLines.join("\n"), "utf-8")
	process.env.CHEAP_SOUND = enabled.toString()
}

export default function soundExtension(pi: ExtensionAPI): void {
	// Initialize process.env state synchronously so it's ready, but also read asynchronously to ensure correctness
	readSoundState().then(enabled => {
		process.env.CHEAP_SOUND = enabled.toString()
	})

	pi.registerCommand("sound", {
		get description() {
			const isOn = process.env.CHEAP_SOUND === "true"
			return `♪ Sound Notifications: ${isOn ? "ON" : "OFF"}`
		},
		handler: async (_args, ctx) => {
			const currentState = process.env.CHEAP_SOUND === "true"
			const newState = !currentState
			await writeSoundState(newState)
			
			ctx.ui.notify(`Sound Notifications turned ${newState ? "ON" : "OFF"}`, "info")
			if (newState) {
				// Play a test sound
				process.stdout.write("\x07")
			}
		},
	})
	
	pi.on("agent_end", async () => {
		if (process.env.CHEAP_SOUND === "true") {
			process.stdout.write("\x07")
		}
	})
}
