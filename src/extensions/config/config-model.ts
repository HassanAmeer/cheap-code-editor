import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import type { ExtensionContext } from "@earendil-works/pi-coding-agent"
import { ExtensionSelectorComponent, LoginDialogComponent } from "@earendil-works/pi-coding-agent"
import { updateModelsConfig } from "../../models.js"

export async function configureLocalProviderKeys(ctx: ExtensionContext, modelsJsonPath: string): Promise<void> {
	const providers = [
		{ label: "Zenmux", envKey: "ZENMUX_API_KEY", id: "zenmux", defaultUrl: "https://zenmux.ai/api/v1" },
		{ label: "OpenAI (Standard)", envKey: "OPENAI_API_KEY", id: "openai", defaultUrl: "https://api.openai.com/v1" },
		{
			label: "Gemini (Google Studio)",
			envKey: "GEMINI_API_KEY",
			id: "gemini",
			defaultUrl: "https://generativelanguage.googleapis.com/v1beta/openai/",
		},
		{
			label: "OpenRouter (Multi-model)",
			envKey: "OPENROUTER_API_KEY",
			id: "openrouter",
			defaultUrl: "https://openrouter.ai/api/v1",
		},
		{ label: "Kimi (Moonshot)", envKey: "KIMI_API_KEY", id: "kimi", defaultUrl: "https://api.moonshot.cn/v1" },
		{ label: "NVIDIA NIM", envKey: "NVIDIA_API_KEY", id: "nvidia", defaultUrl: "https://integrate.api.nvidia.com/v1" },
		{ label: "OpenCode", envKey: "OPENCODE_API_KEY", id: "opencode", defaultUrl: "https://opencode.ai/zen/v1" },
		{ label: "Poolside", envKey: "POOLSIDE_API_KEY", id: "poolside", defaultUrl: "https://api.poolside.ai/v1" },
		{ label: "Vercel", envKey: "VERCEL_API_KEY", id: "vercel", defaultUrl: "https://ai-gateway.vercel.sh" },
		{
			label: "Qwen",
			envKey: "QWEN_API_KEY",
			id: "qwen",
			defaultUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
		},
		{ label: "Zai (ZhipuAI)", envKey: "ZAI_API_KEY", id: "zai", defaultUrl: "https://open.bigmodel.cn/api/paas/v4/" },
	]

	while (true) {
		const action = await ctx.ui.custom<string | undefined>((_tui, _theme, _keybindings, done) => {
			const selector = new ExtensionSelectorComponent(
				"⚙ AI Configuration Options:",
				[
					"✦ Configure a Provider API Key",
					"⚲ Show Configured API Keys",
					"🗑️ Clear a Provider API Key",
					"× Back to Main Menu",
				],
				(selectedLabel) => done(selectedLabel),
				() => done(undefined),
			)
			return selector as any
		})

		if (!action || action === "× Back to Main Menu") break

		if (action === "✦ Configure a Provider API Key" || action === "🗑️ Clear a Provider API Key") {
			const isClear = action === "🗑️ Clear a Provider API Key"

			const selectedLabel = await ctx.ui.custom<string | undefined>((_tui, _theme, _keybindings, done) => {
				// Match exact screenshot order: Zenmux, <- Back, then OpenAI, Gemini, etc.
				const labels = [providers[0].label, "← Back", ...providers.slice(1).map((p) => p.label)]
				const selector = new ExtensionSelectorComponent(
					isClear ? "Select AI Provider to clear:" : "Select AI Provider to configure:",
					labels,
					(label) => done(label),
					() => done(undefined),
				)
				return selector as any
			})

			if (!selectedLabel || selectedLabel === "← Back") continue

			const provider = providers.find((p) => p.label === selectedLabel)!
			const envKey = provider.envKey
			const urlEnvKey = `${provider.envKey.replace("_API_KEY", "")}_BASE_URL`

			let newKey = ""
			let newBaseUrl = ""

			if (!isClear) {
				const existingKey = process.env[envKey] || ""
				const existingUrl = process.env[urlEnvKey] || ""

				const promptedKey = await ctx.ui.custom<string | undefined>((tui, _theme, _keybindings, done) => {
					const dialog = new LoginDialogComponent(
						tui as any,
						provider.id,
						() => done(undefined),
						provider.label,
						`Configure ${provider.label} Key`,
					)
					dialog
						.showPrompt(`API Key (current: ${existingKey ? censorKey(existingKey) : "none"}):`, "API Key")
						.then((val) => done(val))
						.catch(() => done(undefined))
					return dialog as any
				})

				if (promptedKey === undefined) continue // Cancelled
				newKey = promptedKey.trim() !== "" ? promptedKey.trim() : existingKey

				newBaseUrl = existingUrl
			}

			// Write to ~/.local/share/cheap/.env
			const envPath = join(homedir(), ".local", "share", "cheap", ".env")
			let envContent = ""
			if (existsSync(envPath)) {
				envContent = readFileSync(envPath, "utf-8")
			}

			const lines = envContent.split("\n")
			const newLines: string[] = []
			let foundKey = false
			let foundUrl = false

			for (const line of lines) {
				if (line.trim().startsWith(`${envKey}=`)) {
					if (newKey !== "") newLines.push(`${envKey}="${newKey}"`)
					foundKey = true
				} else if (line.trim().startsWith(`${urlEnvKey}=`)) {
					if (newBaseUrl !== "") newLines.push(`${urlEnvKey}="${newBaseUrl}"`)
					foundUrl = true
				} else {
					newLines.push(line)
				}
			}

			if (!foundKey && newKey !== "") {
				if (newLines.length > 0 && newLines[newLines.length - 1] !== "") newLines.push("")
				newLines.push(`${envKey}="${newKey}"`)
			}
			if (!foundUrl && newBaseUrl !== "") {
				if (newLines.length > 0 && newLines[newLines.length - 1] !== "") newLines.push("")
				newLines.push(`${urlEnvKey}="${newBaseUrl}"`)
			}

			writeFileSync(envPath, `${newLines.join("\n").trimEnd()}\n`, "utf-8")

			// Update process.env
			if (newKey !== "") process.env[envKey] = newKey
			else delete process.env[envKey]

			if (newBaseUrl !== "") process.env[urlEnvKey] = newBaseUrl
			else delete process.env[urlEnvKey]

			await updateModelsConfig(modelsJsonPath, "")
			ctx.modelRegistry.refresh()
			ctx.ui.notify(
				isClear ? `${provider.label} configuration cleared.` : `${provider.label} configuration updated.`,
				"info",
			)
		}

		if (action === "⚲ Show Configured API Keys") {
			let displayStr = "--- Configured Provider Keys ---\n\n"
			let anyFound = false

			for (const p of providers) {
				const apiKey = process.env[p.envKey] || ""
				const baseUrl = process.env[`${p.envKey.replace("_API_KEY", "")}_BASE_URL`] || ""
				if (apiKey || baseUrl) {
					anyFound = true
					displayStr += `${p.label}:\n`
					if (apiKey) displayStr += `  API Key: ${censorKey(apiKey)}\n`
					if (baseUrl) displayStr += `  Base URL: ${baseUrl}\n`
					displayStr += "\n"
				}
			}

			if (!anyFound) displayStr += "No provider keys are currently configured.\n"

			await ctx.ui.custom<void>((_tui, _theme, _keybindings, done) => {
				const selector = new ExtensionSelectorComponent(
					"Configured API Keys",
					[displayStr.trim(), "← Back"],
					() => done(),
					() => done(),
				)
				return selector as any
			})
		}
	}
}

function censorKey(key: string): string {
	if (!key) return ""
	if (key.length <= 15) return `****${key.slice(-Math.min(key.length - 1, 3))}`
	return `${key.slice(0, 4)}...${key.slice(-4)}`
}
