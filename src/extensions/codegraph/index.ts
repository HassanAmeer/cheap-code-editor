import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"
import { Type } from "typebox"
import { CodeGraphClient } from "../../context/codegraph-client.js"

export default function codegraphExtension(pi: ExtensionAPI): void {
	const codegraph = new CodeGraphClient()

	pi.registerTool({
		name: "query_codegraph",
		label: "CodeGraph Query",
		description:
			"Query the codebase AST to understand functions, classes, and their relationships. " +
			"Returns the relevant files and their AST summaries.",
		promptSnippet: "Use CodeGraph to understand code structure",
		parameters: Type.Object({
			query: Type.String({ description: "Search query or symbol name" }),
			dir: Type.Optional(Type.String({ description: "Directory to search in" })),
		}),

		async execute(_toolCallId, params, signal, _onUpdate, _ctx) {
			const cwd = params.dir ?? process.cwd()
			const nodes = await codegraph.queryContext(params.query, cwd)

			if (nodes.length === 0) {
				return {
					content: [{ type: "text" as const, text: "No relevant code found in CodeGraph for your query." }],
					details: {},
				}
			}

			const summary = nodes
				.map((n) => `File: ${n.filePath}\nType: ${n.type}\nContent:\n${n.content}`)
				.join("\n\n---\n\n")

			return {
				content: [{ type: "text" as const, text: summary }],
				details: { nodesCount: nodes.length },
			}
		},
	})
}
