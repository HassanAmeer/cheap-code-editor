export const providerKeys = {
	// OpenCode
	opencode: {
		apiKey: process.env.OPENCODE_API_KEY || "",
		baseURL: process.env.OPENCODE_BASE_URL || "https://opencode.ai/zen/v1",
	},
	// NVIDIA NIM
	nvidia: {
		apiKey: process.env.NVIDIA_API_KEY || "",
		baseURL: process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1",
	},
	// Gemini (Google AI Studio)
	gemini: {
		apiKey: process.env.GEMINI_API_KEY || "",
		baseURL: process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta/openai/",
	},
	// OpenRouter
	openrouter: {
		apiKey: process.env.OPENROUTER_API_KEY || "",
		baseURL: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
	},
	// OpenAI (Standard)
	openai: {
		apiKey: process.env.OPENAI_API_KEY || "",
		baseURL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
	},
	// Poolside
	poolside: {
		apiKey: process.env.POOLSIDE_API_KEY || "",
		baseURL: process.env.POOLSIDE_BASE_URL || "https://api.poolside.ai/v1",
	},
	// Vercel
	vercel: {
		apiKey: process.env.VERCEL_API_KEY || "",
		baseURL: process.env.VERCEL_BASE_URL || "https://ai-gateway.vercel.sh",
	},
	// Qwen
	qwen: {
		apiKey: process.env.QWEN_API_KEY || "",
		baseURL: process.env.QWEN_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1",
	},
	// Zai
	zai: {
		apiKey: process.env.ZAI_API_KEY || "",
		baseURL: process.env.ZAI_BASE_URL || "https://open.bigmodel.cn/api/paas/v4/",
	},
	// Kimi
	kimi: {
		apiKey: process.env.KIMI_API_KEY || "",
		baseURL: process.env.KIMI_BASE_URL || "https://api.moonshot.cn/v1",
	},
	// Zenmux
	zenmux: {
		apiKey: process.env.ZENMUX_API_KEY || "",
		baseURL: process.env.ZENMUX_BASE_URL || "https://zenmux.ai/api/v1",
	},
}
