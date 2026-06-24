import { resolve } from "node:path"
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"
import { configureLocalProviderKeys } from "./config-model.js"

export default function configExtension(pi: ExtensionAPI): void {
	const agentDir = process.env.CHEAP_CODING_AGENT_DIR
	if (!agentDir) return
	const modelsJsonPath = resolve(agentDir, "models.json")

	pi.registerCommand("config", {
		description: "Configure options (e.g. /config model)",
		handler: async (args, ctx) => {
			if (args.trim() === "model") {
				await configureLocalProviderKeys(ctx, modelsJsonPath)
			} else {
				ctx.ui.notify("Usage: /config model", "info")
			}
		},
	})
}
