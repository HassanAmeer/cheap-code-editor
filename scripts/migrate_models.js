import fs from "node:fs"
import path from "node:path"

const files = ["gemini", "nvidia", "openai", "openrouter", "poolside", "vercel", "zenmux"]

function getVariant(name) {
	const lower = name.toLowerCase()
	if (lower.includes("flash") || lower.includes("mini") || lower.includes("haiku")) return "ModelVariant.Flash"
	if (lower.includes("ultra") || lower.includes("opus") || lower.includes("o1") || lower.includes("pro"))
		return "ModelVariant.High"
	if (lower.includes("sonnet") || lower.includes("gpt-4o") || lower.includes("gemini")) return "ModelVariant.High"
	return "ModelVariant.Default"
}

function parseTokens(tokenStr) {
	if (!tokenStr) return 8192
	const match = tokenStr.match(/(\d+)([kKMm]?)/)
	if (!match) return 8192
	const num = Number.parseInt(match[1], 10)
	const suffix = match[2].toLowerCase()
	if (suffix === "k") return num * 1024
	if (suffix === "m") return num * 1024 * 1024
	return num
}

for (const dir of files) {
	const filePath = path.join("src", "providers", dir, "index.ts")
	if (!fs.existsSync(filePath)) continue

	let content = fs.readFileSync(filePath, "utf-8")

	// Quick parse of the models array using regex
	// We'll replace the entire array declaration
	const arrayRegex = /export const \w+Models = \[([\s\S]*?)\]\n/
	const match = arrayRegex.exec(content)
	if (!match) continue

	const modelsStr = match[1]

	// Extract individual objects
	const objRegex = /\{([\s\S]*?)\}/g
	let newModelsStr = ""
	let objMatch
	// biome-ignore lint/suspicious/noAssignInExpressions: standard regex loop pattern
	while ((objMatch = objRegex.exec(modelsStr)) !== null) {
		const objContent = objMatch[1]

		// Parse key-value pairs
		const model = {}
		const kvRegex = /([a-zA-Z0-9_]+)\s*:\s*([^,\n]+)/g
		let kvMatch
		// biome-ignore lint/suspicious/noAssignInExpressions: standard regex loop pattern
		while ((kvMatch = kvRegex.exec(objContent)) !== null) {
			let val = kvMatch[2].trim()
			if (val.startsWith('"') || val.startsWith("'")) val = val.slice(1, -1)
			else if (val === "true") val = true
			else if (val === "false") val = false
			else if (val.startsWith("[")) {
				val = val
					.replace(/[\[\]"'\s]/g, "")
					.split(",")
					.filter(Boolean)
			}
			model[kvMatch[1]] = val
		}

		if (!model.name) continue

		const ctx = parseTokens(model.tokens || "8k")
		const isFast = model.fast === true
		const isVision = Array.isArray(model.support) && model.support.includes("vision")
		const isReasoning =
			model.name.toLowerCase().includes("thinking") ||
			model.name.toLowerCase().includes("o1") ||
			model.name.toLowerCase().includes("o3")

		newModelsStr += `\t{\n`
		newModelsStr += `\t\tshow_name: "${model.name}",\n`
		newModelsStr += `\t\tfull_name: "${dir}/${model.name.toLowerCase()}",\n`
		newModelsStr += `\t\tmodel_id: "${model.value || model.name}",\n`
		newModelsStr += `\t\tprovider: "${model.provider || dir}",\n`
		newModelsStr += `\t\tshow: ${model.show !== false},\n`
		newModelsStr += `\t\tis_fast: ${isFast},\n`
		newModelsStr += `\t\tis_chat: true,\n`
		newModelsStr += `\t\treasoning: ${isReasoning},\n`
		newModelsStr += `\t\tis_vision_image: ${isVision},\n`
		newModelsStr += `\t\ttool_use: ${!isReasoning},\n`
		newModelsStr += `\t\tweb_search: false,\n`
		newModelsStr += `\t\tcode_exec: true,\n`
		newModelsStr += `\t\tdocs: false,\n`
		newModelsStr += `\t\tgen_image: false,\n`
		newModelsStr += `\t\tgen_audio: false,\n`
		newModelsStr += `\t\tEmbed: false,\n`
		newModelsStr += `\t\tRerank: false,\n`
		newModelsStr += `\t\ttts: false,\n`
		newModelsStr += `\t\tstt: false,\n`
		newModelsStr += `\t\ttranscription_audio: false,\n`
		newModelsStr += `\t\tvisit_web: false,\n`
		newModelsStr += `\t\tcan_json_output: true,\n`
		newModelsStr += `\t\ttk_speed_per_sec: ${isFast ? 150 : 50},\n`
		newModelsStr += `\t\tvariant: ${getVariant(model.name)},\n`
		newModelsStr += `\t\tinput_tokens: ${ctx},\n`
		newModelsStr += `\t\toutput_tokens: ${isReasoning ? 32000 : 8192},\n`
		newModelsStr += `\t\tcontext_size: ${ctx},\n`
		newModelsStr += `\t},\n`
	}

	// Need to import ModelVariant from opencode/index.ts
	let importStmt = `import { ModelVariant } from "../opencode/index.js"\n\n`
	if (content.includes("ModelVariant")) importStmt = "" // Already has it

	const arrayNameMatch = content.match(/export const (\w+Models) = \[/)
	const arrayName = arrayNameMatch ? arrayNameMatch[1] : dir + "Models"

	content = content.replace(arrayRegex, `export const ${arrayName} = [\n${newModelsStr}]\n`)

	fs.writeFileSync(filePath, importStmt + content)
	console.log(`Updated ${filePath}`)
}
