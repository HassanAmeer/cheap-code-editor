export const openaiModels = [
	{
		name: "gpt-oss-120b (free)",
		value: "openai/gpt-oss-120b:free",
		provider: "OpenAI",
		show: true,
		fast: false,
		tokens: "1M",
		support: ["text", "code", "vision"],
	},
	{
		name: "gpt-oss-20b (free)",
		value: "openai/gpt-oss-20b:free",
		provider: "OpenAI",
		show: true,
		fast: true,
		tokens: "128k",
		support: ["text", "code"],
	},
]
