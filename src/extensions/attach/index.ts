import * as fs from "node:fs/promises"
import * as os from "node:os"
import * as path from "node:path"
import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent"
import { setPendingAttachmentIndicator } from "../ui.js"

let pendingFiles: string[] = []

function updateIndicator() {
	if (pendingFiles.length === 0) {
		setPendingAttachmentIndicator(null)
	} else {
		const names = pendingFiles.map((f) => path.basename(f)).join(", ")
		setPendingAttachmentIndicator(`📎 Attached: ${names}`)
	}
}

async function runAttach(args: string, ctx: ExtensionCommandContext): Promise<void> {
	if (args.trim() === "clear") {
		pendingFiles = []
		updateIndicator()
		ctx.ui.notify("Attachments cleared.", "info")
		return
	}

	if (os.platform() !== "darwin") {
		ctx.ui.notify("Native popup is only supported on macOS", "error")
		return
	}

	try {
		const script = `
			tell application (path to frontmost application as text)
				set theFile to choose file with prompt "Select File or Image to Attach"
				POSIX path of theFile
			end tell
		`
		const { stdout } = await require("node:util").promisify(require("node:child_process").exec)(
			`osascript -e '${script.replace(/\n/g, "' -e '").trim()}'`,
		)
		const fullPath = stdout.trim()

		if (fullPath && !pendingFiles.includes(fullPath)) {
			pendingFiles.push(fullPath)
			updateIndicator()
			ctx.ui.notify(`Attached: ${path.basename(fullPath)}`, "info")
		}
	} catch (err) {
		const e = err as { code?: number; message: string }
		if (e.code === 1) {
			ctx.ui.notify("File selection cancelled.", "info")
		} else {
			ctx.ui.notify(`Error: ${e.message}`, "error")
		}
	}
}

export default function attachExtension(pi: ExtensionAPI): void {
	pi.registerCommand("attach", {
		description: "Attach an image or file",
		handler: runAttach,
	})

	pi.registerCommand("clear_attach", {
		description: "Clear attached files",
		handler: async () => {
			pendingFiles = []
			updateIndicator()
		},
	})

	pi.on("session_start", () => {
		pendingFiles = []
		updateIndicator()
	})

	pi.on("input", (event) => {
		if (pendingFiles.length === 0) return undefined

		const attachments = pendingFiles.join("\n")
		pendingFiles = []
		updateIndicator()

		const text = `[Attached files:\n${attachments}]\n\n${event.text}`
		return { action: "transform", text, images: event.images }
	})
}
