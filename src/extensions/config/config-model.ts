import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import type { ExtensionContext } from "@earendil-works/pi-coding-agent"
import { updateModelsConfig } from "../../models.js"
import { providerKeys } from "../../providers/keys.js"
import { ExtensionSelectorComponent, LoginDialogComponent } from "@earendil-works/pi-coding-agent"
export async function configureLocalProviderKeys(ctx: ExtensionContext, modelsJsonPath: string): Promise<void> {
	const providers = [
		{ name: "OpenCode", envKey: "OPENCODE_API_KEY", id: "opencode" },
		{ name: "NVIDIA NIM", envKey: "NVIDIA_API_KEY", id: "nvidia" },
		{ name: "Gemini", envKey: "GEMINI_API_KEY", id: "gemini" },
		{ name: "OpenRouter", envKey: "OPENROUTER_API_KEY", id: "openrouter" },
		{ name: "OpenAI", envKey: "OPENAI_API_KEY", id: "openai" },
		{ name: "Poolside", envKey: "POOLSIDE_API_KEY", id: "poolside" },
		{ name: "Vercel", envKey: "VERCEL_API_KEY", id: "vercel" },
		{ name: "Qwen", envKey: "QWEN_API_KEY", id: "qwen" },
		{ name: "Zai", envKey: "ZAI_API_KEY", id: "zai" },
		{ name: "Kimi", envKey: "KIMI_API_KEY", id: "kimi" },
		{ name: "Zenmux", envKey: "ZENMUX_API_KEY", id: "zenmux" },
	]

	while (true) {
		const action = await ctx.ui.custom<string | undefined>((_tui, _theme, _keybindings, done) => {
			const selector = new ExtensionSelectorComponent(
				"⚙ AI Configuration Options",
				[
					"Configure Provider (API Key & Base URL)",
					"Configure / Add Custom Model",
					"Show Configured Keys & Custom Models",
					"Exit"
				],
				(selectedLabel) => done(selectedLabel),
				() => done(undefined),
			)
			return selector as any
		})

		if (!action || action === "Exit") break

		if (action === "Configure Provider (API Key & Base URL)") {
			const selectedName = await ctx.ui.custom<string | undefined>((_tui, _theme, _keybindings, done) => {
				const labels = providers.map((p) => p.name)
				const selector = new ExtensionSelectorComponent(
					"Select Provider to Configure",
					labels,
					(selectedLabel) => done(selectedLabel),
					() => done(undefined),
				)
				return selector as any
			})

			if (!selectedName) continue

			const provider = providers.find((p) => p.name === selectedName)!

			const envKey = provider.envKey
			const urlEnvKey = `${provider.envKey.replace("_API_KEY", "")}_BASE_URL`
			const existingKey = process.env[envKey] || ""
			const existingUrl = process.env[urlEnvKey] || ""

			const newKey = await ctx.ui.custom<string | undefined>((tui, _theme, _keybindings, done) => {
				const dialog = new LoginDialogComponent(tui as any, provider.name, () => done(undefined), provider.name, `Configure ${provider.name} Key`)
				dialog.showPrompt(`API Key (current: ${existingKey ? censorKey(existingKey) : "none"}):`, `API Key for ${provider.name}`)
					.then((val) => done(val))
					.catch(() => done(undefined))
				return dialog as any
			})

			if (newKey === undefined) continue

			const newBaseUrl = await ctx.ui.custom<string | undefined>((tui, _theme, _keybindings, done) => {
				const dialog = new LoginDialogComponent(tui as any, provider.name, () => done(undefined), provider.name, `Configure ${provider.name} URL`)
				dialog.showPrompt(`Base URL (current: ${existingUrl || "default"}):`, `Base URL for ${provider.name}`)
					.then((val) => done(val))
					.catch(() => done(undefined))
				return dialog as any
			})

			if (newBaseUrl === undefined) continue

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
					if (newKey.trim() !== "") {
						newLines.push(`${envKey}="${newKey.trim()}"`)
					}
					foundKey = true
				} else if (line.trim().startsWith(`${urlEnvKey}=`)) {
					if (newBaseUrl.trim() !== "") {
						newLines.push(`${urlEnvKey}="${newBaseUrl.trim()}"`)
					}
					foundUrl = true
				} else {
					newLines.push(line)
				}
			}

			if (!foundKey && newKey.trim() !== "") {
				if (newLines.length > 0 && newLines[newLines.length - 1] !== "") newLines.push("")
				newLines.push(`${envKey}="${newKey.trim()}"`)
			}
			if (!foundUrl && newBaseUrl.trim() !== "") {
				if (newLines.length > 0 && newLines[newLines.length - 1] !== "") newLines.push("")
				newLines.push(`${urlEnvKey}="${newBaseUrl.trim()}"`)
			}

			writeFileSync(envPath, newLines.join("\n"), "utf-8")

			// Update process.env
			if (newKey.trim() !== "") {
				process.env[envKey] = newKey.trim()
			} else {
				delete process.env[envKey]
			}
			if (newBaseUrl.trim() !== "") {
				process.env[urlEnvKey] = newBaseUrl.trim()
			} else {
				delete process.env[urlEnvKey]
			}

			await updateModelsConfig(modelsJsonPath, "")
			ctx.modelRegistry.refresh()
			ctx.ui.notify(`${provider.name} provider configuration updated.`, "info")
		}

		if (action === "Configure / Add Custom Model") {
			const providerName = await ctx.ui.custom<string | undefined>((_tui, _theme, _keybindings, done) => {
				const labels = providers.map((p) => p.name)
				const selector = new ExtensionSelectorComponent(
					"Select Provider for Custom Model",
					labels,
					(selectedLabel) => done(selectedLabel),
					() => done(undefined),
				)
				return selector as any
			})

			if (!providerName) continue
			const provider = providers.find((p) => p.name === providerName)!

			const modelId = await ctx.ui.custom<string | undefined>((tui, _theme, _keybindings, done) => {
				const dialog = new LoginDialogComponent(tui as any, provider.name, () => done(undefined), provider.name, "Custom Model ID")
				dialog.showPrompt("Enter Custom Model ID (e.g. gpt-4o, deepseek-reasoner):", "Model ID")
					.then((val) => done(val))
					.catch(() => done(undefined))
				return dialog as any
			})

			if (!modelId || modelId.trim() === "") continue

			const modelName = await ctx.ui.custom<string | undefined>((tui, _theme, _keybindings, done) => {
				const dialog = new LoginDialogComponent(tui as any, provider.name, () => done(undefined), provider.name, "Model Display Name")
				dialog.showPrompt("Enter Display Name (e.g. My custom GPT-4o):", "Display Name")
					.then((val) => done(val))
					.catch(() => done(undefined))
				return dialog as any
			})

			if (!modelName || modelName.trim() === "") continue

			const hasVision = await ctx.ui.custom<string | undefined>((_tui, _theme, _keybindings, done) => {
				const selector = new ExtensionSelectorComponent(
					"Does this model support image/vision input?",
					["Yes", "No"],
					(label) => done(label),
					() => done(undefined),
				)
				return selector as any
			})

			if (!hasVision) continue

			const isLarge = await ctx.ui.custom<string | undefined>((_tui, _theme, _keybindings, done) => {
				const selector = new ExtensionSelectorComponent(
					"Is this model a Large / Slow model?",
					["Yes", "No"],
					(label) => done(label),
					() => done(undefined),
				)
				return selector as any
			})

			if (!isLarge) continue

			const contextSelect = await ctx.ui.custom<string | undefined>((_tui, _theme, _keybindings, done) => {
				const selector = new ExtensionSelectorComponent(
					"Select Model Context Window (Tokens):",
					["8k", "32k", "128k", "1M", "Custom"],
					(label) => done(label),
					() => done(undefined),
				)
				return selector as any
			})

			if (!contextSelect) continue

			let contextLimit = 8192
			if (contextSelect === "8k") contextLimit = 8192
			else if (contextSelect === "32k") contextLimit = 32768
			else if (contextSelect === "128k") contextLimit = 131072
			else if (contextSelect === "1M") contextLimit = 1048576
			else if (contextSelect === "Custom") {
				const customVal = await ctx.ui.custom<string | undefined>((tui, _theme, _keybindings, done) => {
					const dialog = new LoginDialogComponent(tui as any, provider.name, () => done(undefined), provider.name, "Context Window Limit")
					dialog.showPrompt("Enter custom limit in tokens (e.g. 65536):", "Context Tokens")
						.then((val) => done(val))
						.catch(() => done(undefined))
					return dialog as any
				})
				if (!customVal || customVal.trim() === "") continue
				contextLimit = parseInt(customVal.trim(), 10) || 8192
			}

			const isReasoning = await ctx.ui.custom<string | undefined>((_tui, _theme, _keybindings, done) => {
				const selector = new ExtensionSelectorComponent(
					"Does this model support reasoning effort / deep reasoning?",
					["Yes", "No"],
					(label) => done(label),
					() => done(undefined),
				)
				return selector as any
			})

			if (!isReasoning) continue

			const modelKey = await ctx.ui.custom<string | undefined>((tui, _theme, _keybindings, done) => {
				const dialog = new LoginDialogComponent(tui as any, provider.name, () => done(undefined), provider.name, "Model-Specific API Key")
				dialog.showPrompt("Enter model-specific API Key (leave empty to use provider key):", "API Key")
					.then((val) => done(val))
					.catch(() => done(undefined))
				return dialog as any
			})

			if (modelKey === undefined) continue

			const modelUrl = await ctx.ui.custom<string | undefined>((tui, _theme, _keybindings, done) => {
				const dialog = new LoginDialogComponent(tui as any, provider.name, () => done(undefined), provider.name, "Model-Specific Base URL")
				dialog.showPrompt("Enter model-specific Base URL (leave empty to use provider URL):", "Base URL")
					.then((val) => done(val))
					.catch(() => done(undefined))
				return dialog as any
			})

			if (modelUrl === undefined) continue

			// Save to model-overrides.json
			const overridesPath = join(homedir(), ".local", "share", "cheap", "model-overrides.json")
			let overrides: any = {}
			if (existsSync(overridesPath)) {
				try { overrides = JSON.parse(readFileSync(overridesPath, "utf-8")) } catch {}
			}

			if (!overrides.customModels) overrides.customModels = []
			// Remove previous matching custom model if any
			overrides.customModels = overrides.customModels.filter((m: any) => m.id !== modelId.trim())

			overrides.customModels.push({
				id: modelId.trim(),
				name: modelName.trim(),
				provider: provider.id,
				vision: hasVision === "Yes",
				large: isLarge === "Yes",
				contextWindow: contextLimit,
				reasoning: isReasoning === "Yes",
				apiKey: modelKey.trim() !== "" ? modelKey.trim() : undefined,
				baseUrl: modelUrl.trim() !== "" ? modelUrl.trim() : undefined
			})

			writeFileSync(overridesPath, JSON.stringify(overrides, null, 2), "utf-8")

			await updateModelsConfig(modelsJsonPath, "")
			ctx.modelRegistry.refresh()
			ctx.ui.notify(`Custom model ${modelId.trim()} added/configured successfully.`, "info")
		}

		if (action === "Show Configured Keys & Custom Models") {
			const overridesPath = join(homedir(), ".local", "share", "cheap", "model-overrides.json")
			let overrides: any = {}
			if (existsSync(overridesPath)) {
				try { overrides = JSON.parse(readFileSync(overridesPath, "utf-8")) } catch {}
			}
			const customModels = overrides.customModels || []

			let displayStr = "--- Configured Settings ---\n"
			for (const p of providers) {
				const apiKey = process.env[p.envKey] || ""
				const baseUrl = process.env[`${p.envKey.replace("_API_KEY", "")}_BASE_URL`] || ""
				if (apiKey || baseUrl) {
					displayStr += `${p.name}:\n`
					if (apiKey) displayStr += `  API Key: ${censorKey(apiKey)}\n`
					if (baseUrl) displayStr += `  Base URL: ${baseUrl}\n`
				}
			}

			if (customModels.length > 0) {
				displayStr += "\n--- Custom Models ---\n"
				for (const m of customModels) {
					displayStr += `- ${m.name} (${m.id}) [Provider: ${m.provider}]\n`
					displayStr += `  Vision: ${m.vision ? "Yes" : "No"}, Large: ${m.large ? "Yes" : "No"}\n`
					displayStr += `  Context: ${m.contextWindow} tokens, Reasoning: ${m.reasoning ? "Yes" : "No"}\n`
					if (m.apiKey) displayStr += `  API Key: ${censorKey(m.apiKey)}\n`
					if (m.baseUrl) displayStr += `  Base URL: ${m.baseUrl}\n`
				}
			}

			await ctx.ui.custom<void>((_tui, _theme, _keybindings, done) => {
				const selector = new ExtensionSelectorComponent(
					"Settings Details (Select back to return)",
					[displayStr, "← Back"],
					() => done(),
					() => done()
				)
				return selector as any
			})
		}
	}
}

function censorKey(key: string): string {
	if (!key) return ""
	if (key.length <= 15) return "****" + key.substring(key.length - Math.min(key.length - 1, 3))
	return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`
}
