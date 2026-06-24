import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import * as os from "node:os"

async function runChooseProject(args: string, ctx: ExtensionCommandContext): Promise<void> {
	if (os.platform() !== "darwin") {
		ctx.ui.notify("Native popup is only supported on macOS", "error")
		return
	}

	try {
		const script = `
			tell application (path to frontmost application as text)
				set theFolder to choose folder with prompt "Select Project Directory"
				POSIX path of theFolder
			end tell
		`
		const { stdout } = await require("node:util").promisify(require("node:child_process").exec)(`osascript -e '${script.replace(/\n/g, "' -e '").trim()}'`)
		const currentDir = stdout.trim()
		
		if (currentDir) {
			process.chdir(currentDir)
			ctx.ui.notify(`Active project directory changed to: ${currentDir}`, "info")
			await ctx.reload()
		}
	} catch (e: any) {
		if (e.code === 1) {
			ctx.ui.notify("Folder selection cancelled.", "info")
		} else {
			ctx.ui.notify(`Error: ${e.message}`, "error")
		}
	}
}

export default function chooseProjectExtension(pi: ExtensionAPI): void {
	pi.registerCommand("choose_project", {
		description: "Change Active Project Directory",
		handler: runChooseProject,
	})
}
