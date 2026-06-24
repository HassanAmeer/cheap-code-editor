import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"
import { getCustomProvidersConfig } from "./providers/index.js"
import { getVersion } from "./utils.js"

export class ModelsFetchError extends Error {
	readonly transient: boolean
	constructor(message: string, options: { transient: boolean }) {
		super(message)
		this.name = "ModelsFetchError"
		this.transient = options.transient
	}
}

export function isTransientModelsError(error: unknown): boolean {
	return error instanceof ModelsFetchError && error.transient
}

export interface FetchModelsOptions {
	sleep?: (ms: number) => Promise<void>
	endpoint?: string
	allowCachedFallback?: boolean
	requireActiveModels?: boolean
}

export interface ModelMetadata {
	slug: string
	display_name: string
	provider: string
	reasoning: boolean
	input_modalities: ("text" | "image")[]
	is_serverless: boolean
	limits: {
		context_window: number
		max_output_tokens: number
	}
	status?: "active" | "sunset" | "deprecated"
	replacement?: string
	_category?: string
}

interface ModelsMetadataResponse {
	models: ModelMetadata[]
}

function sortModels(models: ModelMetadata[]): ModelMetadata[] {
	const serverless = models.filter((m) => m.is_serverless)
	const rest = models.filter((m) => !m.is_serverless)
	return [...serverless, ...rest]
}

export interface PiModelConfig {
	id: string
	name: string
	reasoning: boolean
	input: ("text" | "image")[]
	contextWindow: number
	maxTokens: number
	cost: { input: number; output: number; cacheRead: number; cacheWrite: number }
	// Persisted so telemetry can resolve the actual upstream provider after cache round-trip.
	provider: string
	compat?: { supportsReasoningEffort?: boolean; cacheControlFormat?: "anthropic" }
	/** Model-level API type: upstream custom-provider parseModels falls through to this field. */
	api?: string
	/** Model-level base URL: upstream custom-provider parseModels falls through to this field. */
	baseUrl?: string
}

function metadataToModel(m: ModelMetadata): PiModelConfig {
	// TODO: our LiteLLM gateway does not support `thinking.type.enabled` for Anthropic >Opus 4.6 models
	// Therefore, we disable it for now. Revisit, once we upgrade our LiteLLM version.
	const compat =
		m.provider === "anthropic"
			? ({ supportsReasoningEffort: false, cacheControlFormat: "anthropic" } as const)
			: undefined
	return {
		id: m.slug,
		name: m.display_name.trim().length > 0 ? m.display_name : m.slug,
		reasoning: m.reasoning,
		input: m.input_modalities,
		contextWindow: m.limits.context_window,
		maxTokens: m.limits.max_output_tokens,
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		// Store upstream provider for telemetry round-trip via models.json
		provider: m.provider,
		...(compat && { compat }),
		// @ts-ignore
		_category: m._category,
	}
}

export interface ModelsConfigResult {
	models: ModelMetadata[]
}

function modelToMetadata(m: PiModelConfig): ModelMetadata {
	return {
		slug: m.id,
		display_name: m.name,
		// If `provider` was persisted by metadataToModel, use it. Fall back to the
		// legacy compat heuristic for files written by older CLI versions.
		provider: m.provider || (m.compat ? "anthropic" : ""),
		reasoning: m.reasoning,
		input_modalities: m.input,
		is_serverless: true,
		limits: { context_window: m.contextWindow, max_output_tokens: m.maxTokens },
		// @ts-ignore
		_category: m._category,
	}
}

function extractModelsFromProviders(providers: Record<string, { models?: PiModelConfig[] }>): ModelMetadata[] {
	const result: ModelMetadata[] = []
	for (const [, provider] of Object.entries(providers)) {
		if (provider && typeof provider === "object" && Array.isArray(provider.models)) {
			result.push(...provider.models.map(modelToMetadata))
		}
	}
	return result
}

function readExistingProviders(modelsJsonPath: string): Record<string, unknown> {
	if (!existsSync(modelsJsonPath)) return {}
	try {
		const raw = readFileSync(modelsJsonPath, "utf-8")
		const config = JSON.parse(raw)
		const providers = config?.providers ?? {}
		const { "cheap-dev": _cheap, "cheap-experimental": _exp, ...rest } = providers as Record<string, unknown>
		return rest
	} catch {
		return {}
	}
}

export async function validateApiKey(apiKey: string, options: FetchModelsOptions = {}): Promise<void> {
	// Local only: No API validation needed
}

/**
 * Overwrite or insert a provider's models in models.json.
 * Used after OAuth subscription login to persist upstream models into Cheap's cache.
 */
export function syncProviderModels(
	modelsJsonPath: string,
	providerId: string,
	models: PiModelConfig[],
	providerConfig?: { api?: string; baseUrl?: string },
): void {
	let config: { providers?: Record<string, { api?: string; baseUrl?: string; models?: PiModelConfig[] }> } = {}
	if (existsSync(modelsJsonPath)) {
		config = JSON.parse(readFileSync(modelsJsonPath, "utf-8"))
	}
	if (!config.providers) config.providers = {}
	config.providers[providerId] = { ...providerConfig, models }
	writeFileSync(modelsJsonPath, JSON.stringify(config, null, "\t"), "utf-8")
}

/**
 * Fetch available models from the cheap metadata API and write the
 * configuration to modelsJsonPath. If no API key is configured, returns
 * cached models (if available) or an empty list without making a network call.
 * If the fetch fails and the previous models.json is still on disk, returns
 * the cached models with a warning. Throws only when a key is present but
 * there is no cache to fall back on.
 *
 * User-added providers (anything other than "cheap-dev") are preserved across
 * updates so custom model configurations are not lost on startup.
 */
export async function updateModelsConfig(
	modelsJsonPath: string,
	apiKey: string,
	options: FetchModelsOptions = {},
): Promise<ModelsConfigResult> {
	const dir = dirname(modelsJsonPath)
	mkdirSync(dir, { recursive: true })

	const otherProviders = { ...readExistingProviders(modelsJsonPath), ...getCustomProvidersConfig() }
	const otherModels = extractModelsFromProviders(otherProviders as Record<string, { models?: PiModelConfig[] }>)

	const merged = { providers: otherProviders }
	writeFileSync(modelsJsonPath, JSON.stringify(merged, null, "\t"), "utf-8")

	return { models: sortModels(otherModels) }
}
