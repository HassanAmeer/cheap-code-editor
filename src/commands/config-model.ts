/**
 * `cheap config model` — interactive provider / model configuration wizard.
 *
 * Runs standalone (no agent session required) using @clack/prompts.
 * Saves API keys + base URLs to ~/.local/share/cheap/.env and custom
 * model definitions to ~/.local/share/cheap/model-overrides.json.
 *
 * The in-session equivalent lives in src/extensions/config/config-model.ts
 * (uses pi-tui ExtensionSelectorComponent / LoginDialogComponent). This
 * file deliberately avoids pi-tui so it works as a plain CLI subcommand.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import * as clack from "@clack/prompts"

// ---------------------------------------------------------------------------
// Provider definitions — keep in sync with src/providers/keys.ts and
// src/extensions/config/config-model.ts
// ---------------------------------------------------------------------------
const PROVIDERS = [
	{ name: "OpenCode", id: "opencode", envKey: "OPENCODE_API_KEY", defaultUrl: "https://opencode.ai/zen/v1" },
	{ name: "OpenAI", id: "openai", envKey: "OPENAI_API_KEY", defaultUrl: "https://api.openai.com/v1" },
	{
		name: "Gemini",
		id: "gemini",
		envKey: "GEMINI_API_KEY",
		defaultUrl: "https://generativelanguage.googleapis.com/v1beta/openai/",
	},
	{
		name: "OpenRouter",
		id: "openrouter",
		envKey: "OPENROUTER_API_KEY",
		defaultUrl: "https://openrouter.ai/api/v1",
	},
	{
		name: "NVIDIA NIM",
		id: "nvidia",
		envKey: "NVIDIA_API_KEY",
		defaultUrl: "https://integrate.api.nvidia.com/v1",
	},
	{ name: "Poolside", id: "poolside", envKey: "POOLSIDE_API_KEY", defaultUrl: "https://api.poolside.ai/v1" },
	{ name: "Vercel", id: "vercel", envKey: "VERCEL_API_KEY", defaultUrl: "https://ai-gateway.vercel.sh" },
	{
		name: "Qwen",
		id: "qwen",
		envKey: "QWEN_API_KEY",
		defaultUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
	},
	{ name: "Zai (ZhipuAI)", id: "zai", envKey: "ZAI_API_KEY", defaultUrl: "https://open.bigmodel.cn/api/paas/v4/" },
	{ name: "Kimi (Moonshot)", id: "kimi", envKey: "KIMI_API_KEY", defaultUrl: "https://api.moonshot.cn/v1" },
	{ name: "Zenmux", id: "zenmux", envKey: "ZENMUX_API_KEY", defaultUrl: "https://zenmux.ai/api/v1" },
] as const

type Provider = (typeof PROVIDERS)[number]

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const CHEAP_DATA_DIR = join(homedir(), ".local", "share", "cheap")
const ENV_PATH = join(CHEAP_DATA_DIR, ".env")
const OVERRIDES_PATH = join(CHEAP_DATA_DIR, "model-overrides.json")

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function ensureDataDir(): void {
	mkdirSync(CHEAP_DATA_DIR, { recursive: true })
}

function censorKey(key: string): string {
	if (!key) return ""
	if (key.length <= 15) return `****${key.slice(-Math.min(key.length - 1, 3))}`
	return `${key.slice(0, 4)}...${key.slice(-4)}`
}

/** Read ~/.local/share/cheap/.env as a key=value map. */
function readEnvFile(): Map<string, string> {
	const map = new Map<string, string>()
	if (!existsSync(ENV_PATH)) return map
	for (const line of readFileSync(ENV_PATH, "utf-8").split("\n")) {
		const eq = line.indexOf("=")
		if (eq < 1 || line.trimStart().startsWith("#")) continue
		const k = line.slice(0, eq).trim()
		const v = line
			.slice(eq + 1)
			.trim()
			.replace(/^["']|["']$/g, "")
		map.set(k, v)
	}
	return map
}

/** Write a single key=value pair into ~/.local/share/cheap/.env, updating or appending. */
function writeEnvKey(key: string, value: string): void {
	ensureDataDir()
	let content = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, "utf-8") : ""
	const lines = content.split("\n")
	let found = false
	const newLines: string[] = []

	for (const line of lines) {
		if (line.trim().startsWith(`${key}=`) || line.trim() === key) {
			if (value.trim() !== "") {
				newLines.push(`${key}="${value.trim()}"`)
			}
			// if empty, just drop the line (removes the key)
			found = true
		} else {
			newLines.push(line)
		}
	}

	if (!found && value.trim() !== "") {
		// Ensure blank line separator before adding
		if (newLines.length > 0 && newLines[newLines.length - 1] !== "") newLines.push("")
		newLines.push(`${key}="${value.trim()}"`)
	}

	// Trim trailing blank lines but keep exactly one trailing newline
	content = `${newLines.join("\n").trimEnd()}\n`
	writeFileSync(ENV_PATH, content, "utf-8")
}

function readOverrides(): any {
	if (!existsSync(OVERRIDES_PATH)) return {}
	try {
		return JSON.parse(readFileSync(OVERRIDES_PATH, "utf-8"))
	} catch {
		return {}
	}
}

function writeOverrides(data: any): void {
	ensureDataDir()
	writeFileSync(OVERRIDES_PATH, `${JSON.stringify(data, null, 2)}\n`, "utf-8")
}



async function addCustomModel(): Promise<void> {
	const providerSel = await clack.select<string>({
		message: "Select provider for the custom model:",
		options: PROVIDERS.map((p) => ({ value: p.id, label: p.name })),
	})
	if (clack.isCancel(providerSel)) {
		clack.log.warn("Cancelled.")
		return
	}
	const provider = PROVIDERS.find((p) => p.id === providerSel)!

	const modelId = await clack.text({
		message: "Model ID (as expected by the API):",
		placeholder: "e.g. gpt-4o, deepseek-reasoner, gemini-2.0-flash",
		validate: (v) => (!v || v.trim() === "" ? "Model ID cannot be empty" : undefined),
	})
	if (clack.isCancel(modelId)) {
		clack.log.warn("Cancelled.")
		return
	}

	const modelName = await clack.text({
		message: "Display name:",
		placeholder: `e.g. My ${provider.name} Model`,
		validate: (v) => (!v || v.trim() === "" ? "Display name cannot be empty" : undefined),
	})
	if (clack.isCancel(modelName)) {
		clack.log.warn("Cancelled.")
		return
	}

	const contextSel = await clack.select<string>({
		message: "Context window size:",
		options: [
			{ value: "8192", label: "8k  (8,192 tokens)" },
			{ value: "32768", label: "32k (32,768 tokens)" },
			{ value: "131072", label: "128k (131,072 tokens)" },
			{ value: "1048576", label: "1M  (1,048,576 tokens)" },
			{ value: "custom", label: "Custom…" },
		],
	})
	if (clack.isCancel(contextSel)) {
		clack.log.warn("Cancelled.")
		return
	}

	let contextWindow = Number.parseInt(contextSel as string, 10)
	if (contextSel === "custom") {
		const customCtx = await clack.text({
			message: "Enter context window in tokens:",
			placeholder: "e.g. 65536",
			validate: (v) => (!v || Number.isNaN(Number.parseInt(v, 10)) ? "Must be a number" : undefined),
		})
		if (clack.isCancel(customCtx)) {
			clack.log.warn("Cancelled.")
			return
		}
		contextWindow = Number.parseInt(customCtx as string, 10) || 8192
	}

	const vision = await clack.confirm({ message: "Does this model support image / vision input?" })
	if (clack.isCancel(vision)) {
		clack.log.warn("Cancelled.")
		return
	}

	const reasoning = await clack.confirm({ message: "Does this model support extended reasoning (thinking)?" })
	if (clack.isCancel(reasoning)) {
		clack.log.warn("Cancelled.")
		return
	}

	const large = await clack.confirm({ message: "Is this a large / slow model? (affects UI grouping)" })
	if (clack.isCancel(large)) {
		clack.log.warn("Cancelled.")
		return
	}

	const modelKey = await clack.text({
		message: "Model-specific API Key (leave blank to use provider key):",
		placeholder: "(optional)",
		validate: () => undefined,
	})
	if (clack.isCancel(modelKey)) {
		clack.log.warn("Cancelled.")
		return
	}

	const modelUrl = await clack.text({
		message: "Model-specific Base URL (leave blank to use provider URL):",
		placeholder: "(optional)",
		validate: () => undefined,
	})
	if (clack.isCancel(modelUrl)) {
		clack.log.warn("Cancelled.")
		return
	}

	// Save to model-overrides.json
	const overrides = readOverrides()
	if (!overrides.customModels) overrides.customModels = []

	// Replace any existing entry with the same ID
	overrides.customModels = overrides.customModels.filter((m: any) => m.id !== (modelId as string).trim())
	overrides.customModels.push({
		id: (modelId as string).trim(),
		name: (modelName as string).trim(),
		provider: provider.id,
		vision: vision as boolean,
		reasoning: reasoning as boolean,
		large: large as boolean,
		contextWindow,
		apiKey: (modelKey as string).trim() !== "" ? (modelKey as string).trim() : undefined,
		baseUrl: (modelUrl as string).trim() !== "" ? (modelUrl as string).trim() : undefined,
	})

	writeOverrides(overrides)
	clack.log.success(`Custom model "${(modelId as string).trim()}" saved to ${OVERRIDES_PATH}`)
}

async function showConfigured(): Promise<void> {
	const envMap = readEnvFile()
	const overrides = readOverrides()
	const customModels: any[] = overrides.customModels || []

	const lines: string[] = [""]
	lines.push("  ── Provider Keys ──────────────────────────────")
	let anyKey = false
	for (const p of PROVIDERS) {
		const urlKey = p.envKey.replace("_API_KEY", "_BASE_URL")
		const key = process.env[p.envKey] || envMap.get(p.envKey) || ""
		const url = process.env[urlKey] || envMap.get(urlKey) || ""
		if (key || url) {
			anyKey = true
			lines.push(`  ${p.name}`)
			if (key) lines.push(`    API Key : ${censorKey(key)}`)
			if (url) lines.push(`    Base URL: ${url}`)
		}
	}
	if (!anyKey) lines.push("  (no provider keys configured)")

	if (customModels.length > 0) {
		lines.push("")
		lines.push("  ── Custom Models ──────────────────────────────")
		for (const m of customModels) {
			lines.push(`  ${m.name} (${m.id})`)
			lines.push(`    Provider : ${m.provider}`)
			lines.push(
				`    Context  : ${m.contextWindow >= 1048576 ? `${Math.round(m.contextWindow / 1048576)}M` : `${Math.round(m.contextWindow / 1024)}k`} tokens`,
			)
			lines.push(
				`    Vision   : ${m.vision ? "Yes" : "No"} | Reasoning: ${m.reasoning ? "Yes" : "No"} | Large: ${m.large ? "Yes" : "No"}`,
			)
			if (m.apiKey) lines.push(`    API Key  : ${censorKey(m.apiKey)}`)
			if (m.baseUrl) lines.push(`    Base URL : ${m.baseUrl}`)
		}
	} else {
		lines.push("")
		lines.push("  ── Custom Models ──────────────────────────────")
		lines.push("  (none configured)")
	}
	lines.push("")

	clack.note(lines.join("\n"), "Configured Settings")
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * `cheap config model` — interactive provider / model configuration.
 *
 * Matches old CLI UX: providers list appears directly. User selects a
 * provider → enters API key → enters base URL → done. Loop continues
 * until user picks "Exit". "Add Custom Model" and "Show Config" are
 * also listed as special options at the bottom.
 *
 * Returns a POSIX exit code (0 = success).
 */
export async function runConfigModel(_args: string[]): Promise<number> {
	clack.intro("⚙  AI Provider & Model Configuration")

	// biome-ignore lint/suspicious/noConfusingLabels: intentional outer loop label
	outer: while (true) {
		const envMap = readEnvFile()

		// Build the combined menu: providers first, then special actions
		const options: { value: string; label: string; hint?: string }[] = [
			// ── Providers ──
			...PROVIDERS.map((p) => {
				const hasKey = !!envMap.get(p.envKey)
				return {
					value: `provider:${p.id}`,
					label: p.name,
					hint: hasKey ? "✓ key configured" : "not configured",
				}
			}),
			// ── Special actions ──
			{ value: "custom_model", label: "Add / Configure Custom Model" },
			{ value: "show", label: "Show Configured Keys & Models" },
			{ value: "exit", label: "Exit" },
		]

		const selected = await clack.select<string>({
			message: "Select a provider to configure its API key, or choose an action:",
			options,
		})

		if (clack.isCancel(selected) || selected === "exit") break outer

		if (selected === "show") {
			await showConfigured()
			continue
		}

		if (selected === "custom_model") {
			await addCustomModel()
			continue
		}

		// Provider selected — configure it
		if (selected.startsWith("provider:")) {
			const providerId = selected.slice("provider:".length)
			const provider = PROVIDERS.find((p) => p.id === providerId)!
			const urlEnvKey = provider.envKey.replace("_API_KEY", "_BASE_URL")
			const currentEnvMap = readEnvFile()
			const currentKey = process.env[provider.envKey] || currentEnvMap.get(provider.envKey) || ""
			const currentUrl = process.env[urlEnvKey] || currentEnvMap.get(urlEnvKey) || ""

			clack.note(
				[
					`Provider : ${provider.name}`,
					`API Key  : ${currentKey ? censorKey(currentKey) : "(not set)"}`,
					`Base URL : ${currentUrl || provider.defaultUrl}`,
				].join("\n"),
				"Current",
			)

			const newKey = await clack.text({
				message: `API Key for ${provider.name}:`,
				placeholder: currentKey ? "(Enter to keep current)" : "e.g. sk-...",
				validate: () => undefined,
			})

			if (clack.isCancel(newKey)) {
				clack.log.warn("Skipped.")
				continue
			}

			const newUrl = await clack.text({
				message: `Base URL for ${provider.name}:`,
				placeholder: currentUrl || provider.defaultUrl,
				validate: () => undefined,
			})

			if (clack.isCancel(newUrl)) {
				clack.log.warn("Skipped.")
				continue
			}

			const resolvedKey = (newKey as string).trim() !== "" ? (newKey as string).trim() : currentKey
			const resolvedUrl = (newUrl as string).trim() !== "" ? (newUrl as string).trim() : currentUrl

			if (resolvedKey) {
				writeEnvKey(provider.envKey, resolvedKey)
				process.env[provider.envKey] = resolvedKey
			}
			if (resolvedUrl) {
				writeEnvKey(urlEnvKey, resolvedUrl)
				process.env[urlEnvKey] = resolvedUrl
			}

			clack.log.success(`${provider.name} saved → ${ENV_PATH}`)
		}
	}

	clack.outro("Done. Restart `cheap` for key changes to take effect.")
	return 0
}
