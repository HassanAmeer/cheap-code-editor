import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { homedir } from "node:os"
import type { PiModelConfig } from "../models.js"
import { geminiModels } from "./gemini/index.js"
import { providerKeys } from "./keys.js"
import { nvidiaModels } from "./nvidia/index.js"
import { openaiModels } from "./openai/index.js"
import { opencodeModels } from "./opencode/index.js"
import { openrouterModels } from "./openrouter/index.js"
import { poolsideModels } from "./poolside/index.js"
import { vercelModels } from "./vercel/index.js"
import { zenmuxModels } from "./zenmux/index.js"

// Helper to parse "tokens" string (e.g. "128k", "2M") to number
function parseTokens(tokenStr: string): number {
	if (!tokenStr) return 8192
	const match = tokenStr.match(/(\d+)([kKMm]?)/)
	if (!match) return 8192
	const num = Number.parseInt(match[1], 10)
	const suffix = match[2].toLowerCase()
	if (suffix === "k") return num * 1024
	if (suffix === "m") return num * 1024 * 1024
	return num
}

function mapToPiModelConfig(model: any, providerId: string): PiModelConfig {
	const isVision = Array.isArray(model.support) && model.support.includes("vision")
	const ctx = parseTokens(model.tokens)

	const showProvider = process.env.SHOW_PROVIDER_NAMES !== "false"
	let formattedName = model.name
	if (showProvider) {
		formattedName = `${model.name} (${model.provider || providerId})`
	}

	const tokensLabel = model.tokens || "8k"

	let category = "sometimes slow"
	if (model.fast === true) category = "Fast"
	if (model.grid === true) category = "Grid"

	// support tags e.g. ["text", "code", "vision"]
	const supportTags: string[] = Array.isArray(model.support) ? model.support : ["text"]

	const cfg: PiModelConfig = {
		id: model.value,
		name: formattedName,
		reasoning: false,
		input: isVision ? ["text", "image"] : ["text"],
		contextWindow: ctx,
		maxTokens: Math.min(ctx, 8192),
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		provider: providerId,
		// @ts-ignore
		_category: category,
		// @ts-ignore
		_tokens: tokensLabel,
		// @ts-ignore
		_support: supportTags,
	}
	// Store in module-level map so it survives models.json round-trip
	modelInfoMap.set(model.value, { category, tokens: tokensLabel, support: supportTags })
	return cfg
}

/** Module-level lookup: modelId → { category, tokens, support } — survives models.json round-trip */
export const modelInfoMap = new Map<string, { category: string; tokens: string; support: string[] }>()

export function getCustomProvidersConfig(): Record<
	string,
	{ api?: string; baseUrl?: string; apiKey?: string; models?: PiModelConfig[] }
> {
	const config: Record<string, any> = {}

	let overrides: any = {}
	try {
		const overridesPath = join(homedir(), ".local", "share", "cheap", "model-overrides.json")
		if (existsSync(overridesPath)) {
			overrides = JSON.parse(readFileSync(overridesPath, "utf-8"))
		}
	} catch (e) { }

	let providerOverrides = overrides.providers || {}
	let modelOverrides = overrides.models || {}
	let customModels = overrides.customModels || []

	// Fallback to old flat provider structure if the file has no section keys
	if (!overrides.providers && !overrides.models && !overrides.customModels) {
		providerOverrides = overrides
	}

	const providersMap = [
		{
			id: "opencode",
			keyData: providerKeys.opencode,
			models: opencodeModels,
			defaultBase: "https://opencode.ai/zen/v1",
		},
		{
			id: "nvidia",
			keyData: providerKeys.nvidia,
			models: nvidiaModels,
			defaultBase: "https://integrate.api.nvidia.com/v1",
		},
		{
			id: "gemini",
			keyData: providerKeys.gemini,
			models: geminiModels,
			defaultBase: "https://generativelanguage.googleapis.com/v1beta/openai/",
		},
		{ id: "openai", keyData: providerKeys.openai, models: openaiModels, defaultBase: "https://api.openai.com/v1" },
		{
			id: "openrouter",
			keyData: providerKeys.openrouter,
			models: openrouterModels,
			defaultBase: "https://openrouter.ai/api/v1",
		},
		{
			id: "poolside",
			keyData: providerKeys.poolside,
			models: poolsideModels,
			defaultBase: "https://api.poolside.ai/v1",
		},
		{ id: "vercel", keyData: providerKeys.vercel, models: vercelModels, defaultBase: "https://ai-gateway.vercel.sh" },
		{ id: "zenmux", keyData: providerKeys.zenmux, models: zenmuxModels, defaultBase: "https://zenmux.ai/api/v1" },
	]

	for (const p of providersMap) {
		if (!p.models || p.models.length === 0) continue

		const activeModels = p.models
			.filter((m: any) => m.show !== false)
			.map((m: any) => {
				const piModel = mapToPiModelConfig(m, p.id)
				if (providerOverrides[p.id]?.vision) {
					piModel.input = ["text", "image"]
				}

				const mOver = modelOverrides[piModel.id]
				if (mOver) {
					if (mOver.vision !== undefined) {
						piModel.input = mOver.vision ? ["text", "image"] : ["text"]
					}
					if (mOver.large !== undefined) {
						// @ts-ignore
						piModel._category = mOver.large ? "sometimes slow" : "Fast"
					}
					if (mOver.contextWindow !== undefined) {
						piModel.contextWindow = mOver.contextWindow
						piModel.maxTokens = Math.min(mOver.contextWindow, 8192)
						const parts = piModel.name.split(" - ")
						const tokensStr = mOver.contextWindow >= 1048576
							? `${Math.round(mOver.contextWindow / 1048576)}M`
							: `${Math.round(mOver.contextWindow / 1024)}k`
						if (parts.length > 1) {
							parts[parts.length - 1] = tokensStr
							piModel.name = parts.join(" - ")
						}
					}
					if (mOver.reasoning !== undefined) {
						piModel.reasoning = mOver.reasoning
					}
					if (mOver.apiKey || mOver.baseUrl) {
						const virtualProviderId = `v-${piModel.id}`
						piModel.provider = virtualProviderId
						config[virtualProviderId] = {
							api: "openai-completions",
							baseUrl: mOver.baseUrl || p.keyData.baseURL || p.defaultBase,
							apiKey: mOver.apiKey || p.keyData.apiKey || "unset",
							models: [piModel]
						}
						return null
					}
				}

				return piModel
			})
			.filter(Boolean) as PiModelConfig[]

		// Process custom models for this provider
		for (const cm of customModels) {
			if (cm.provider === p.id) {
				const tokensStr = cm.contextWindow >= 1048576
					? `${Math.round(cm.contextWindow / 1048576)}M`
					: `${Math.round(cm.contextWindow / 1024)}k`
				const showProvider = process.env.SHOW_PROVIDER_NAMES !== "false"
				const displayName = showProvider
					? `${cm.name || cm.id} (${p.id}) - ${tokensStr}`
					: `${cm.name || cm.id} - ${tokensStr}`

				const customPiModel: PiModelConfig = {
					id: cm.id,
					name: displayName,
					reasoning: !!cm.reasoning,
					input: cm.vision ? ["text", "image"] : ["text"],
					contextWindow: cm.contextWindow || 8192,
					maxTokens: Math.min(cm.contextWindow || 8192, 8192),
					cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
					provider: p.id,
					// @ts-ignore
					_category: cm.large ? "sometimes slow" : "Fast",
					// @ts-ignore
					_tokens: tokensStr,
					// @ts-ignore
					_support: cm.vision ? ["text", "image", "vision"] : ["text", "code"]
				}
				// Store in module-level map
				modelInfoMap.set(cm.id, {
					category: cm.large ? "sometimes slow" : "Fast",
					tokens: tokensStr,
					support: cm.vision ? ["text", "image", "vision"] : ["text", "code"]
				})

				if (cm.apiKey || cm.baseUrl) {
					const virtualProviderId = `v-${cm.id}`
					customPiModel.provider = virtualProviderId
					config[virtualProviderId] = {
						api: "openai-completions",
						baseUrl: cm.baseUrl || p.keyData.baseURL || p.defaultBase,
						apiKey: cm.apiKey || p.keyData.apiKey || "unset",
						models: [customPiModel]
					}
				} else {
					activeModels.push(customPiModel)
				}
			}
		}

		if (activeModels.length > 0) {
			const baseUrl = p.keyData.baseURL || p.defaultBase
			const apiKey = p.keyData.apiKey || "unset"

			config[p.id] = {
				api: "openai-completions",
				baseUrl: baseUrl,
				apiKey: apiKey,
				models: activeModels,
			}
		}
	}

	return config
}
