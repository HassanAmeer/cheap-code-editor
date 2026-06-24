export const vercelModels = [
	{
		name: "LongCat Flash Chat",
		value: "meituan/longcat-flash-chat",
		provider: "Vercel",
		show: true,
		fast: true,
		tokens: "128k",
		support: ["text", "code"],
	},
	// Text, Vision (Image), File Input, Reasoning, Implicit Caching, Tool Use,
	{
		name: "GLM-4.6V-Flash",
		value: "zai/glm-4.6v-flash",
		provider: "Vercel",
		show: true,
		fast: true,
		tokens: "1M",
		support: ["text", "vision", "image", "code"],
	},
]
