import * as fs from "node:fs/promises"
import * as os from "node:os"
import * as path from "node:path"
import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent"

async function runAttach(args: string, ctx: ExtensionCommandContext): Promise<void> {
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

		if (fullPath) {
			const currentText = ctx.ui.getEditorText()
			const space = currentText.length > 0 && !currentText.endsWith(" ") ? " " : ""
			ctx.ui.setEditorText(currentText + space + fullPath)
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
}
