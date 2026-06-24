import "../integrations/cursor.js" // side-effect: register integration
import { byId } from "../integrations/registry.js"
import { popScope, prepareTool } from "./_helpers.js"

export async function runCursor(args: string[]): Promise<number> {
	const scope = popScope(args)
	const prepped = await prepareTool("cursor", "override")
	if (!prepped) return 1

	try {
		const tool = byId("cursor")
		if (!tool) {
			console.error("cheap cursor: integration not registered")
			return 1
		}
		await tool.write(scope, prepped.apiKey, prepped.models)
		console.log("cheap cursor: configuration written. Restart Cursor to pick up the cheap provider.")
		return 0
	} catch (err) {
		console.error(`cheap cursor: ${(err as Error).message}`)
		return 1
	}
}
